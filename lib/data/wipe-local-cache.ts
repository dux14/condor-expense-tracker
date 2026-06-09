// Device-local cache wipe for explicit sign-out (and account deletion).
// Prefix-sweep (denylist) so any future condor:* cache key is removed automatically —
// an allowlist would silently leave new caches behind on a shared device.
const LOCK_KEYS = ['condor:lock', 'condor:lock:attempts'];

function unavailable(): boolean {
  return typeof window === 'undefined' || !window.localStorage;
}

/**
 * Removes the signed-in user's local data caches.
 * @param opts.keepLock when true (default) preserves device-local app-lock config
 *   (explicit sign-out keeps the legit user's lock); pass false on account deletion.
 */
export function wipeLocalCache(opts: { keepLock?: boolean } = {}): void {
  if (unavailable()) return;
  const keepLock = opts.keepLock ?? true;
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key === null || !key.startsWith('condor:')) continue;
    if (keepLock && LOCK_KEYS.includes(key)) continue;
    toRemove.push(key);
  }
  for (const key of toRemove) localStorage.removeItem(key);
}
