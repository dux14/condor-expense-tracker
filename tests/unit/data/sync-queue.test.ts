import { describe, it, expect, beforeEach } from 'vitest';
import { SyncQueue, type OutboxOp } from '@/lib/data/sync-queue';

function op(overrides: Partial<OutboxOp> = {}): OutboxOp {
  return {
    op: 'upsert',
    entity: 'expense',
    id: 'e1',
    payload: { id: 'e1', amount: 100 },
    enqueuedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('SyncQueue', () => {
  beforeEach(() => localStorage.clear());

  it('starts empty', () => {
    expect(new SyncQueue().peekAll()).toEqual([]);
  });

  it('enqueue persists to condor:outbox and is readable back', () => {
    const q = new SyncQueue();
    q.enqueue(op());
    expect(q.peekAll()).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem('condor:outbox')!)).toHaveLength(1);
  });

  it('survives a reload (re-instantiation reads from localStorage)', () => {
    new SyncQueue().enqueue(op({ id: 'survivor' }));
    const reloaded = new SyncQueue();
    expect(reloaded.peekAll().map(o => o.id)).toEqual(['survivor']);
  });

  it('dedupes by entity+id — the LAST op for a record wins', () => {
    const q = new SyncQueue();
    q.enqueue(op({ id: 'x', payload: { id: 'x', amount: 1 }, enqueuedAt: '2026-01-01T00:00:00.000Z' }));
    q.enqueue(op({ id: 'x', payload: { id: 'x', amount: 2 }, enqueuedAt: '2026-01-02T00:00:00.000Z' }));
    const all = q.peekAll();
    expect(all).toHaveLength(1);
    expect((all[0].payload as { amount: number }).amount).toBe(2);
    expect(all[0].enqueuedAt).toBe('2026-01-02T00:00:00.000Z');
  });

  it('a later delete supersedes an earlier upsert for the same record', () => {
    const q = new SyncQueue();
    q.enqueue(op({ id: 'd', op: 'upsert' }));
    q.enqueue(op({ id: 'd', op: 'delete', enqueuedAt: '2026-01-03T00:00:00.000Z' }));
    const all = q.peekAll();
    expect(all).toHaveLength(1);
    expect(all[0].op).toBe('delete');
  });

  it('settings dedupe collapses on the singleton key (id ignored)', () => {
    const q = new SyncQueue();
    q.enqueue(op({ entity: 'settings', id: 'settings', payload: { baseCurrency: 'COP' } }));
    q.enqueue(op({ entity: 'settings', id: 'settings', payload: { baseCurrency: 'USD' }, enqueuedAt: '2026-01-02T00:00:00.000Z' }));
    expect(q.peekAll()).toHaveLength(1);
    expect((q.peekAll()[0].payload as { baseCurrency: string }).baseCurrency).toBe('USD');
  });

  it('ack(entity,id) removes the op (idempotent)', () => {
    const q = new SyncQueue();
    q.enqueue(op({ id: 'a' }));
    q.enqueue(op({ id: 'b' }));
    q.ack('expense', 'a');
    expect(q.peekAll().map(o => o.id)).toEqual(['b']);
    q.ack('expense', 'a'); // already gone — no throw
    expect(q.peekAll()).toHaveLength(1);
  });

  it('clear empties the queue and the storage key', () => {
    const q = new SyncQueue();
    q.enqueue(op());
    q.clear();
    expect(q.peekAll()).toEqual([]);
    expect(localStorage.getItem('condor:outbox')).toBe('[]');
  });

  it('corrupted JSON in condor:outbox → peekAll returns []', () => {
    localStorage.setItem('condor:outbox', '{ BROKEN');
    expect(new SyncQueue().peekAll()).toEqual([]);
  });
});
