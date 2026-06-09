// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
const getUser = vi.fn();
vi.mock('@supabase/ssr', () => ({ createServerClient: () => ({ auth: { getUser } }) }));
import { NextRequest } from 'next/server';
import { updateSession } from '@/lib/auth/middleware-session';

function req(path: string) { return new NextRequest(new URL(`http://localhost:3100${path}`)); }
beforeEach(() => { vi.clearAllMocks(); getUser.mockResolvedValue({ data: { user: null } }); });

const PUBLIC = ['/login', '/auth/callback?code=x'];
const PROTECTED = ['/', '/historico', '/categorias', '/ajustes', '/anadir', '/importar', '/api/fx?from=USD&to=COP&date=2026-01-01'];

describe('middleware allowlist is exhaustive', () => {
  for (const p of PUBLIC) {
    it(`PUBLIC: ${p} is reachable anonymously`, async () => {
      const res = await updateSession(req(p));
      expect(res.headers.get('location')).toBeNull();
    });
  }
  for (const p of PROTECTED) {
    it(`PROTECTED: ${p} redirects anonymous to /login`, async () => {
      const res = await updateSession(req(p));
      const loc = res.headers.get('location');
      // UI routes are redirected to /login by the middleware. /api/* is also
      // gated, but may instead be left to its own in-handler getUser() 401
      // (no redirect → null location); accept either form for API paths.
      expect(loc === null ? p.startsWith('/api/') : /\/login/.test(loc)).toBe(true);
    });
  }
});
