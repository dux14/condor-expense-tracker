// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { hashPin, verifyPin } from '@/lib/lock/pin';

describe('PIN hashing (PBKDF2)', () => {
  it('uses >= 100k iterations and PBKDF2-SHA256', async () => {
    const h = await hashPin('1234');
    expect(h.iterations).toBeGreaterThanOrEqual(100_000);
    expect(h.algo).toBe('PBKDF2-SHA256');
  });
  it('salts: same PIN hashed twice yields different salt AND derived hash', async () => {
    const a = await hashPin('1234');
    const b = await hashPin('1234');
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
  });
  it('verifies the correct PIN and rejects a wrong one', async () => {
    const stored = await hashPin('1234');
    expect(await verifyPin('1234', stored)).toBe(true);
    expect(await verifyPin('0000', stored)).toBe(false);
  });
});
