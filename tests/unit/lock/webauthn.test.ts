import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  isBiometricAvailable,
  registerPlatformCredential,
  authenticateWithBiometric,
} from '@/lib/lock/webauthn'

function b64(bytes: number[]): string {
  let bin = ''
  for (const x of bytes) bin += String.fromCharCode(x)
  return btoa(bin)
}

describe('isBiometricAvailable', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it('false when PublicKeyCredential is undefined', async () => {
    vi.stubGlobal('PublicKeyCredential', undefined)
    expect(await isBiometricAvailable()).toBe(false)
  })

  it('true when isUserVerifyingPlatformAuthenticatorAvailable resolves true', async () => {
    vi.stubGlobal('PublicKeyCredential', {
      isUserVerifyingPlatformAuthenticatorAvailable: () => Promise.resolve(true),
    })
    expect(await isBiometricAvailable()).toBe(true)
  })

  it('false when UVPA check resolves false', async () => {
    vi.stubGlobal('PublicKeyCredential', {
      isUserVerifyingPlatformAuthenticatorAvailable: () => Promise.resolve(false),
    })
    expect(await isBiometricAvailable()).toBe(false)
  })
})

describe('registerPlatformCredential', () => {
  beforeEach(() => {
    vi.stubGlobal('PublicKeyCredential', {
      isUserVerifyingPlatformAuthenticatorAvailable: () => Promise.resolve(true),
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('returns the base64 credential id and requests a platform authenticator with UV required', async () => {
    const rawId = new Uint8Array([1, 2, 3, 4]).buffer
    const create = vi.fn().mockResolvedValue({ rawId })
    vi.stubGlobal('navigator', { credentials: { create } })

    const id = await registerPlatformCredential()
    expect(id).toBe(b64([1, 2, 3, 4]))

    const opts = create.mock.calls[0][0].publicKey
    expect(opts.authenticatorSelection.authenticatorAttachment).toBe('platform')
    expect(opts.authenticatorSelection.userVerification).toBe('required')
    expect(opts.challenge).toBeInstanceOf(Uint8Array)
    expect(opts.challenge.byteLength).toBeGreaterThanOrEqual(16)
  })

  it('returns null when the user cancels (create rejects)', async () => {
    const create = vi.fn().mockRejectedValue(new DOMException('cancelled', 'NotAllowedError'))
    vi.stubGlobal('navigator', { credentials: { create } })
    expect(await registerPlatformCredential()).toBeNull()
  })
})

describe('authenticateWithBiometric', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('resolves true when get() returns an assertion for the stored credential', async () => {
    const get = vi.fn().mockResolvedValue({ rawId: new Uint8Array([1, 2, 3, 4]).buffer })
    vi.stubGlobal('navigator', { credentials: { get } })

    const ok = await authenticateWithBiometric(b64([1, 2, 3, 4]))
    expect(ok).toBe(true)

    const opts = get.mock.calls[0][0].publicKey
    expect(opts.userVerification).toBe('required')
    expect(opts.allowCredentials[0].type).toBe('public-key')
  })

  it('resolves false when get() rejects (user cancel / failure)', async () => {
    const get = vi.fn().mockRejectedValue(new DOMException('x', 'NotAllowedError'))
    vi.stubGlobal('navigator', { credentials: { get } })
    expect(await authenticateWithBiometric(b64([9, 9]))).toBe(false)
  })
})
