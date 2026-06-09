// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { registerFailedAttempt, isLockedOut, resetAttempts, MAX_ATTEMPTS } from '@/lib/lock/backoff';

beforeEach(() => { localStorage.clear(); resetAttempts(); });

describe('app-lock attempt backoff (persistent)', () => {
  it('locks out after MAX_ATTEMPTS consecutive failures', () => {
    for (let i = 0; i < MAX_ATTEMPTS; i++) registerFailedAttempt();
    const s = isLockedOut();
    expect(s.lockedOut).toBe(true);
    expect(s.retryAfterMs).toBeGreaterThan(0);
  });
  it('a successful unlock (resetAttempts) clears the counter', () => {
    registerFailedAttempt(); registerFailedAttempt();
    resetAttempts();
    expect(isLockedOut().lockedOut).toBe(false);
  });
  it('lockout SURVIVES a reload (state is read fresh from localStorage, not memory)', () => {
    for (let i = 0; i < MAX_ATTEMPTS; i++) registerFailedAttempt();
    // Simulate a reload: a brand-new read of persisted state must still report locked.
    // (Do NOT call resetAttempts.) isLockedOut() reads localStorage each call.
    expect(isLockedOut().lockedOut).toBe(true);
    expect(localStorage.getItem('condor:lock:attempts')).not.toBeNull();
  });
});
