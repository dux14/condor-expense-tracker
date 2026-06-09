// @vitest-environment node
import { describe, it, expect } from 'vitest';
import nextConfig from '@/next.config';

describe('security headers', () => {
  it('exposes the required security headers for all paths', async () => {
    const groups = await (nextConfig as {
      headers: () => Promise<Array<{ source: string; headers: Array<{ key: string; value: string }> }>>;
    }).headers();

    // Headers must apply to every path.
    expect(groups.some(g => g.source === '/:path*')).toBe(true);

    const all = groups.flatMap(g => g.headers);
    const keys = all.map(h => h.key.toLowerCase());
    for (const k of [
      'content-security-policy',
      'x-content-type-options',
      'referrer-policy',
      'permissions-policy',
      'x-frame-options',
    ]) {
      expect(keys).toContain(k);
    }

    // Value assertions: a future edit must not silently gut the load-bearing
    // CSP directives (clickjacking + SW) or the WebAuthn permission.
    const csp = all.find(h => h.key.toLowerCase() === 'content-security-policy')!.value;
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("worker-src 'self' blob:");

    const pp = all.find(h => h.key.toLowerCase() === 'permissions-policy')!.value;
    expect(pp).toContain('publickey-credentials-get=(self)');
  });
});
