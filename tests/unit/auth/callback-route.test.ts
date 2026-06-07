// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.mock is hoisted — cannot reference variables declared outside the factory.
// Use vi.hoisted() to create the mock fn before hoisting occurs.
const exchangeCodeForSession = vi.hoisted(() => vi.fn());

vi.mock('@/lib/auth/supabase-server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { exchangeCodeForSession },
  }),
}));

import { GET } from '@/app/auth/callback/route';

const ORIGIN = 'http://localhost:3100';

function req(path: string) {
  return new Request(`${ORIGIN}${path}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  exchangeCodeForSession.mockResolvedValue({ error: null });
});

describe('GET /auth/callback — open-redirect sanitization', () => {
  it('valid code + no next → 307 to /', async () => {
    const res = await GET(req('/auth/callback?code=abc'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(`${ORIGIN}/`);
  });

  it('valid code + next=/historico → redirects to origin/historico', async () => {
    const res = await GET(req('/auth/callback?code=abc&next=/historico'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(`${ORIGIN}/historico`);
  });

  it('valid code + next=@evil.com → stays on origin, NOT evil.com', async () => {
    const res = await GET(req('/auth/callback?code=abc&next=@evil.com'));
    const location = res.headers.get('location')!;
    const locationUrl = new URL(location);
    expect(locationUrl.origin).toBe(ORIGIN);
    expect(locationUrl.host).not.toBe('evil.com');
  });

  it('valid code + next=//evil.com → stays on origin', async () => {
    const res = await GET(req('/auth/callback?code=abc&next=//evil.com'));
    const location = res.headers.get('location')!;
    const locationUrl = new URL(location);
    expect(locationUrl.origin).toBe(ORIGIN);
    expect(locationUrl.host).not.toBe('evil.com');
  });

  it('valid code + next=https://evil.com → stays on origin', async () => {
    const res = await GET(req('/auth/callback?code=abc&next=https://evil.com'));
    const location = res.headers.get('location')!;
    const locationUrl = new URL(location);
    expect(locationUrl.origin).toBe(ORIGIN);
    expect(locationUrl.host).not.toBe('evil.com');
  });

  it('exchange error → redirects to /login?error=auth', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: new Error('fail') });
    const res = await GET(req('/auth/callback?code=abc'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(`${ORIGIN}/login?error=auth`);
  });

  it('no code → redirects to /login?error=auth', async () => {
    const res = await GET(req('/auth/callback'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(`${ORIGIN}/login?error=auth`);
  });
});
