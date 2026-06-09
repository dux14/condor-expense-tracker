// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const getUser = vi.fn();
vi.mock('@/lib/auth/supabase-server', () => ({
  createClient: async () => ({ auth: { getUser } }),
}));
const dbGet = vi.fn();
const dbUpsert = vi.fn();
vi.mock('@/lib/fx/fx-db', () => ({
  fxDbGet: (...a: unknown[]) => dbGet(...a),
  fxDbUpsert: (...a: unknown[]) => dbUpsert(...a),
}));
const fetchUpstream = vi.fn();
vi.mock('@/lib/fx/fx-resolver', async (orig) => {
  const mod = await orig<typeof import('@/lib/fx/fx-resolver')>();
  return { ...mod, fetchFrankfurter: (...a: unknown[]) => fetchUpstream(...a) };
});

import { GET } from '@/app/api/fx/route';
import { __resetMemCache } from '@/lib/fx/fx-memory-cache';
import { __resetRateLimit } from '@/lib/api/rate-limit';

const req = (qs: string) => new NextRequest(`https://x.test/api/fx?${qs}`);

beforeEach(() => {
  vi.clearAllMocks();
  __resetMemCache();
  __resetRateLimit();
  getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
  dbGet.mockResolvedValue(undefined);
  dbUpsert.mockResolvedValue(undefined);
  fetchUpstream.mockResolvedValue(4000);
});

const BAD = [
  '', // no params
  'from=USD', // missing to/date
  'from=USD&to=COP', // missing date
  'from=US&to=COP&date=2026-01-01', // 2-letter
  'from=USDD&to=COP&date=2026-01-01', // 4-letter
  'from=usd&to=COP&date=2026-01-01', // lowercase
  'from=ZZZ&to=COP&date=2026-01-01', // not ISO-4217
  'from=USD&to=COP&date=2026-13-40', // impossible date
  'from=USD&to=COP&date=2026/01/01', // wrong format
  'from=USD&to=COP&date=2999-01-01', // future
  "from=USD'&to=COP&date=2026-01-01", // SQL-ish injection attempt
  'from=<script>&to=COP&date=2026-01-01', // XSS attempt
];

describe('/api/fx rejects malformed input with 400 (never reaches resolver)', () => {
  for (const qs of BAD) {
    it(`400 for: "${qs}"`, async () => {
      const res = await GET(req(qs));
      expect(res.status).toBe(400);
      // resolver/upstream must never be reached for invalid input
      expect(fetchUpstream).not.toHaveBeenCalled();
    });
  }

  it('does not echo unsanitized input in the error body', async () => {
    const res = await GET(req('from=<script>&to=COP&date=2026-01-01'));
    const body = JSON.stringify(await res.json());
    expect(body).not.toContain('<script>');
  });
});

describe('/api/fx handles duplicate query params safely (deterministic, no ambiguity)', () => {
  it('takes the first `from` value and resolves normally (no 500, no second-value leak)', async () => {
    const res = await GET(req('from=USD&to=COP&date=2026-01-01&from=EUR'));
    expect(res.status).toBe(200); // first value USD is valid
    // fetchFrankfurter(from, to, date) — assert the upstream was asked for the
    // FIRST currency (USD) and that the injected EUR is never passed anywhere.
    expect(fetchUpstream).toHaveBeenCalledTimes(1);
    const args = fetchUpstream.mock.calls[0];
    expect(args[0]).toBe('USD');
    expect(JSON.stringify(args)).not.toContain('EUR');
  });
});
