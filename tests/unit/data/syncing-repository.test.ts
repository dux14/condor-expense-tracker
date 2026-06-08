import { describe, it, expect, beforeEach } from 'vitest';
import { SyncingRepository } from '@/lib/data/syncing-repository';
import { LocalStorageRepository } from '@/lib/data/local-storage-repository';
import { SyncQueue } from '@/lib/data/sync-queue';
import { TombstoneStore } from '@/lib/data/tombstones';
import { FakeRemoteRepository, offlineGate } from '../../helpers/fake-remote-repository';
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

describe('SyncingRepository.flush — outbox drain + LWW', () => {
  beforeEach(() => localStorage.clear());

  it('offline add → flush after reconnect pushes to remote and clears the op', async () => {
    const local = new LocalStorageRepository();
    const remote = new FakeRemoteRepository();
    const { repo: gated, setOnline } = offlineGate(remote);
    const sut = new SyncingRepository(local, gated);

    setOnline(false);
    await sut.upsertExpense(makeExpense({ id: 'pending' }));
    await sut.flush();                              // offline → stays queued, status offline
    expect(remote.expenses).toHaveLength(0);
    expect(new SyncQueue().peekAll()).toHaveLength(1);
    expect(sut.getStatus()).toBe('offline');

    setOnline(true);
    await sut.flush();                              // online → pushes
    expect(remote.expenses.map(e => e.id)).toEqual(['pending']);
    expect(new SyncQueue().peekAll()).toHaveLength(0);
    expect(sut.getStatus()).toBe('synced');
  });

  it('LWW: if remote has a NEWER updatedAt, remote wins and local is updated', async () => {
    const local = new LocalStorageRepository();
    const remote = new FakeRemoteRepository();
    const sut = new SyncingRepository(local, remote);

    // remote already has a newer version of e1
    remote.expenses.push(makeExpense({ id: 'e1', amount: 999, updatedAt: '2026-02-01T00:00:00.000Z' }));
    // local enqueues an OLDER write
    await sut.upsertExpense(makeExpense({ id: 'e1', amount: 100, updatedAt: '2026-01-01T00:00:00.000Z' }));

    await sut.flush();

    // remote kept its newer value; local was reconciled to it
    expect(remote.expenses.find(e => e.id === 'e1')!.amount).toBe(999);
    expect((await sut.listExpenses()).find(e => e.id === 'e1')!.amount).toBe(999);
    expect(new SyncQueue().peekAll()).toHaveLength(0);
  });

  it('LWW: if local is NEWER, local op wins and overwrites remote', async () => {
    const local = new LocalStorageRepository();
    const remote = new FakeRemoteRepository();
    const sut = new SyncingRepository(local, remote);
    remote.expenses.push(makeExpense({ id: 'e1', amount: 1, updatedAt: '2026-01-01T00:00:00.000Z' }));
    await sut.upsertExpense(makeExpense({ id: 'e1', amount: 555, updatedAt: '2026-03-01T00:00:00.000Z' }));
    await sut.flush();
    expect(remote.expenses.find(e => e.id === 'e1')!.amount).toBe(555);
  });

  it('flush of a delete op removes the remote row and keeps the tombstone until pull confirms', async () => {
    const local = new LocalStorageRepository();
    const remote = new FakeRemoteRepository();
    const sut = new SyncingRepository(local, remote);
    remote.expenses.push(makeExpense({ id: 'del' }));
    await local.upsertExpense(makeExpense({ id: 'del' }));
    await sut.deleteExpense('del');
    await sut.flush();
    expect(remote.expenses).toHaveLength(0);
    expect(new SyncQueue().peekAll()).toHaveLength(0);
    expect(new TombstoneStore().isDeleted('expense', 'del')).toBe(true); // cleared by pull, not flush
  });

  it('a failing remote write sets status=error and leaves the op queued', async () => {
    const local = new LocalStorageRepository();
    const remote = new FakeRemoteRepository();
    remote.upsertExpense = async () => { throw new Error('boom'); };
    const sut = new SyncingRepository(local, remote);
    await sut.upsertExpense(makeExpense({ id: 'e1' }));
    await sut.flush();
    expect(sut.getStatus()).toBe('error');
    expect(new SyncQueue().peekAll()).toHaveLength(1);
  });
});

describe('SyncingRepository.pull — reconcile + tombstones', () => {
  beforeEach(() => localStorage.clear());

  it('pull brings new remote rows into local', async () => {
    const local = new LocalStorageRepository();
    const remote = new FakeRemoteRepository();
    const sut = new SyncingRepository(local, remote);
    remote.expenses.push(makeExpense({ id: 'fromRemote', amount: 42 }));
    await sut.pull();
    expect((await sut.listExpenses()).map(e => e.id)).toContain('fromRemote');
  });

  it('pull does NOT resurrect a tombstoned record (anti-resurrection)', async () => {
    const local = new LocalStorageRepository();
    const remote = new FakeRemoteRepository();
    const sut = new SyncingRepository(local, remote);
    await local.upsertExpense(makeExpense({ id: 'ghost' }));
    await sut.deleteExpense('ghost');                    // tombstone, local gone
    remote.expenses.push(makeExpense({ id: 'ghost' }));  // stale remote copy (older than tombstone)
    await sut.pull();
    expect((await sut.listExpenses()).find(e => e.id === 'ghost')).toBeUndefined();
  });

  it('pull: a remote update NEWER than the tombstone wins (legit re-create restores the row)', async () => {
    const local = new LocalStorageRepository();
    const remote = new FakeRemoteRepository();
    const sut = new SyncingRepository(local, remote);
    await local.upsertExpense(makeExpense({ id: 're', updatedAt: '2026-01-01T00:00:00.000Z' }));
    await sut.deleteExpense('re');                       // tombstone at ~now (> jan-1)
    // remote has a version updated AFTER our delete:
    remote.expenses.push(makeExpense({ id: 're', amount: 7, updatedAt: '2999-01-01T00:00:00.000Z' }));
    await sut.pull();
    const got = (await sut.listExpenses()).find(e => e.id === 're');
    expect(got?.amount).toBe(7);
    expect(new TombstoneStore().isDeleted('expense', 're')).toBe(false); // dropped
  });

  it('two clients against one remote converge (last writer wins)', async () => {
    const remote = new FakeRemoteRepository();
    const localA = new LocalStorageRepository();
    const a = new SyncingRepository(localA, remote);

    // client A writes, syncs
    await a.upsertExpense(makeExpense({ id: 'shared', amount: 1, updatedAt: '2026-01-01T00:00:00.000Z' }));
    await a.sync();

    // simulate client B on a SEPARATE localStorage namespace is not possible in one jsdom;
    // instead clear local + re-pull to model device B starting from the shared remote.
    localStorage.clear();
    const localB = new LocalStorageRepository();
    const b = new SyncingRepository(localB, remote);
    await b.pull();
    expect((await b.listExpenses()).find(e => e.id === 'shared')!.amount).toBe(1);

    // B updates newer, syncs; A pulls and converges
    await b.upsertExpense(makeExpense({ id: 'shared', amount: 2, updatedAt: '2026-05-01T00:00:00.000Z' }));
    await b.sync();
    await a.pull();
    expect((await a.listExpenses()).find(e => e.id === 'shared')!.amount).toBe(2);
  });

  it('durability: ops survive a "reload" (new SyncingRepository over same localStorage) then flush', async () => {
    const remote = new FakeRemoteRepository();
    const { repo: gated, setOnline } = offlineGate(remote);
    setOnline(false);
    const first = new SyncingRepository(new LocalStorageRepository(), gated);
    await first.upsertExpense(makeExpense({ id: 'durable' }));
    // "reload": brand new instances, same localStorage-backed queue
    setOnline(true);
    const revived = new SyncingRepository(new LocalStorageRepository(), gated);
    await revived.flush();
    expect(remote.expenses.map(e => e.id)).toEqual(['durable']);
  });
});
