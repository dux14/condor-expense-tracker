// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerPlatformCredential, authenticateWithBiometric } from '@/lib/lock/webauthn';

// jsdom does not implement WebCrypto's getRandomValues; both ceremonies need it.
beforeEach(() => {
  vi.restoreAllMocks();
  if (typeof globalThis.crypto === 'undefined' || typeof globalThis.crypto.getRandomValues !== 'function') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).crypto = {
      getRandomValues: (arr: Uint8Array) => arr,
    };
  }
});

describe('WebAuthn user-verification gates', () => {
  it('register demands platform authenticator + user verification', async () => {
    const create = vi.fn().mockResolvedValue({ rawId: new ArrayBuffer(16) });
    // @ts-expect-error test stub
    globalThis.navigator.credentials = { create, get: vi.fn() };
    await registerPlatformCredential();
    const opts = create.mock.calls[0][0].publicKey.authenticatorSelection;
    expect(opts.userVerification).toBe('required');
    expect(opts.authenticatorAttachment).toBe('platform');
  });

  it('assertion demands user verification', async () => {
    const get = vi.fn().mockResolvedValue({});
    // @ts-expect-error test stub
    globalThis.navigator.credentials = { create: vi.fn(), get };
    await authenticateWithBiometric(btoa('cred-id'));
    expect(get.mock.calls[0][0].publicKey.userVerification).toBe('required');
  });
});
