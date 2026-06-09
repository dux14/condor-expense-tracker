// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { wipeLocalCache } from '@/lib/data/wipe-local-cache';

// Realistic condor:* data caches (NOT lock keys). Includes condor:fxcache —
// previously MISSED by the old allowlist — plus an intentionally-unlisted
// future key to prove the prefix-sweep is drift-proof.
const DATA_KEYS = [
  'condor:expenses',
  'condor:categories',
  'condor:settings',
  'condor:imported',
  'condor:outbox',
  'condor:rules',
  'condor:budgets',
  'condor:synctimes',
  'condor:tombstones',
  'condor:fxcache',
  'condor:somethingnew', // drift guard: an allowlist would never catch this
];

// Device-local app-lock keys that MUST survive an explicit sign-out.
const LOCK_KEYS = ['condor:lock', 'condor:lock:attempts'];

// A non-condor key that must NEVER be touched.
const FOREIGN_KEY = 'unrelated:x';

describe('wipeLocalCache', () => {
  beforeEach(() => {
    localStorage.clear();
    for (const k of [...DATA_KEYS, ...LOCK_KEYS, FOREIGN_KEY]) {
      localStorage.setItem(k, JSON.stringify({ seeded: k }));
    }
  });

  it('Case A — default (keepLock): removes ALL condor:* data keys (incl. fxcache + future keys), preserves lock, leaves foreign keys alone', () => {
    wipeLocalCache();

    // Every data cache gone — including the previously-missed fxcache and an
    // unlisted future key (this is the drift guard a re-declared allowlist
    // could never prove).
    for (const k of DATA_KEYS) {
      expect(localStorage.getItem(k), `${k} should be removed`).toBeNull();
    }

    // Lock config preserved (binding policy: sign-out keeps the device lock).
    expect(localStorage.getItem('condor:lock')).toBe(
      JSON.stringify({ seeded: 'condor:lock' }),
    );
    expect(localStorage.getItem('condor:lock:attempts')).toBe(
      JSON.stringify({ seeded: 'condor:lock:attempts' }),
    );

    // Non-condor key untouched.
    expect(localStorage.getItem(FOREIGN_KEY)).toBe(
      JSON.stringify({ seeded: FOREIGN_KEY }),
    );
  });

  it('Case B — keepLock:false (account deletion): ALSO removes the lock keys, still leaves foreign keys alone', () => {
    wipeLocalCache({ keepLock: false });

    for (const k of [...DATA_KEYS, ...LOCK_KEYS]) {
      expect(localStorage.getItem(k), `${k} should be removed`).toBeNull();
    }

    // Non-condor key still untouched.
    expect(localStorage.getItem(FOREIGN_KEY)).toBe(
      JSON.stringify({ seeded: FOREIGN_KEY }),
    );
  });

  it('is a no-op (does not throw) when called twice', () => {
    wipeLocalCache();
    expect(() => wipeLocalCache()).not.toThrow();
    for (const k of LOCK_KEYS) {
      expect(localStorage.getItem(k)).not.toBeNull();
    }
  });
});
