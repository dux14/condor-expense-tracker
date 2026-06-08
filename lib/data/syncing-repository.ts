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
  async flush(): Promise<void> { /* Task 6 */ }
  async pull(): Promise<void> { /* Task 7 */ }
  async sync(): Promise<void> { await this.flush(); await this.pull(); }

  // expose internals to LWW helper for Task 6/7 tests
  protected lwwStampFor(entity: OutboxEntity, id: string, record: { updatedAt?: string } | null): string | null {
    return lwwStamp(entity, id, record, this.synctimes);
  }
}
