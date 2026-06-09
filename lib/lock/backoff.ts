// Device-local, persistent attempt backoff for the app-lock.
//
// Throttling MUST survive a PWA reload: with in-memory state alone, an attacker
// holding the device could reload to reset the counter and brute-force a 4-digit
// PIN (10k space) at no cost. State is therefore persisted to localStorage and
// read fresh on every call. No secret leaves the device.

export const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 30_000;
// Deliberately a separate key from lock-config's 'condor:lock': disabling the
// app-lock must NOT also reset an active brute-force lockout.
const KEY = 'condor:lock:attempts';

interface BackoffState {
  failed: number;
  lockedUntil: number; // epoch ms; 0 when not locked
}

export interface BackoffStatus {
  lockedOut: boolean;
  retryAfterMs: number;
}

function unavailable(): boolean {
  return typeof window === 'undefined' || !window.localStorage;
}

function defaultState(): BackoffState {
  return { failed: 0, lockedUntil: 0 };
}

function read(): BackoffState {
  if (unavailable()) return defaultState();
  const raw = localStorage.getItem(KEY);
  if (raw === null) return defaultState();
  try {
    const parsed = JSON.parse(raw) as Partial<BackoffState>;
    return { ...defaultState(), ...parsed };
  } catch {
    return defaultState();
  }
}

function write(state: BackoffState): void {
  if (unavailable()) return;
  localStorage.setItem(KEY, JSON.stringify(state));
}

/**
 * Reads persisted state; reports whether a lockout window is currently active.
 * The window is wall-clock-based (Date.now); it self-heals on the next call, so
 * a clock adjustment can at most shorten/lengthen one 30s window — never lock forever.
 */
export function isLockedOut(): BackoffStatus {
  const { lockedUntil } = read();
  const now = Date.now();
  if (now < lockedUntil) {
    return { lockedOut: true, retryAfterMs: lockedUntil - now };
  }
  return { lockedOut: false, retryAfterMs: 0 };
}

/**
 * Records a failed unlock attempt. On reaching MAX_ATTEMPTS, opens a fresh
 * lockout window and resets the counter so the next batch of failures re-locks.
 */
export function registerFailedAttempt(): BackoffStatus {
  const state = read();
  const failed = state.failed + 1;
  if (failed >= MAX_ATTEMPTS) {
    write({ failed: 0, lockedUntil: Date.now() + LOCKOUT_MS });
  } else {
    write({ failed, lockedUntil: state.lockedUntil });
  }
  return isLockedOut();
}

/** Clears all backoff state. Call on a successful unlock. */
export function resetAttempts(): void {
  if (unavailable()) return;
  localStorage.removeItem(KEY);
}
