import { describe, it, expect, beforeEach } from 'vitest';
import { TombstoneStore } from '@/lib/data/tombstones';

describe('TombstoneStore', () => {
  beforeEach(() => localStorage.clear());

  it('starts empty', () => {
    expect(new TombstoneStore().all()).toEqual([]);
  });

  it('add persists and isDeleted reports true', () => {
    const t = new TombstoneStore();
    t.add('expense', 'e1', '2026-01-01T00:00:00.000Z');
    expect(t.isDeleted('expense', 'e1')).toBe(true);
    expect(t.isDeleted('expense', 'other')).toBe(false);
  });

  it('survives reload', () => {
    new TombstoneStore().add('category', 'c1', '2026-01-01T00:00:00.000Z');
    expect(new TombstoneStore().isDeleted('category', 'c1')).toBe(true);
  });

  it('deletedAt returns the recorded timestamp', () => {
    const t = new TombstoneStore();
    t.add('expense', 'e1', '2026-01-05T00:00:00.000Z');
    expect(t.deletedAt('expense', 'e1')).toBe('2026-01-05T00:00:00.000Z');
    expect(t.deletedAt('expense', 'nope')).toBeNull();
  });

  it('remove clears a tombstone', () => {
    const t = new TombstoneStore();
    t.add('expense', 'e1', '2026-01-01T00:00:00.000Z');
    t.remove('expense', 'e1');
    expect(t.isDeleted('expense', 'e1')).toBe(false);
  });

  it('corrupted JSON → all() returns []', () => {
    localStorage.setItem('condor:tombstones', 'BROKEN{');
    expect(new TombstoneStore().all()).toEqual([]);
  });
});
