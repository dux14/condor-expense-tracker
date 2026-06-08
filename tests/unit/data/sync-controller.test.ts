import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SyncController } from '@/lib/data/sync-controller';

function fakeRepo() {
  return {
    sync: vi.fn(async () => {}),
    flush: vi.fn(async () => {}),
    pull: vi.fn(async () => {}),
    getStatus: vi.fn(() => 'synced' as const),
    onStatus: vi.fn(() => () => {}),
  };
}

describe('SyncController', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it('start() runs an initial sync (app open)', async () => {
    const repo = fakeRepo();
    const c = new SyncController(repo as never);
    c.start();
    await vi.runOnlyPendingTimersAsync();
    expect(repo.sync).toHaveBeenCalledTimes(1);
  });

  it('focus event triggers a sync', async () => {
    const repo = fakeRepo();
    const c = new SyncController(repo as never);
    c.start();
    await vi.runOnlyPendingTimersAsync();
    repo.sync.mockClear();
    window.dispatchEvent(new Event('focus'));
    await vi.runOnlyPendingTimersAsync();
    expect(repo.sync).toHaveBeenCalledTimes(1);
  });

  it('online event triggers a sync', async () => {
    const repo = fakeRepo();
    const c = new SyncController(repo as never);
    c.start();
    await vi.runOnlyPendingTimersAsync();
    repo.sync.mockClear();
    window.dispatchEvent(new Event('online'));
    await vi.runOnlyPendingTimersAsync();
    expect(repo.sync).toHaveBeenCalledTimes(1);
  });

  it('notifyWrite() debounces a flush (multiple writes → one flush)', async () => {
    const repo = fakeRepo();
    const c = new SyncController(repo as never, { debounceMs: 500 });
    c.start();
    await vi.runOnlyPendingTimersAsync();
    repo.flush.mockClear();
    c.notifyWrite(); c.notifyWrite(); c.notifyWrite();
    await vi.advanceTimersByTimeAsync(500);
    expect(repo.flush).toHaveBeenCalledTimes(1);
  });

  it('stop() removes listeners (no further syncs on focus)', async () => {
    const repo = fakeRepo();
    const c = new SyncController(repo as never);
    c.start();
    await vi.runOnlyPendingTimersAsync();
    c.stop();
    repo.sync.mockClear();
    window.dispatchEvent(new Event('focus'));
    await vi.runOnlyPendingTimersAsync();
    expect(repo.sync).not.toHaveBeenCalled();
  });
});
