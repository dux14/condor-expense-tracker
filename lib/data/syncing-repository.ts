// SyncingRepository — offline-first decorator over a local cache + a remote.
//
// CONTRACT (D5): reads serve the local cache instantly; writes apply to local
// and enqueue a durable outbox op; a background flush() drains the outbox to
// remote with LAST-WRITE-WINS by updatedAt (or synctime for entities without
// it); pull() reconciles remote → local under the same LWW rule, honoring
// delete tombstones so a stale remote copy cannot resurrect a deleted record.
// The service worker is NOT involved — sync is purely application-level.
//
// LWW timestamp policy: Expense/Budget/Rule compare `updatedAt`; Category and
// Settings (no updatedAt) compare the SyncTimeStore side-map. See the *Store
// classes for the durable storage details.
//
// Tombstone policy: delete → local delete + tombstone + enqueue delete. pull()
// skips tombstoned ids UNLESS the remote row's timestamp is newer than the
// tombstone (legitimate re-create wins → tombstone dropped, row restored).

import type { Repository } from './repository';
import type { Expense, Category, Settings, ExportBundle } from '@/lib/domain/types';
import { SyncQueue, type OutboxEntity } from './sync-queue';
import { TombstoneStore } from './tombstones';
import { SyncTimeStore } from './synctimes';

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error';

function nowISO(): string {
  return new Date().toISOString();
}

/** Comparable LWW timestamp for a record: updatedAt if present, else synctime. */
function lwwStamp(
  entity: OutboxEntity,
  id: string,
  record: { updatedAt?: string } | null,
  synctimes: SyncTimeStore,
): string | null {
  if (record && typeof record.updatedAt === 'string') return record.updatedAt;
  return synctimes.get(entity, id);
}

export class SyncingRepository implements Repository {
  private queue = new SyncQueue();
  private tombstones = new TombstoneStore();
  private synctimes = new SyncTimeStore();
  private status: SyncStatus = 'synced';
  private listeners = new Set<(s: SyncStatus) => void>();

  constructor(
    private readonly local: Repository,
    private readonly remote: Repository,
  ) {}

  // ---- status surface (consumed by the UI dot) --------------------------
  getStatus(): SyncStatus { return this.status; }
  onStatus(fn: (s: SyncStatus) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private setStatus(s: SyncStatus): void {
    if (s === this.status) return;
    this.status = s;
    for (const fn of this.listeners) fn(s);
  }

  // ---- reads: local cache, instant --------------------------------------
  listExpenses(): Promise<Expense[]> { return this.local.listExpenses(); }
  listCategories(): Promise<Category[]> { return this.local.listCategories(); }
  getSettings(): Promise<Settings> { return this.local.getSettings(); }
  exportAll(): Promise<ExportBundle> { return this.local.exportAll(); }

  // ---- writes: local + enqueue ------------------------------------------
  async upsertExpense(e: Expense): Promise<Expense> {
    const saved = await this.local.upsertExpense(e);
    this.tombstones.remove('expense', e.id);
    this.synctimes.set('expense', e.id, e.updatedAt);
    this.queue.enqueue({ op: 'upsert', entity: 'expense', id: e.id, payload: saved, enqueuedAt: e.updatedAt });
    return saved;
  }

  async deleteExpense(id: string): Promise<void> {
    await this.local.deleteExpense(id);
    const at = nowISO();
    this.tombstones.add('expense', id, at);
    this.queue.enqueue({ op: 'delete', entity: 'expense', id, payload: { id }, enqueuedAt: at });
  }

  async upsertCategory(c: Category): Promise<Category> {
    const saved = await this.local.upsertCategory(c);
    const at = nowISO();
    this.tombstones.remove('category', c.id);
    this.synctimes.set('category', c.id, at);
    this.queue.enqueue({ op: 'upsert', entity: 'category', id: c.id, payload: saved, enqueuedAt: at });
    return saved;
  }

  async deleteCategory(id: string, reassignTo?: string): Promise<void> {
    await this.local.deleteCategory(id, reassignTo); // throws for presets (local enforces)
    const at = nowISO();
    this.tombstones.add('category', id, at);
    this.queue.enqueue({ op: 'delete', entity: 'category', id, payload: { id, reassignTo }, enqueuedAt: at });
  }

  async putSettings(s: Settings): Promise<Settings> {
    const saved = await this.local.putSettings(s);
    const at = nowISO();
    this.synctimes.set('settings', 'settings', at);
    this.queue.enqueue({ op: 'upsert', entity: 'settings', id: 'settings', payload: saved, enqueuedAt: at });
    return saved;
  }

  async wipeAll(): Promise<void> {
    // local.wipeAll() removes every condor:* key, including outbox/tombstones/synctimes.
    await this.local.wipeAll();
    try { await this.remote.wipeAll(); this.setStatus('synced'); }
    catch { this.setStatus('offline'); }
  }

  // ---- flush + pull: implemented in Task 6 / Task 7 ---------------------
  async flush(): Promise<void> {
    const ops = this.queue.peekAll();
    if (ops.length === 0) { this.setStatus('synced'); return; }
    this.setStatus('syncing');
    let sawOffline = false;
    let sawError = false;

    for (const op of ops) {
      try {
        if (op.op === 'delete') {
          await this.applyRemoteDelete(op.entity, op.id, op.payload as { reassignTo?: string });
          this.queue.ack(op.entity, op.id);
          continue;
        }
        // upsert: LWW vs the remote's current copy
        const remoteRecord = await this.findRemote(op.entity, op.id);
        const remoteStamp = remoteRecord
          ? lwwStamp(op.entity, op.id, remoteRecord as { updatedAt?: string }, this.synctimes)
          : null;
        const localStamp = op.enqueuedAt;

        if (remoteStamp !== null && remoteStamp > localStamp) {
          // remote is newer → remote wins; reconcile into local, drop the op
          await this.writeLocal(op.entity, remoteRecord!);
          this.synctimes.set(op.entity, op.id, remoteStamp);
        } else {
          // local is newer (or remote absent) → push local
          await this.writeRemote(op.entity, op.payload);
        }
        this.queue.ack(op.entity, op.id);
      } catch (err) {
        if (err instanceof Error && err.message === 'offline') sawOffline = true;
        else sawError = true;
        // leave the op queued for the next attempt
      }
    }

    this.setStatus(sawError ? 'error' : sawOffline ? 'offline' : 'synced');
  }

  // ---- remote helpers (entity dispatch) ---------------------------------
  private async findRemote(entity: OutboxEntity, id: string): Promise<unknown | null> {
    switch (entity) {
      case 'expense':   return (await this.remote.listExpenses()).find(e => e.id === id) ?? null;
      case 'category':  return (await this.remote.listCategories()).find(c => c.id === id) ?? null;
      case 'settings':  return await this.remote.getSettings();
      default:          return null; // budget/rule: F8/F6 add remote methods
    }
  }

  private async writeRemote(entity: OutboxEntity, payload: unknown): Promise<void> {
    switch (entity) {
      case 'expense':  await this.remote.upsertExpense(payload as Expense); break;
      case 'category': await this.remote.upsertCategory(payload as Category); break;
      case 'settings': await this.remote.putSettings(payload as Settings); break;
      default: break;
    }
  }

  private async writeLocal(entity: OutboxEntity, record: unknown): Promise<void> {
    switch (entity) {
      case 'expense':  await this.local.upsertExpense(record as Expense); break;
      case 'category': await this.local.upsertCategory(record as Category); break;
      case 'settings': await this.local.putSettings(record as Settings); break;
      default: break;
    }
  }

  private async applyRemoteDelete(entity: OutboxEntity, id: string, extra: { reassignTo?: string }): Promise<void> {
    switch (entity) {
      case 'expense':  await this.remote.deleteExpense(id); break;
      case 'category': await this.remote.deleteCategory(id, extra?.reassignTo); break;
      case 'settings': break; // settings is never deleted
      default: break;
    }
  }

  async pull(): Promise<void> { /* Task 7 */ }
  async sync(): Promise<void> { await this.flush(); await this.pull(); }

  // expose internals to LWW helper for Task 6/7 tests
  protected lwwStampFor(entity: OutboxEntity, id: string, record: { updatedAt?: string } | null): string | null {
    return lwwStamp(entity, id, record, this.synctimes);
  }
}
