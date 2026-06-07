import type { PinHash } from './pin';

export const DEFAULT_TIMEOUT_MIN = 5;
export const TIMEOUT_OPTIONS = [1, 2, 5, 10, 15, 30] as const;
const KEY = 'condor:lock';

export interface LockConfig {
  enabled: boolean;
  timeoutMinutes: number;
  pin: PinHash | null;
  webauthnCredentialId: string | null; // base64 credential id, null if biometric not set up
}

export function defaultLockConfig(): LockConfig {
  return { enabled: false, timeoutMinutes: DEFAULT_TIMEOUT_MIN, pin: null, webauthnCredentialId: null };
}

function unavailable(): boolean {
  return typeof window === 'undefined' || !window.localStorage;
}

export function loadLockConfig(): LockConfig {
  if (unavailable()) return defaultLockConfig();
  const raw = localStorage.getItem(KEY);
  if (raw === null) return defaultLockConfig();
  try {
    const parsed = JSON.parse(raw) as Partial<LockConfig>;
    return { ...defaultLockConfig(), ...parsed };
  } catch {
    return defaultLockConfig();
  }
}

export function saveLockConfig(cfg: LockConfig): void {
  if (unavailable()) return;
  localStorage.setItem(KEY, JSON.stringify(cfg));
}

export function clearLockConfig(): void {
  if (unavailable()) return;
  localStorage.removeItem(KEY);
}
