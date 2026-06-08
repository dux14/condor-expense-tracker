import { describe, it, expect, beforeEach } from 'vitest';
import { SyncTimeStore } from '@/lib/data/synctimes';

describe('SyncTimeStore', () => {
  beforeEach(() => localStorage.clear());

  it('get on unknown key returns null', () => {
    expect(new SyncTimeStore().get('category', 'c1')).toBeNull();
  });

  it('set/get round-trips and survives reload', () => {
    new SyncTimeStore().set('category', 'c1', '2026-01-02T00:00:00.000Z');
    expect(new SyncTimeStore().get('category', 'c1')).toBe('2026-01-02T00:00:00.000Z');
  });

  it('settings collapses to the singleton key', () => {
    const s = new SyncTimeStore();
    s.set('settings', 'anything', '2026-01-03T00:00:00.000Z');
    expect(s.get('settings', 'ignored')).toBe('2026-01-03T00:00:00.000Z');
  });

  it('corrupted JSON → get returns null', () => {
    localStorage.setItem('condor:synctimes', 'X{');
    expect(new SyncTimeStore().get('category', 'c1')).toBeNull();
  });
});
