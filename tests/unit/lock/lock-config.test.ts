import { describe, it, expect, beforeEach } from 'vitest'
import {
  loadLockConfig,
  saveLockConfig,
  clearLockConfig,
  DEFAULT_TIMEOUT_MIN,
  type LockConfig,
} from '@/lib/lock/lock-config'
import type { PinHash } from '@/lib/lock/pin'

const PIN: PinHash = {
  algo: 'PBKDF2-SHA256',
  iterations: 210_000,
  salt: 'c2FsdA==',
  hash: 'aGFzaA==',
}

describe('lock-config persistence', () => {
  beforeEach(() => localStorage.clear())

  it('returns a disabled default when nothing is stored', () => {
    const cfg = loadLockConfig()
    expect(cfg.enabled).toBe(false)
    expect(cfg.timeoutMinutes).toBe(DEFAULT_TIMEOUT_MIN)
    expect(cfg.pin).toBeNull()
    expect(cfg.webauthnCredentialId).toBeNull()
  })

  it('round-trips a full config under condor:lock', () => {
    const cfg: LockConfig = {
      enabled: true,
      timeoutMinutes: 5,
      pin: PIN,
      webauthnCredentialId: 'Y3JlZA==',
    }
    saveLockConfig(cfg)
    expect(localStorage.getItem('condor:lock')).not.toBeNull()
    expect(loadLockConfig()).toEqual(cfg)
  })

  it('clear removes the key and reverts to default', () => {
    saveLockConfig({ enabled: true, timeoutMinutes: 10, pin: PIN, webauthnCredentialId: null })
    clearLockConfig()
    expect(localStorage.getItem('condor:lock')).toBeNull()
    expect(loadLockConfig().enabled).toBe(false)
  })

  it('tolerates corrupt JSON by returning the default', () => {
    localStorage.setItem('condor:lock', '{not json')
    expect(loadLockConfig().enabled).toBe(false)
  })

  it('default timeout is 5 minutes', () => {
    expect(DEFAULT_TIMEOUT_MIN).toBe(5)
  })
})
