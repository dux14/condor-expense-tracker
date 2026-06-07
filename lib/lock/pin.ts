// Device-local PIN hashing. PBKDF2 (Web Crypto), random salt, SHA-256.
// No secret leaves the device; this is the offline fallback for the app-lock.

const ITERATIONS = 210_000;
const HASH_BITS = 256;
const SALT_BYTES = 16;

export interface PinHash {
  algo: 'PBKDF2-SHA256';
  iterations: number;
  salt: string; // base64
  hash: string; // base64
}

export function isValidPin(pin: string): boolean {
  return /^\d{4,6}$/.test(pin);
}

function toBase64(bytes: Uint8Array): string {
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

async function derive(pin: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(pin),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    keyMaterial,
    HASH_BITS,
  );
  return new Uint8Array(bits);
}

export async function hashPin(pin: string): Promise<PinHash> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const derived = await derive(pin, salt, ITERATIONS);
  return {
    algo: 'PBKDF2-SHA256',
    iterations: ITERATIONS,
    salt: toBase64(salt),
    hash: toBase64(derived),
  };
}

// Constant-time-ish comparison over equal-length base64-decoded buffers.
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function verifyPin(pin: string, stored: PinHash): Promise<boolean> {
  const salt = fromBase64(stored.salt);
  const derived = await derive(pin, salt, stored.iterations);
  return timingSafeEqual(derived, fromBase64(stored.hash));
}
