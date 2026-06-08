// Durable offline outbox (D5: outbox lives in localStorage, no Realtime).
//
// Each op is keyed by `${entity}:${dedupeId}`. Enqueueing a new op for the
// same key REPLACES the old one — the last write for a record wins, so the
// queue never grows unbounded under rapid edits and always carries the latest
// intent. A later `delete` therefore supersedes an earlier `upsert` (and v.v.)
// for the same record. `settings` is a singleton: its dedupe id is constant.
//
// The whole queue is a single JSON array under `condor:outbox`; it is read
// fresh on every operation so multiple SyncQueue instances (e.g. after a
// "reload"/re-instantiation) observe the same durable state.

export type OutboxEntity = 'expense' | 'category' | 'settings' | 'budget' | 'rule';
export type OutboxOpKind = 'upsert' | 'delete';

export interface OutboxOp {
  op: OutboxOpKind;
  entity: OutboxEntity;
  /** Record id. For `settings` (singleton) use the constant 'settings'. */
  id: string;
  /** Full record for upsert; for delete, may carry { id, reassignTo? }. */
  payload: unknown;
  /** ISO timestamp the op was enqueued — the LWW clock for entities w/o updatedAt. */
  enqueuedAt: string;
}

const OUTBOX_KEY = 'condor:outbox';

function isUnavailable(): boolean {
  return typeof window === 'undefined' || !window.localStorage;
}

/** Settings is a singleton: dedupe all settings ops onto one key. */
function dedupeId(o: Pick<OutboxOp, 'entity' | 'id'>): string {
  return o.entity === 'settings' ? `settings:singleton` : `${o.entity}:${o.id}`;
}

export class SyncQueue {
  peekAll(): OutboxOp[] {
    if (isUnavailable()) return [];
    const raw = localStorage.getItem(OUTBOX_KEY);
    if (raw === null) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as OutboxOp[]) : [];
    } catch {
      return [];
    }
  }

  private writeAll(ops: OutboxOp[]): void {
    if (isUnavailable()) return;
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(ops));
  }

  /** Enqueue, replacing any prior op for the same record (last write wins). */
  enqueue(next: OutboxOp): void {
    const key = dedupeId(next);
    const kept = this.peekAll().filter(o => dedupeId(o) !== key);
    kept.push(next);
    this.writeAll(kept);
  }

  /** Remove the op for a record once it has been flushed to remote. */
  ack(entity: OutboxEntity, id: string): void {
    const key = dedupeId({ entity, id });
    this.writeAll(this.peekAll().filter(o => dedupeId(o) !== key));
  }

  clear(): void {
    this.writeAll([]);
  }
}
