// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
const getUser = vi.fn();
vi.mock('@supabase/ssr', () => ({ createServerClient: () => ({ auth: { getUser } }) }));
import { NextRequest } from 'next/server';

function reqWithBypass(path: string) {
  const r = new NextRequest(new URL(`http://localhost:3100${path}`));
  r.cookies.set('e2e-auth', '1');
  return r;
}

describe('e2e-auth bypass is dead in production', () => {
  beforeEach(() => { vi.clearAllMocks(); getUser.mockResolvedValue({ data: { user: null } }); });
  // vi.unstubAllEnvs() restores NODE_ENV to its pre-stub value, preventing the
  // stubbed env from leaking between the two cases (no manual reassignment —
  // process.env.NODE_ENV is typed read-only).
  afterEach(() => { vi.unstubAllEnvs(); });

  it('with NODE_ENV=production, the bypass cookie does NOT grant access', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.resetModules();
    const { updateSession } = await import('@/lib/auth/middleware-session');
    const res = await updateSession(reqWithBypass('/'));
    expect(res.headers.get('location')).toContain('/login');
  });

  it('with NODE_ENV=development, the bypass cookie DOES grant access', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.resetModules();
    const { updateSession } = await import('@/lib/auth/middleware-session');
    const res = await updateSession(reqWithBypass('/'));
    expect(res.headers.get('location')).toBeNull();
  });
});
