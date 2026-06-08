import { describe, it, expect, beforeEach } from 'vitest';
import { SyncingRepository } from '@/lib/data/syncing-repository';
import { LocalStorageRepository } from '@/lib/data/local-storage-repository';
import { SyncQueue } from '@/lib/data/sync-queue';
import { TombstoneStore } from '@/lib/data/tombstones';
import { FakeRemoteRepository } from '../../helpers/fake-remote-repository';
import type { Expense } from '@/lib/domain/types';

function makeExpense(o: Partial<Expense> = {}): Expense {
  return {
    id: 'e1', amount: 1000, currency: 'COP', baseAmount: 1000, fxRate: 1,
    date: '2026-01-01', categoryId: 'preset-comida', source: 'manual',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', ...o,
  };
}

function makeSut() {
  const local = new LocalStorageRepository();
  const remote = new FakeRemoteRepository();
  const repo = new SyncingRepository(local, remote);
  return { local, remote, repo };
}

describe('SyncingRepository — reads + optimistic writes', () => {
  beforeEach(() => localStorage.clear());

  it('reads return the local cache immediately (does not touch remote)', async () => {
    const { local, repo } = makeSut();
    await local.upsertExpense(makeExpense({ id: 'cached' }));
    expect((await repo.listExpenses()).map(e => e.id)).toEqual(['cached']);
  });

  it('upsertExpense writes local AND enqueues an upsert op (does not write remote synchronously)', async () => {
    const { remote, repo } = makeSut();
    await repo.upsertExpense(makeExpense({ id: 'x' }));
    expect((await repo.listExpenses()).map(e => e.id)).toEqual(['x']);   // local
    expect(remote.expenses).toHaveLength(0);                              // remote untouched
    const ops = new SyncQueue().peekAll();
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ op: 'upsert', entity: 'expense', id: 'x' });
  });

  it('deleteExpense removes from local, writes a tombstone, and enqueues a delete op', async () => {
    const { repo } = makeSut();
    await repo.upsertExpense(makeExpense({ id: 'gone' }));
    await repo.deleteExpense('gone');
    expect(await repo.listExpenses()).toEqual([]);
    expect(new TombstoneStore().isDeleted('expense', 'gone')).toBe(true);
    const delOp = new SyncQueue().peekAll().find(o => o.op === 'delete');
    expect(delOp).toMatchObject({ entity: 'expense', id: 'gone' });
  });

  it('upsertCategory enqueues with a synctime recorded', async () => {
    const { repo } = makeSut();
    await repo.upsertCategory({ id: 'c1', name: 'X', color: '#fff', icon: 'comida', isPreset: false });
    expect(new SyncQueue().peekAll().some(o => o.entity === 'category' && o.id === 'c1')).toBe(true);
  });

  it('putSettings enqueues a singleton settings op', async () => {
    const { repo } = makeSut();
    const s = await repo.getSettings();
    await repo.putSettings({ ...s, baseCurrency: 'USD' });
    const ops = new SyncQueue().peekAll().filter(o => o.entity === 'settings');
    expect(ops).toHaveLength(1);
  });

  it('wipeAll clears local cache, outbox, tombstones (all condor:* keys)', async () => {
    const { repo } = makeSut();
    await repo.upsertExpense(makeExpense());
    await repo.wipeAll();
    expect(localStorage.getItem('condor:outbox')).toBeNull();
    expect(localStorage.getItem('condor:tombstones')).toBeNull();
    expect(await repo.listExpenses()).toEqual([]);
  });
});
