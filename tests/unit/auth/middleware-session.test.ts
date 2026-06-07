// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const getUser = vi.fn();
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({ auth: { getUser } }),
}));

import { NextRequest } from 'next/server';
import { updateSession } from '@/lib/auth/middleware-session';

function req(path: string) {
  return new NextRequest(new URL(`http://localhost:3100${path}`));
}

beforeEach(() => vi.clearAllMocks());

describe('updateSession gate', () => {
  it('redirects unauthenticated users to /login from a protected path', async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await updateSession(req('/'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/login');
  });

  it('allows unauthenticated access to /login', async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await updateSession(req('/login'));
    expect(res.headers.get('location')).toBeNull();
  });

  it('allows unauthenticated access to /auth/callback', async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await updateSession(req('/auth/callback?code=x'));
    expect(res.headers.get('location')).toBeNull();
  });

  it('redirects authenticated users away from /login to /', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const res = await updateSession(req('/login'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toMatch(/\/$|\/(?!login)/);
  });

  it('lets authenticated users through to a protected path', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const res = await updateSession(req('/historico'));
    expect(res.headers.get('location')).toBeNull();
  });
});
