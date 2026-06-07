import { describe, it, expect } from 'vitest'
import { hashPin, verifyPin, isValidPin, type PinHash } from '@/lib/lock/pin'

describe('isValidPin', () => {
  it('accepts 4 to 6 digit strings', () => {
    expect(isValidPin('1234')).toBe(true)
    expect(isValidPin('123456')).toBe(true)
  })
  it('rejects too short, too long, and non-digits', () => {
    expect(isValidPin('123')).toBe(false)
    expect(isValidPin('1234567')).toBe(false)
    expect(isValidPin('12a4')).toBe(false)
    expect(isValidPin('')).toBe(false)
  })
})

describe('hashPin / verifyPin', () => {
  it('produces a hash that verifies against the original PIN', async () => {
    const h = await hashPin('1234')
    expect(await verifyPin('1234', h)).toBe(true)
  })

  it('rejects a wrong PIN', async () => {
    const h = await hashPin('1234')
    expect(await verifyPin('9999', h)).toBe(false)
  })

  it('uses a random salt: same PIN hashed twice differs', async () => {
    const a = await hashPin('1234')
    const b = await hashPin('1234')
    expect(a.salt).not.toBe(b.salt)
    expect(a.hash).not.toBe(b.hash)
    // both still verify
    expect(await verifyPin('1234', a)).toBe(true)
    expect(await verifyPin('1234', b)).toBe(true)
  })

  it('records the iteration count (>= 210000) and algorithm', async () => {
    const h: PinHash = await hashPin('1234')
    expect(h.iterations).toBeGreaterThanOrEqual(210_000)
    expect(h.algo).toBe('PBKDF2-SHA256')
  })

  it('verify honours the iteration count stored in the hash', async () => {
    // forward-compat: verifyPin must re-derive with stored.iterations, not a constant.
    // Tampering with the count changes the derivation, so the correct PIN must fail.
    const h = await hashPin('1234')
    expect(await verifyPin('1234', h)).toBe(true)
    const wrongIterations = { ...h, iterations: h.iterations + 10_000 }
    expect(await verifyPin('1234', wrongIterations)).toBe(false)
  })
})
