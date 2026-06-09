// @vitest-environment node
import { it, expect, vi, beforeEach } from 'vitest';
const exchange = vi.fn();
vi.mock('@/lib/auth/supabase-server', () => ({
  createClient: async () => ({ auth: { exchangeCodeForSession: exchange } }),
}));
import { GET } from '@/app/auth/callback/route';
beforeEach(() => vi.clearAllMocks());

it('redirects to /login?error=auth when no code is present', async () => {
  const res = await GET(new Request('https://x.test/auth/callback'));
  expect(res.headers.get('location')).toContain('/login');
  expect(exchange).not.toHaveBeenCalled();
});
it('redirects to /login?error=auth when exchange fails (bad/forged code)', async () => {
  exchange.mockResolvedValue({ error: { message: 'invalid' } });
  const res = await GET(new Request('https://x.test/auth/callback?code=forged'));
  expect(res.headers.get('location')).toContain('/login');
});
it('redirects home on a valid code', async () => {
  exchange.mockResolvedValue({ error: null });
  const res = await GET(new Request('https://x.test/auth/callback?code=valid'));
  const loc = res.headers.get('location')!;
  expect(loc).not.toContain('/login');
});

// Open-redirect regression: a forged `next` must NOT redirect off-origin.
// The callback resolves `next` against its own origin and rejects any
// result whose origin differs, falling back to '/'. Locked in here.
it('does NOT honor a protocol-relative //evil.com next (open-redirect)', async () => {
  exchange.mockResolvedValue({ error: null });
  const res = await GET(
    new Request('https://x.test/auth/callback?code=valid&next=//evil.com'),
  );
  const loc = res.headers.get('location')!;
  expect(new URL(loc).origin).toBe('https://x.test');
});
it('does NOT honor an absolute https://evil.com next (open-redirect)', async () => {
  exchange.mockResolvedValue({ error: null });
  const res = await GET(
    new Request('https://x.test/auth/callback?code=valid&next=https://evil.com'),
  );
  const loc = res.headers.get('location')!;
  expect(new URL(loc).origin).toBe('https://x.test');
});
