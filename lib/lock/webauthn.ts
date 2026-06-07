// Local WebAuthn user-verification gate. NO relying-party server: the challenge
// is generated client-side and the assertion is not cryptographically verified
// against a backend. This is a presence/UV gate against physical device access,
// NOT a confidentiality boundary (that is Supabase RLS, server-side). No secrets
// are stored in the credential — largeBlob/prf are intentionally unused.

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function isBiometricAvailable(): Promise<boolean> {
  try {
    if (typeof PublicKeyCredential === 'undefined') return false;
    if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') {
      return false;
    }
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/** Registers a local platform credential. Returns its base64 id, or null on cancel/failure. */
export async function registerPlatformCredential(): Promise<string | null> {
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userId = crypto.getRandomValues(new Uint8Array(16));
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge: challenge as BufferSource,
        rp: { name: 'Cóndor', id: window.location.hostname },
        user: { id: userId as BufferSource, name: 'condor-local', displayName: 'Cóndor' },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },   // ES256
          { type: 'public-key', alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'discouraged',
        },
        timeout: 60_000,
        attestation: 'none',
      },
    })) as PublicKeyCredential | null;
    if (!cred) return null;
    return toBase64(cred.rawId);
  } catch {
    return null;
  }
}

/** Re-presents the stored credential for a UV assertion. Returns true on success. */
export async function authenticateWithBiometric(credentialIdB64: string): Promise<boolean> {
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: challenge as BufferSource,
        rpId: window.location.hostname,
        allowCredentials: [
          { type: 'public-key', id: fromBase64(credentialIdB64) as BufferSource },
        ],
        userVerification: 'required',
        timeout: 60_000,
      },
    });
    return assertion !== null;
  } catch {
    return false;
  }
}
