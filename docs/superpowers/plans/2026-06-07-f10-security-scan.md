# F10 — Security Scan (front + back + RLS) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Audit the entire Phase-2 surface (front + API + RLS) of Cóndor — a real-money financial app — to a bank-grade bar, fix every finding, and leave behind durable regression gates. F10 runs **after F0–F8 are implemented**. It (a) runs automated gates (the `/security-review` skill over the phase diff, secret-leak greps, the UI-never-touches-network/storage invariant grep, `pnpm audit`); (b) proves per-table cross-user RLS denial and that **no** user-scoped table escaped RLS; (c) audits the auth surface (middleware allowlist, callback validation, session expiry/refresh, sign-out cookie cleanup, and that the F1 `e2e-auth` bypass is hard-gated against production); (d) adds strict security headers + CSP compatible with the PWA service worker and WebAuthn; (e) reviews app-lock (PIN hash never leaves device, PBKDF2 params, attempt backoff, WebAuthn `userVerification: required`); (f) re-verifies input surfaces (`/api/fx` Zod, PDF magic-bytes/caps/escaped render with a malicious-merchant XSS fixture); (g) closes the data lifecycle (export completeness, account deletion of cloud rows + auth user, local cache wipe on explicit sign-out); (h) writes `docs/superpowers/SECURITY-REVIEW-PHASE2.md` with findings/severity/fixes and a credential-rotation checklist for the chat-exposed `sb_secret` + `sbp_` token (D7).

**Architecture:** F10 introduces almost no new product code — it is an **audit-with-fixes** layer over the surfaces created by F1 (`middleware.ts`, `lib/auth/*`, `e2e-auth` bypass), F2 (`lib/lock/*` app-lock: WebAuthn + PBKDF2 PIN), F3 (`supabase/migrations/*`, RLS on every user table, `SupabaseRepository`), F5 (`app/api/fx/route.ts`, Zod validation, rate limiter), and F6 (client-side PDF parser + `category_rules`). The spec invariant is preserved and now **enforced by a committed test**: UI components never import `supabase-js`/`fetch`/`localStorage` — only code under `lib/data`, `lib/fx`, `lib/auth`, `lib/lock` may. New artifacts are: a security-headers block in `next.config.ts`; a Postgres "every user table has a policy" assertion test; per-table cross-user denial tests; a production-build test of the `e2e-auth` bypass; an XSS fixture for PDF render; an account-deletion path (RPC + Edge Function or admin call) if F1–F3 did not ship one; and the final report. Quick wins (greps, `pnpm audit`) run first; DB/auth/headers/lifecycle deepen from there.

**Tech Stack:** Next.js 16.2.7 (App Router, `middleware.ts`, Route Handlers, `next.config.ts` `headers()`), `@supabase/supabase-js` v2 + `@supabase/ssr` (auth), Supabase Postgres 15 + RLS (`pg_policies`/`pg_tables` introspection), Supabase CLI (`supabase start`, local service/publishable keys), Supabase Edge Functions (Deno) or `auth.admin.deleteUser` for account deletion, Vitest 4 (unit + node integration project `test:int` from F3), Playwright 1.49 (e2e, against `next build && next start`), `curl` for header verification, `pnpm audit`, the `security-review` Claude Code skill. WebAuthn (platform authenticator) + PBKDF2 (`crypto.subtle`) under audit from F2. pnpm for every command. Env vars by name only — never print values: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (client), `SUPABASE_SECRET_KEY` (server-only). Local test keys via `.env.test` (gitignored): `SUPABASE_TEST_URL`, `SUPABASE_TEST_PUBLISHABLE_KEY`, `SUPABASE_TEST_SECRET_KEY`.

---

## Pre-flight (read before Task 1)

- **F10 runs last.** Confirm F0–F8 are merged. Sanity:
  ```bash
  grep -n "output" next.config.ts || echo "OK: F0 dropped output:export"
  test -f middleware.ts && echo "OK: F1 middleware"
  test -f supabase/migrations/0001_core.sql && echo "OK: F3 schema"
  test -f app/api/fx/route.ts && echo "OK: F5 fx route"
  ls lib/lock 2>/dev/null && echo "OK: F2 app-lock" || echo "WARN: lib/lock absent — confirm F2 path before Task 6"
  ```
  Any missing precondition → stop and report which feature is not landed. (App-lock may live at `lib/lock`; if F2 used another path, adjust Task 6 imports only.)
- **Two suites exist** (from F3): `pnpm test` (offline, fast, jsdom/node) and `pnpm test:int` (`vitest run --config vitest.integration.config.ts`, needs `supabase start`). RLS denial tests in this plan extend `pnpm test:int`.
- **The audit must not weaken anything.** Every finding gets a fix AND a regression test/gate. Never relax a test to make it pass — fix the code.
- **Severity scale** for the report: **Critical** (auth bypass, cross-user data access, secret in client bundle), **High** (missing RLS on a user table, XSS, missing input validation), **Medium** (weak headers, weak PBKDF2 params, no attempt backoff), **Low** (defense-in-depth, hardening).
- Quick wins first: §1 greps + `pnpm audit` are fully automatable and surface Critical leaks immediately.

---

## 1. Automated gates — secret leaks, invariant grep, dep audit (quick wins)

These are pure shell checks. Each becomes a committed script so it re-runs in CI. Create `scripts/security/` for them.

- [ ] **1.1 — Build the production client bundle once** (needed by 1.2/1.3):
  ```bash
  pnpm build
  ```
  Expected: build succeeds; `.next/static/` exists. (If `output:'export'` is somehow back, stop — F0 regressed.)

- [ ] **1.2 — Secret-key leak gate.** No service secret or `sb_secret`-style key may appear in any client-shipped asset. Write `scripts/security/check-secret-leak.sh`:
  ```bash
  #!/usr/bin/env bash
  # Fails (exit 1) if any server-only secret pattern leaks into the client bundle.
  set -euo pipefail
  BUNDLE_DIRS=(".next/static" ".next/server/app" "out")
  # Patterns that must NEVER be in client-shipped JS.
  PATTERNS='sb_secret_|SUPABASE_SECRET_KEY|service_role|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.'
  found=0
  for d in "${BUNDLE_DIRS[@]}"; do
    [ -d "$d" ] || continue
    if grep -rEl "$PATTERNS" "$d" 2>/dev/null; then
      echo "LEAK: secret-like string found above in $d"
      found=1
    fi
  done
  # The publishable key IS allowed in the client; the secret key is not.
  if [ "$found" -ne 0 ]; then
    echo "FAIL: server secret material present in client bundle"; exit 1
  fi
  echo "OK: no server secret in client bundle"
  ```
  Note: the JWT regex (`eyJ…`) catches any embedded JWT — the publishable key is also a JWT, so if it trips, narrow the check to confirm only the secret/service_role is flagged (publishable in client is expected; secret is not). Tune by listing the offending file with `grep -rEn`.
  Run: `chmod +x scripts/security/check-secret-leak.sh && ./scripts/security/check-secret-leak.sh`.
  Expected: `OK: no server secret in client bundle`. If it fails, **Critical** — find the import of `SUPABASE_SECRET_KEY` reachable from a client component (likely a `lib/fx/fx-db.ts` or `*-server.ts` wrongly imported by UI) and fix the import boundary, then re-run.

- [ ] **1.3 — `NEXT_PUBLIC_` misuse gate.** No secret may be exposed via a `NEXT_PUBLIC_` env name. Write `scripts/security/check-public-env.sh`:
  ```bash
  #!/usr/bin/env bash
  set -euo pipefail
  # 1. No source references a NEXT_PUBLIC_*SECRET*/SERVICE name.
  if grep -rEn "NEXT_PUBLIC_[A-Z_]*(SECRET|SERVICE|PRIVATE)" app lib middleware.ts 2>/dev/null; then
    echo "FAIL: a secret is exposed under a NEXT_PUBLIC_ name"; exit 1
  fi
  # 2. The secret key is never read with a NEXT_PUBLIC_ prefix anywhere.
  if grep -rEn "NEXT_PUBLIC_SUPABASE_SECRET" . --include='*.ts' --include='*.tsx' 2>/dev/null | grep -v node_modules; then
    echo "FAIL: NEXT_PUBLIC_SUPABASE_SECRET referenced"; exit 1
  fi
  # 3. .env.example (committed) must not carry a secret VALUE — names only.
  if [ -f .env.example ] && grep -qE "sb_secret_|service_role" .env.example; then
    echo "FAIL: .env.example contains a secret value"; exit 1
  fi
  echo "OK: no secret exposed under NEXT_PUBLIC_"
  ```
  Run: `chmod +x scripts/security/check-public-env.sh && ./scripts/security/check-public-env.sh`.
  Expected: `OK: no secret exposed under NEXT_PUBLIC_`.

- [ ] **1.4 — UI-never-touches-network/storage invariant gate.** Only `lib/data`, `lib/fx`, `lib/auth`, `lib/lock` (the data/edge layers) may import `@supabase`, call `fetch(`, or touch `localStorage`. UI (`app/**`, `components/**`) and other `lib/**` must not — they go through the store/selectors/providers. Write `scripts/security/check-ui-invariant.sh`:
  ```bash
  #!/usr/bin/env bash
  set -euo pipefail
  # Allowed edge layers (relative to repo root).
  ALLOW='^lib/(data|fx|auth|lock)/'
  # Route handlers legitimately use fetch/supabase server-side; allow app/api.
  APIALLOW='^app/api/'
  fail=0
  scan() { # $1 = pattern label, $2 = grep ERE
    # Search TS/TSX under app, components, and lib EXCEPT the allowed edges.
    matches=$(grep -rEln "$2" app components lib --include='*.ts' --include='*.tsx' 2>/dev/null \
      | grep -vE "$ALLOW" | grep -vE "$APIALLOW" || true)
    if [ -n "$matches" ]; then
      echo "INVARIANT VIOLATION ($1) in:"; echo "$matches"; fail=1
    fi
  }
  scan "supabase-js import"   "from ['\"]@supabase/"
  scan "raw fetch call"       "[^.A-Za-z]fetch\("
  scan "localStorage access"  "localStorage"
  if [ "$fail" -ne 0 ]; then
    echo "FAIL: UI/non-edge code touches network or storage directly"; exit 1
  fi
  echo "OK: UI never touches network/storage directly"
  ```
  Run: `chmod +x scripts/security/check-ui-invariant.sh && ./scripts/security/check-ui-invariant.sh`.
  Expected: `OK: UI never touches network/storage directly`. Baseline today is clean (no UI imports of supabase/fetch/localStorage). If F2/F4/F6 introduced a violation (e.g. a component reading `localStorage` for the outbox or lock state directly), move that access behind `lib/lock`/`lib/data` and have the component use a hook/selector, then re-run. (Note: `next/og` or test files are excluded by the `app/components/lib` scope; if a false positive appears from a legitimate same-name identifier, tighten the ERE rather than widening the allowlist.)

- [ ] **1.5 — Dependency audit.** Run `pnpm audit` and review advisories, with focus on Phase-2-new deps (`@supabase/supabase-js`, `@supabase/ssr`, the PDF parser `unpdf`/`pdfjs` from F6, any WebAuthn helper from F2):
  ```bash
  pnpm audit --prod
  pnpm audit          # includes dev deps (Playwright, vitest, etc.)
  pnpm ls @supabase/supabase-js @supabase/ssr unpdf pdfjs-dist 2>/dev/null
  ```
  Expected: zero **high/critical** advisories in `--prod`. For each advisory: record it in the report (§8) with severity, then remediate via `pnpm update <pkg>` to a patched range or document why it is not exploitable in our usage. Dev-only advisories are Low unless they affect the build supply chain.

- [ ] **1.6 — Wire the gates into the test pipeline.** Add to `package.json` scripts:
  ```json
  "security:gates": "bash scripts/security/check-secret-leak.sh && bash scripts/security/check-public-env.sh && bash scripts/security/check-ui-invariant.sh"
  ```
  Run: `pnpm build && pnpm security:gates`. Expected: all three print `OK`.

- [ ] **1.7 — Run the `/security-review` skill over the full phase diff.** This is the human-grade pass over everything F0–F8 added. Determine the phase base (the commit before F0) and review the cumulative diff:
  ```bash
  git log --oneline | head -40   # locate the pre-F0 base commit, call it <BASE>
  git diff <BASE>..HEAD --stat
  ```
  Then invoke the **security-review** skill scoped to that diff (auth on every endpoint, RLS coverage, secret handling, input validation, PDF sandboxing, rate-limit coverage, OWASP Top 10). Capture every finding into the §8 report draft with severity. Findings drive the remaining tasks; do not close §1 until each finding has an owner task below or a fix here.

- [ ] **1.8 — Commit:** `chore(security): F10 automated gates (secret-leak, NEXT_PUBLIC, UI-invariant) + audit`.

---

## 2. RLS verification — per-table cross-user denial + "no table without a policy"

Extends the F3 integration suite (`pnpm test:int`, node env, `supabase start`). Reuses F3's `tests/integration/_helpers.ts` (`makeUserClient`, `makeExpense`). User A and user B each get a real JWT; B must never see or mutate A's rows on **any** user table. Then a catalog query proves no user-scoped table escaped RLS.

- [ ] **2.1 — Per-table cross-user denial.** Write `tests/integration/rls-isolation.int.test.ts`:
  ```ts
  import { describe, it, expect, beforeAll, afterAll } from 'vitest';
  import { createClient, type SupabaseClient } from '@supabase/supabase-js';
  import { makeUserClient } from './_helpers';

  const URL = process.env.SUPABASE_TEST_URL!;
  const PUBLISHABLE = process.env.SUPABASE_TEST_PUBLISHABLE_KEY!;

  // Every user-scoped table and a minimal valid row factory for A's user_id.
  // user_id is omitted: the column default auth.uid() fills it from the JWT.
  function rows(uid: string) {
    return {
      categories:     { id: 'rls-cat',  name: 'X', color: '#fff', icon: 'comida', is_preset: false },
      expenses:       { id: 'rls-exp',  amount: 100, currency: 'COP', date: '2026-01-01',
                        category_id: 'preset-comida', source: 'manual',
                        created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
      settings:       { /* PK is user_id (default auth.uid()); upsert one row */ base_currency: 'COP' },
      budgets:        { id: 'rls-bud',  category_id: 'preset-comida', amount_base: 1000, period: 'monthly' },
      category_rules: { id: 'rls-rule', pattern: 'STARBUCKS', category_id: 'preset-comida' },
    } as const;
  }
  const USER_TABLES = ['categories', 'expenses', 'settings', 'budgets', 'category_rules'] as const;

  describe('RLS cross-user isolation (per table)', () => {
    let aClient: SupabaseClient, bClient: SupabaseClient, aUid: string;

    beforeAll(async () => {
      const a = await makeUserClient(`rls_a_${Date.now()}@condor.test`);
      const b = await makeUserClient(`rls_b_${Date.now()}@condor.test`);
      aClient = a.client; bClient = b.client; aUid = a.id;
      // Seed one row per table as user A.
      const r = rows(aUid);
      for (const t of USER_TABLES) {
        const onConflict = t === 'settings' ? 'user_id' : 'user_id,id';
        const { error } = await aClient.from(t).upsert(r[t], { onConflict });
        expect(error, `seed ${t}`).toBeNull();
      }
    });

    afterAll(async () => {
      for (const t of USER_TABLES) {
        await aClient.from(t).delete().neq('id', '__none__').then(() => {}, () => {});
        await bClient.from(t).delete().neq('id', '__none__').then(() => {}, () => {});
      }
    });

    for (const t of USER_TABLES) {
      it(`${t}: B cannot SELECT A's rows`, async () => {
        const { data } = await bClient.from(t).select('*');
        // B sees only its own rows (zero or its seeds), never A's seeded id.
        const aId = t === 'settings' ? null : (rows(aUid)[t] as { id?: string }).id;
        if (aId) expect((data ?? []).some((row: { id?: string }) => row.id === aId)).toBe(false);
        else expect((data ?? []).length).toBeLessThanOrEqual(1); // settings: only B's own
      });

      it(`${t}: B cannot UPDATE A's rows`, async () => {
        if (t === 'settings') return; // keyed by user_id; UPDATE can't target A
        const aId = (rows(aUid)[t] as { id: string }).id;
        const { data, error } = await bClient.from(t).update({ /* harmless */ }).eq('id', aId).select();
        // RLS: zero rows affected (USING filters A's row out for B). No error, no rows.
        expect(error).toBeNull();
        expect((data ?? []).length).toBe(0);
      });

      it(`${t}: B cannot DELETE A's rows`, async () => {
        if (t === 'settings') return;
        const aId = (rows(aUid)[t] as { id: string }).id;
        const { data, error } = await bClient.from(t).delete().eq('id', aId).select();
        expect(error).toBeNull();
        expect((data ?? []).length).toBe(0);
        // Prove A's row survived.
        const { data: still } = await aClient.from(t).select('id').eq('id', aId);
        expect((still ?? []).length).toBe(1);
      });

      it(`${t}: B cannot INSERT a row spoofing A's user_id`, async () => {
        if (t === 'settings') return;
        const { error } = await bClient.from(t).insert({
          ...(rows(aUid)[t] as object),
          id: `spoof-${t}`,
          user_id: aUid,           // attempt to write into A's space
        } as never);
        // WITH CHECK (user_id = auth.uid()) must reject this insert.
        expect(error, `${t} spoof insert must be rejected`).not.toBeNull();
      });
    }
  });
  ```

- [ ] **2.2 — `fx_rates` policy: global read OK, client write denied.** Append to the same file (or a sibling `tests/integration/rls-fx.int.test.ts`):
  ```ts
  it('fx_rates: a user (publishable JWT) can READ but not WRITE', async () => {
    const { client } = await makeUserClient(`rls_fx_${Date.now()}@condor.test`);
    // Read is allowed (global read policy).
    const { error: readErr } = await client.from('fx_rates').select('*').limit(1);
    expect(readErr).toBeNull();
    // Write must fail: no write policy exists for non-service keys.
    const { error: writeErr } = await client.from('fx_rates').insert({
      from_ccy: 'USD', to_ccy: 'COP', on_date: '2026-01-01', rate: 4000,
    });
    expect(writeErr, 'client write to fx_rates must be denied').not.toBeNull();
  });
  ```

- [ ] **2.3 — Catalog assertion: NO user-scoped table without RLS + a policy.** This fails the suite if any future migration adds a `user_id` table and forgets its policy. Uses the **service** client to read `pg_catalog`. Write `tests/integration/rls-coverage.int.test.ts`:
  ```ts
  import { describe, it, expect } from 'vitest';
  import { createClient } from '@supabase/supabase-js';

  const admin = createClient(
    process.env.SUPABASE_TEST_URL!,
    process.env.SUPABASE_TEST_SECRET_KEY!,
    { auth: { persistSession: false } },
  );

  // fx_rates is intentionally global (no user_id) → exempt from "must be user-scoped + policy".
  const GLOBAL_EXEMPT = new Set(['fx_rates']);

  describe('RLS coverage of public schema', () => {
    it('every public table has RLS enabled', async () => {
      const { data, error } = await admin.rpc('exec_sql', {
        sql: `select tablename, rowsecurity from pg_tables where schemaname='public'`,
      }).then(r => r, () => ({ data: null, error: 'no exec_sql' as const }));
      // If exec_sql RPC is unavailable, use the SQL-file assertion in 2.4 instead.
      if (error) return;
      for (const row of (data ?? []) as Array<{ tablename: string; rowsecurity: boolean }>) {
        expect(row.rowsecurity, `${row.tablename} must have RLS enabled`).toBe(true);
      }
    });
  });
  ```
  > Supabase does not expose `pg_tables` over PostgREST by default and has no generic `exec_sql`. The **reliable** form is a SQL assertion run via the CLI (next step), which does not depend on an RPC. Keep 2.3 only if you added a `security definer exec_sql` helper in F3; otherwise rely on 2.4.

- [ ] **2.4 — SQL-level coverage assertion (CLI, authoritative).** Write `scripts/security/rls-coverage.sql`:
  ```sql
  -- Fails (raises) if any public table that has a user_id column lacks RLS or a policy,
  -- or if any public table has RLS disabled. fx_rates (no user_id) is allowed RLS+read-only.
  do $$
  declare r record; missing text := '';
  begin
    -- (a) Every public table must have rowsecurity = true.
    for r in
      select tablename from pg_tables
      where schemaname='public' and rowsecurity = false
    loop
      missing := missing || format('[RLS OFF] %s; ', r.tablename);
    end loop;

    -- (b) Every table with a user_id column must have at least one policy.
    for r in
      select t.tablename
      from pg_tables t
      where t.schemaname='public'
        and exists (
          select 1 from information_schema.columns c
          where c.table_schema='public' and c.table_name=t.tablename and c.column_name='user_id'
        )
        and not exists (
          select 1 from pg_policies p
          where p.schemaname='public' and p.tablename=t.tablename
        )
    loop
      missing := missing || format('[NO POLICY] %s; ', r.tablename);
    end loop;

    if length(missing) > 0 then
      raise exception 'RLS coverage failures: %', missing;
    end if;
    raise notice 'OK: RLS coverage complete';
  end $$;
  ```
  Run against local Supabase:
  ```bash
  supabase start   # if not already up
  psql "$SUPABASE_TEST_DB_URL" -f scripts/security/rls-coverage.sql
  # SUPABASE_TEST_DB_URL is the local db url printed by `supabase start`
  # (e.g. postgresql://postgres:postgres@127.0.0.1:54322/postgres). Store in .env.test.
  ```
  Expected: `OK: RLS coverage complete`. If it raises, the named table is the **High** finding — add RLS + a `user_id = auth.uid()` policy in a new migration, re-run.

- [ ] **2.5 — Run the RLS suite:**
  ```bash
  supabase start
  pnpm test:int tests/integration/rls-isolation.int.test.ts tests/integration/rls-coverage.int.test.ts
  psql "$SUPABASE_TEST_DB_URL" -f scripts/security/rls-coverage.sql
  ```
  Expected: all denial tests green (B blocked on SELECT/UPDATE/DELETE/INSERT for every user table; fx_rates read OK / write denied); coverage SQL prints OK. Any failure is **Critical/High** — fix the policy, never the test.

- [ ] **2.6 — Add a `security:rls` script** to `package.json` so the SQL assertion is one command:
  ```json
  "security:rls": "psql \"$SUPABASE_TEST_DB_URL\" -f scripts/security/rls-coverage.sql"
  ```

- [ ] **2.7 — Commit:** `test(security): F10 per-table RLS cross-user denial + coverage assertion`.

---

## 3. Auth surface audit — middleware allowlist, callback, session lifecycle, prod-gated bypass

Audits F1's `middleware.ts` / `lib/auth/middleware-session.ts` / `app/auth/callback/route.ts`. The exhaustive public allowlist is: **`/login`, `/auth/callback`, and PWA/static assets** (`_next/static`, `_next/image`, `favicon.ico`, `manifest.webmanifest`, `sw.js`, `icon.png`, `apple-icon.png`, `brand/*`, image/font extensions). Everything else requires a session.

- [ ] **3.1 — Exhaustive route-protection test.** Write `tests/unit/security/middleware-allowlist.test.ts`. It asserts protected app routes redirect when anonymous, and ONLY the allowlist is public. Mock `@supabase/ssr` (no network):
  ```ts
  import { describe, it, expect, vi, beforeEach } from 'vitest';
  const getUser = vi.fn();
  vi.mock('@supabase/ssr', () => ({ createServerClient: () => ({ auth: { getUser } }) }));
  import { NextRequest } from 'next/server';
  import { updateSession } from '@/lib/auth/middleware-session';

  function req(path: string) { return new NextRequest(new URL(`http://localhost:3100${path}`)); }
  beforeEach(() => { vi.clearAllMocks(); getUser.mockResolvedValue({ data: { user: null } }); });

  const PUBLIC = ['/login', '/auth/callback?code=x'];
  // Real app routes (from app/) — every one must redirect when anonymous.
  const PROTECTED = ['/', '/historico', '/categorias', '/ajustes', '/tendencias', '/importar', '/api/fx?from=USD&to=COP&date=2026-01-01'];

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
        // Either middleware redirects (UI routes) or the route's own auth returns 401 (api).
        const loc = res.headers.get('location');
        expect(loc === null ? p.startsWith('/api/') : /\/login/.test(loc)).toBe(true);
      });
    }
  });
  ```
  > Note: `/api/fx` is gated by the handler's own `getUser()` 401 (F5), not by the middleware redirect — the test allows either form. Confirm by reading `middleware.ts`'s matcher: if it excludes `/api`, the API's in-handler auth is the gate (verified in Task 5).

  Run: `pnpm test middleware-allowlist`. Expected: all green. If a real route is missing from `PROTECTED`, add it (enumerate `app/**/page.tsx`).

- [ ] **3.2 — Callback validates `code` and rejects garbage.** Write `tests/unit/security/auth-callback.test.ts`:
  ```ts
  import { describe, it, expect, vi, beforeEach } from 'vitest';
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
  ```
  Run: `pnpm test auth-callback`. Expected: green. (Confirms an attacker-supplied `code` cannot mint a session; only Supabase's PKCE exchange does.)

- [ ] **3.3 — Session expiry / refresh + sign-out cookie cleanup (audit + manual proof).**
  - Read `lib/auth/middleware-session.ts`: confirm it calls `getUser()` (server-validated, not just `getSession()`/cookie decode) on every request and returns the response whose cookies `setAll` mutated — so rotated tokens persist. Record "verified" in the report. If it uses only `getSession()` without `getUser()` for the gate decision, that is a **High** finding (cookie can be stale/forged) — fix to `getUser()`/`getClaims()`.
  - Sign-out cleanup: read `AccountSection` (F1) — `supabase.auth.signOut()` must clear `sb-*` auth cookies. Add an e2e proof in Task 7 (cookies gone + bounce to `/login`).
  - Manual (local, real OAuth): sign in, copy the `sb-…-auth-token` cookie expiry; confirm a request after the access-token TTL still works (middleware refresh) and that `signOut()` removes the cookies (DevTools → Application → Cookies empty for the domain). Record in the report.

- [ ] **3.4 — The `e2e-auth` bypass is hard-gated against production (CRITICAL gate).** F1 added a non-prod bypass cookie in `updateSession`. Prove it is inert in a **production** build. Write `tests/unit/security/e2e-bypass-prod.test.ts`:
  ```ts
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
    const ORIG = process.env.NODE_ENV;
    beforeEach(() => { vi.clearAllMocks(); getUser.mockResolvedValue({ data: { user: null } }); });
    afterEach(() => { vi.unstubAllEnvs?.(); process.env.NODE_ENV = ORIG; });

    it('with NODE_ENV=production, the bypass cookie does NOT grant access', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      const { updateSession } = await import('@/lib/auth/middleware-session');
      const res = await updateSession(reqWithBypass('/'));
      // Anonymous + bypass cookie + prod => still redirected to /login.
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
  ```
  Run: `pnpm test e2e-bypass-prod`. Expected: both green. If the prod case grants access, that is **Critical** — fix the guard in `lib/auth/middleware-session.ts` to `process.env.NODE_ENV !== 'production'` (exact check) and re-run.

- [ ] **3.5 — Production-build behavioral proof of the bypass gate (belt-and-suspenders).** A real prod server must ignore the cookie:
  ```bash
  pnpm build
  NODE_ENV=production pnpm exec next start -p 3210 &
  sleep 4
  # Anonymous + bypass cookie against a protected route → must NOT reach the app.
  curl -s -i -b 'e2e-auth=1' http://localhost:3210/ | grep -iE "location:|HTTP/"
  kill %1
  ```
  Expected: a redirect to `/login` (3xx `location: /login`), NOT a 200 app shell. Record the captured status line in the report. (If `next start` needs the standalone server, adapt to the project's start command.)

- [ ] **3.6 — Commit:** `test(security): F10 auth surface — allowlist, callback validation, prod-gated e2e bypass`.

---

## 4. Security headers + transport (CSP compatible with PWA + WebAuthn)

HSTS is provided by Vercel automatically; we add CSP, `X-Content-Type-Options`, `Referrer-Policy`, and a minimal `Permissions-Policy` (with `publickey-credentials-get=(self)` for WebAuthn) via `next.config.ts` `headers()`. The CSP must not break the Serwist service worker (`sw.js`), Next's inline runtime, Google avatar images (`lh3.googleusercontent.com`), or the Supabase API origin.

- [ ] **4.1 — Add the headers block to `next.config.ts`.** Edit `next.config.ts` to add an async `headers()` (note: F0 already removed `output:'export'`, which is required for `headers()` to take effect). Use this concrete CSP:
  ```ts
  import type { NextConfig } from "next";

  // Supabase project origin — read from env so preview/prod differ without code change.
  const SUPABASE_ORIGIN = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://*.supabase.co";

  const csp = [
    "default-src 'self'",
    // Next 16 ships small inline bootstrap scripts; 'unsafe-inline' for styles is
    // needed by Tailwind-injected styles. Scripts: allow self + Next inline runtime.
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    // Avatars from Google, data: for inline SVGs/icons, blob: for client PDF render.
    `img-src 'self' data: blob: https://lh3.googleusercontent.com`,
    "font-src 'self' data:",
    // XHR/fetch: our own origin (/, /api/fx), Supabase REST/Auth, Frankfurter is
    // only called server-side so it does NOT need to be in connect-src.
    `connect-src 'self' ${SUPABASE_ORIGIN} wss://*.supabase.co`,
    // PDF parsing uses a web worker (pdfjs) — allow worker from self + blob.
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "frame-ancestors 'none'",            // clickjacking protection
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");

  const securityHeaders = [
    { key: "Content-Security-Policy", value: csp },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "DENY" },
    {
      key: "Permissions-Policy",
      // Minimal: enable WebAuthn (platform authenticator), deny the rest.
      value: "publickey-credentials-get=(self), camera=(), microphone=(), geolocation=(), payment=()",
    },
  ];

  const nextConfig: NextConfig = {
    images: {
      remotePatterns: [{ protocol: "https", hostname: "lh3.googleusercontent.com" }],
    },
    async headers() {
      return [{ source: "/:path*", headers: securityHeaders }];
    },
  };

  export default nextConfig;
  ```
  > CSP notes: (1) Next 16's framework still emits some inline scripts; `'unsafe-inline'` on `script-src` is the pragmatic baseline — if the app can adopt a nonce-based CSP without breaking the SW, upgrade later and record it as a Low hardening item. (2) Serwist registers `sw.js` from same-origin `'self'` — covered. (3) Do NOT add `connect-src` for Frankfurter; F5 made FX server-only, so the browser never calls it (this is also a privacy property). (4) `frame-ancestors 'none'` + `X-Frame-Options: DENY` double-cover clickjacking.

- [ ] **4.2 — Verify the SW still registers and PWA still works under CSP** (regression — the most likely breakage):
  ```bash
  pnpm build
  pnpm exec next start -p 3211 &
  sleep 4
  curl -s -i http://localhost:3211/sw.js | grep -iE "HTTP/|content-type"
  kill %1
  ```
  Expected: `sw.js` served `200` with `content-type: application/javascript` (or `text/javascript`) and no CSP-blocked errors. Then run the existing PWA-related e2e/visual specs (`pnpm e2e`) to confirm nothing regressed.

- [ ] **4.3 — curl the headers on a deployed preview** (real transport, where Vercel adds HSTS):
  ```bash
  vercel deploy            # or use the latest preview URL
  PREVIEW="https://<preview>.vercel.app"
  curl -s -I "$PREVIEW/" | grep -iE "content-security-policy|x-content-type-options|referrer-policy|permissions-policy|strict-transport-security|x-frame-options"
  ```
  Expected: CSP present (matching 4.1), `x-content-type-options: nosniff`, `referrer-policy: strict-origin-when-cross-origin`, `permissions-policy: publickey-credentials-get=(self) …`, `x-frame-options: DENY`, and `strict-transport-security` (injected by Vercel). Paste the captured headers into the report. If HSTS is absent on the apex production domain, note it for the cost/ops follow-up (Vercel managed domains include it).

- [ ] **4.4 — Header presence unit test** (cheap regression so a future config edit can't silently drop a header):
  ```ts
  // tests/unit/security/security-headers.test.ts
  import { describe, it, expect } from 'vitest';
  import nextConfig from '@/next.config';

  it('exposes the required security headers for all paths', async () => {
    const groups = await (nextConfig as { headers: () => Promise<Array<{ source: string; headers: Array<{ key: string }> }>> }).headers();
    const all = groups.flatMap(g => g.headers.map(h => h.key.toLowerCase()));
    for (const k of ['content-security-policy', 'x-content-type-options', 'referrer-policy', 'permissions-policy', 'x-frame-options']) {
      expect(all).toContain(k);
    }
  });
  ```
  Run: `pnpm test security-headers`. Expected: green. (If importing `next.config.ts` as a module fails under vitest, assert against the exported `securityHeaders` array instead — export it.)

- [ ] **4.5 — Commit:** `feat(security): strict CSP + security headers (PWA + WebAuthn compatible)`.

---

## 5. Input surfaces — /api/fx malformed requests + PDF import XSS/abuse

Re-verifies F5's Zod gate against real malformed requests and F6's PDF parser against a malicious fixture. Financial data + file parsing = high blast radius.

- [ ] **5.1 — `/api/fx` malformed-request battery (handler-level, no server).** Extend the F5 route test pattern. Write `tests/unit/security/fx-input-hardening.test.ts` — same mocks as F5's `fx-route.test.ts` (auth user present, deps stubbed), then throw garbage at it:
  ```ts
  import { NextRequest } from 'next/server';
  const getUser = vi.fn();
  vi.mock('@/lib/supabase/server', () => ({ createServerSupabaseClient: async () => ({ auth: { getUser } }) }));
  vi.mock('@/lib/fx/fx-db', () => ({ fxDbGet: vi.fn().mockResolvedValue(undefined), fxDbUpsert: vi.fn() }));
  import { GET } from '@/app/api/fx/route';
  import { __resetMemCache } from '@/lib/fx/fx-memory-cache';
  import { __resetRateLimit } from '@/lib/api/rate-limit';
  const req = (qs: string) => new NextRequest(`https://x.test/api/fx?${qs}`);

  beforeEach(() => { vi.clearAllMocks(); __resetMemCache(); __resetRateLimit();
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }); });

  const BAD = [
    '',                                            // no params
    'from=USD',                                    // missing to/date
    'from=USD&to=COP',                             // missing date
    'from=US&to=COP&date=2026-01-01',              // 2-letter
    'from=USDD&to=COP&date=2026-01-01',            // 4-letter
    'from=usd&to=COP&date=2026-01-01',             // lowercase
    'from=ZZZ&to=COP&date=2026-01-01',             // not ISO-4217
    'from=USD&to=COP&date=2026-13-40',             // impossible date
    'from=USD&to=COP&date=2026/01/01',             // wrong format
    'from=USD&to=COP&date=2999-01-01',             // future
    "from=USD'&to=COP&date=2026-01-01",            // SQL-ish injection attempt
    'from=<script>&to=COP&date=2026-01-01',        // XSS attempt
    'from=USD&to=COP&date=2026-01-01&from=EUR',    // param pollution
  ];

  describe('/api/fx rejects malformed input with 400 (never reaches resolver)', () => {
    for (const qs of BAD) {
      it(`400 for: "${qs}"`, async () => {
        const res = await GET(req(qs));
        expect(res.status).toBe(400);
      });
    }
    it('does not echo unsanitized input in the error body', async () => {
      const res = await GET(req('from=<script>&to=COP&date=2026-01-01'));
      const body = JSON.stringify(await res.json());
      expect(body).not.toContain('<script>');
    });
  });
  ```
  Run: `pnpm test fx-input-hardening`. Expected: all 400s; no `<script>` echoed. If the error body reflects raw input, sanitize/omit it (return only `error: 'invalid_query'` + Zod issue codes, not raw values) — **High**.

- [ ] **5.2 — PDF parser: magic-byte + size caps (re-verify F6).** F6's parser entry is `lib/import/pdf-text.ts`, exporting `extractStatementText(file: File)` with error codes `NOT_PDF`/`TOO_LARGE`/`TOO_MANY_PAGES` (see plan F6, Task 7). Adapt the call shape to the real signature (it takes a `File`; the size-cap constant lives in that module). Write `tests/unit/security/pdf-guards.test.ts`:
  ```ts
  import { describe, it, expect } from 'vitest';
  import { extractStatementText } from '@/lib/import/pdf-text';

  function bytes(header: number[], total: number): Uint8Array {
    const a = new Uint8Array(total);
    header.forEach((b, i) => (a[i] = b));
    return a;
  }
  const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46]; // %PDF

  describe('PDF guards', () => {
    it('rejects a non-PDF (wrong magic bytes)', async () => {
      const png = bytes([0x89, 0x50, 0x4e, 0x47], 1024);
      await expect(parsePdfStatement(png.buffer)).rejects.toThrow(/pdf|magic|format/i);
    });
    it('rejects an oversized file before parsing', async () => {
      const huge = bytes(PDF_MAGIC, MAX_PDF_BYTES + 1);
      await expect(parsePdfStatement(huge.buffer)).rejects.toThrow(/size|large|cap/i);
    });
  });
  ```
  Run: `pnpm test pdf-guards`. Expected: green. If F6 lacks a magic-byte or size check, add it at the parser entry (reject before handing bytes to pdfjs) — **High**, and document the cap value in the report.

- [ ] **5.3 — PDF render is escaped — XSS fixture (the explicit malicious-merchant test).** A statement whose merchant text contains `<script>` must render as inert text, never execute. Build a component test against F6's import-review table (reuse `CategoryChip` per the spec). Write `tests/component/security/pdf-xss.test.tsx`:
  ```tsx
  import { describe, it, expect } from 'vitest';
  import { render, screen } from '@testing-library/react';
  import { NextIntlClientProvider } from 'next-intl';
  import esMessages from '@/messages/es.json';
  // F6's review-table component (plan F6, Task 9) + its parsed-row type.
  import { ReviewTable } from '@/components/import/ReviewTable';

  const MALICIOUS = '<script>window.__xss=1</script><img src=x onerror="window.__xss=1">';

  function withIntl(ui: React.ReactElement) {
    return <NextIntlClientProvider locale="es" messages={esMessages}>{ui}</NextIntlClientProvider>;
  }

  describe('PDF import review escapes merchant text (no XSS)', () => {
    it('renders a malicious merchant as inert text, executes nothing', () => {
      (window as unknown as { __xss?: number }).__xss = undefined;
      const rows = [{
        id: 'r1', amount: 1000, currency: 'COP', date: '2026-01-01',
        merchant: MALICIOUS, categoryId: 'preset-otros', source: 'import' as const,
      }];
      render(withIntl(<ImportReviewTable rows={rows} />));
      // The literal text is shown (React escapes it); no script ran.
      expect(screen.getByText(/window\.__xss=1/)).toBeInTheDocument();
      expect((window as unknown as { __xss?: number }).__xss).toBeUndefined();
      // No live <script> element was injected into the table.
      expect(document.querySelector('script[data-from-merchant]')).toBeNull();
    });
  });
  ```
  Run: `pnpm test pdf-xss`. Expected: green. React escapes by default — this test guards against any future `dangerouslySetInnerHTML` regression in the import path. If F6 used `dangerouslySetInnerHTML` for merchant/notes anywhere, that is **High** — replace with plain text rendering.

- [ ] **5.4 — Grep gate against `dangerouslySetInnerHTML` and `eval`** across the app (defense in depth). Add to `scripts/security/check-ui-invariant.sh` (or a new check):
  ```bash
  if grep -rEn "dangerouslySetInnerHTML|[^a-zA-Z.]eval\(|new Function\(" app components lib --include='*.ts' --include='*.tsx' 2>/dev/null | grep -v node_modules; then
    echo "FAIL: dangerous HTML/eval usage found"; exit 1
  fi
  echo "OK: no dangerouslySetInnerHTML/eval"
  ```
  Run the script. Expected: `OK`. Any hit is reviewed and justified or removed.

- [ ] **5.5 — Commit:** `test(security): F10 input hardening — /api/fx malformed battery + PDF magic/size/XSS`.

---

## 6. App-lock review (PIN hash device-local, PBKDF2 params, backoff, WebAuthn UV)

Audits F2 (`lib/lock/*` — adjust path if F2 differs). The PIN hash must never leave the device, PBKDF2 must use sane params, repeated wrong attempts must back off, and WebAuthn must require user verification.

- [ ] **6.1 — PIN hash never leaves the device (grep gate).** The PBKDF2 hash/salt are written ONLY to device-local storage (localStorage/IndexedDB), never to a Supabase table or `/api`. Verify no lock module writes the hash to the network/DB:
  ```bash
  # The lock module may use localStorage (device-local is the whole point) but must
  # NOT import supabase or POST the PIN/hash anywhere.
  grep -rEn "@supabase/|fetch\(|\.from\(" lib/lock 2>/dev/null && echo "REVIEW: lock touches network/DB" || echo "OK: lock is device-local only"
  # And no lock-related column exists in any migration.
  grep -riEn "pin|pbkdf2|webauthn|credential" supabase/migrations 2>/dev/null && echo "REVIEW: lock material in DB schema" || echo "OK: no lock columns in DB"
  ```
  Expected: `OK: lock is device-local only` and `OK: no lock columns in DB`. Any DB/network write of PIN material is **Critical** — move it device-local.

- [ ] **6.2 — PBKDF2 parameters audit + test.** Read F2's hashing code; confirm: PBKDF2-HMAC-SHA-256, **≥ 100,000 iterations**, a per-PIN random salt (≥ 16 bytes via `crypto.getRandomValues`), constant-time comparison of the derived bits. Write `tests/unit/security/pin-hash.test.ts` (adjust import to F2's export):
  ```ts
  import { describe, it, expect } from 'vitest';
  import { hashPin, verifyPin, PBKDF2_ITERATIONS } from '@/lib/lock/pin';

  describe('PIN hashing (PBKDF2)', () => {
    it('uses >= 100k iterations', () => {
      expect(PBKDF2_ITERATIONS).toBeGreaterThanOrEqual(100_000);
    });
    it('salts: same PIN hashed twice yields different stored hashes', async () => {
      const a = await hashPin('1234');
      const b = await hashPin('1234');
      expect(a.hash).not.toBe(b.hash);  // different salt → different derived bits
      expect(a.salt).not.toBe(b.salt);
    });
    it('verifies the correct PIN and rejects a wrong one', async () => {
      const stored = await hashPin('1234');
      expect(await verifyPin('1234', stored)).toBe(true);
      expect(await verifyPin('0000', stored)).toBe(false);
    });
  });
  ```
  Run: `pnpm test pin-hash`. Expected: green. If iterations < 100k or no per-PIN salt, fix in F2's module — **Medium/High**.

- [ ] **6.3 — Attempt backoff.** Repeated wrong PINs must throttle (lockout window after N failures) so the 4–6 digit space can't be brute-forced quickly on a stolen unlocked device. Read F2's unlock logic; if no backoff exists, add one (e.g. exponential delay or lockout after 5 fails) device-local. Write `tests/unit/security/lock-backoff.test.ts` against the lock state machine (adjust import):
  ```ts
  import { describe, it, expect } from 'vitest';
  import { registerFailedAttempt, isLockedOut, resetAttempts, MAX_ATTEMPTS } from '@/lib/lock/backoff';

  describe('app-lock attempt backoff', () => {
    it('locks out after MAX_ATTEMPTS consecutive failures', () => {
      resetAttempts();
      for (let i = 0; i < MAX_ATTEMPTS; i++) registerFailedAttempt();
      expect(isLockedOut().lockedOut).toBe(true);
      expect(isLockedOut().retryAfterMs).toBeGreaterThan(0);
    });
    it('a successful unlock resets the counter', () => {
      resetAttempts();
      registerFailedAttempt(); registerFailedAttempt();
      resetAttempts();
      expect(isLockedOut().lockedOut).toBe(false);
    });
  });
  ```
  Run: `pnpm test lock-backoff`. Expected: green. (If F2 implemented backoff differently, adapt the test to its API; the property — throttle after repeated failures — must hold. Missing backoff is **Medium**.)

- [ ] **6.4 — WebAuthn `userVerification: required` (grep gate + audit).** The platform-authenticator ceremony must demand user verification (biometric/PIN), not just presence:
  ```bash
  grep -rn "userVerification" lib/lock 2>/dev/null
  ```
  Expected: every `navigator.credentials.create`/`.get` options object sets `userVerification: 'required'` (and `authenticatorAttachment: 'platform'` for register). If any uses `'preferred'`/`'discouraged'`, change to `'required'` — **Medium**. Record verified in the report.

- [ ] **6.5 — Commit:** `test(security): F10 app-lock review — PBKDF2 params, backoff, WebAuthn UV gates`.

---

## 7. Data lifecycle — export completeness, account deletion, local wipe on sign-out

Closes the lifecycle items from spec §5: export must contain everything the user owns; account deletion must remove cloud rows AND the auth user; explicit sign-out must wipe the local cache on a shared device.

- [ ] **7.1 — Export completeness audit + test.** `exportAll()` (F3 `SupabaseRepository`) currently bundles `expenses`, `categories`, `settings`. Per spec it must include **all** user-owned data — add `budgets` and `category_rules` to the bundle (or document why they are intentionally excluded). Decision for this plan: **include budgets + category_rules** so an export is a complete personal backup. If `ExportBundle` lacks those fields, extend the type and both repos (Local + Supabase) symmetrically. Add `tests/integration/export-complete.int.test.ts`: seed a signed-in user with one row in every user table, call `exportAll()`, assert every category of data is present and counts match. Run via `pnpm test:int`. Expected: green. (If extending `ExportBundle` ripples into F3's mappers/UI, keep it minimal and re-run the full suite.)

- [ ] **7.2 — Account deletion path (cloud rows + auth user).** Spec §5 + D requires deletion from Ajustes. If F1–F3 did NOT ship it, F10 adds it now:
  - **Cloud rows:** `SupabaseRepository.wipeAll()` (F3) already deletes the user's rows across tables under RLS. Verify it covers every user table (`expenses`, `budgets`, `category_rules`, `categories`, `settings`).
  - **Auth user deletion:** RLS cannot delete the `auth.users` row from the client. Add a server path. Preferred: a Supabase **Edge Function** `delete-account` (Deno) that (a) reads the caller's JWT, (b) `auth.admin.deleteUser(user.id)` via the service key (function-local secret, never client), after the client has called `wipeAll()`. Alternative if Edge Functions are out of scope: a Next Route Handler `app/api/account/route.ts` `DELETE` that authenticates via `getUser()` then uses the service client `auth.admin.deleteUser`. Write the handler with the same auth-then-act shape as `/api/fx`. Add `tests/unit/security/account-delete.test.ts`: 401 when anonymous; calls `admin.deleteUser(user.id)` (mocked) when authenticated; never accepts a target id from the request body (always derives it from the session). Run: `pnpm test account-delete`. Expected: green. Wire a "Eliminar cuenta" action in Ajustes that confirms, calls `wipeAll()`, then the deletion endpoint, then signs out. (Accepting a user id from the body would be **Critical** — the id MUST come from the verified session.)

- [ ] **7.3 — Local cache wipe on explicit sign-out (shared-device policy).** **Policy (documented):** an **explicit** sign-out from Ajustes wipes the local cache (`condor:*` localStorage keys + any outbox/lock-unrelated cached data) so the next user on a shared device sees nothing of the previous user. App-lock and a passive session expiry do NOT wipe (that would lose the offline cache for the legitimate user); only the deliberate "Cerrar sesión" action wipes. Implement a `wipeLocalCache()` in `lib/data` that removes `condor:expenses|categories|settings|imported|outbox` (enumerate the real keys) but preserves device-local app-lock config if the user keeps the account (on account *deletion*, wipe lock config too). Call it from the F1 `AccountSection` sign-out handler, after `supabase.auth.signOut()` and before `router.replace('/login')`. Add `tests/unit/security/local-wipe.test.ts` (jsdom): seed `condor:*` keys, call `wipeLocalCache()`, assert they're gone. Run: `pnpm test local-wipe`. Expected: green. Document the policy in the report and (briefly) in the Ajustes sign-out confirmation copy.

- [ ] **7.4 — Commit:** `feat(security): F10 data lifecycle — full export, account deletion, local wipe on sign-out`.

---

## 8. Final report + credential rotation checklist

- [ ] **8.1 — Run the full gauntlet** to confirm nothing regressed and every gate is green:
  ```bash
  pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm security:gates
  supabase start && pnpm test:int && pnpm security:rls
  pnpm e2e
  ```
  Expected: all green. Capture the summary lines for the report.

- [ ] **8.2 — Write `docs/superpowers/SECURITY-REVIEW-PHASE2.md`.** Structure:
  - **Scope & date** — F0–F8 cumulative diff (`<BASE>..HEAD`), reviewer, tools (`/security-review`, gates, RLS suite, curl).
  - **Findings table** — one row per finding: `ID | Area (auth/RLS/headers/input/lock/lifecycle/deps) | Severity (Critical/High/Medium/Low) | Description | Fix applied (commit) | Regression gate`.
  - **Gate inventory** — each automated gate (secret-leak, NEXT_PUBLIC, UI-invariant, RLS coverage SQL, header test, prod-bypass test, input batteries, lock tests) with the command to re-run it.
  - **Verified-by-hand** — session refresh/expiry, sign-out cookie cleanup, preview header curl output (pasted), prod e2e-bypass curl output (pasted).
  - **Residual risk / accepted items** — e.g. CSP `'unsafe-inline'` (Low, future nonce migration), per-instance rate limiter (per D4), any deferred advisory.
  - **Credential rotation checklist** (D7) — see 8.3.

- [ ] **8.3 — Credential rotation checklist (D7) — the chat-exposed `sb_secret` + `sbp_` token.** Include in the report AND execute (these literally transited a chat channel):
  ```
  [ ] Rotate the Supabase SECRET (service) key:
      Supabase dashboard → Project svgphkbtspqgsliqbsfx → Settings → API → roll the
      service/secret key (or `supabase` CLI equivalent). Then update SUPABASE_SECRET_KEY:
        - .env.local (local)
        - `vercel env rm SUPABASE_SECRET_KEY <env>` + `vercel env add SUPABASE_SECRET_KEY <env>` for Production + Preview + Development
      Redeploy. Confirm /api/fx still upserts fx_rates (smoke) and the OLD key is rejected.
  [ ] Rotate the `sbp_…` Supabase personal ACCESS TOKEN (the CLI/management token):
      `supabase` account → Access Tokens → revoke the exposed token → create a new one →
      re-auth the CLI (`supabase login`) with the new token. Confirm `supabase projects list` works.
  [ ] Audit for accidental publishable-key reliance: the publishable key is client-safe and
      does NOT need rotation, but confirm no SECRET ever shipped client-side (re-run security:gates).
  [ ] Record rotation date + who in this report. Do NOT paste any key value into the report.
  ```
  Execute the rotation via the authenticated Supabase + Vercel CLIs (never print key values), then check the boxes in the committed report.

- [ ] **8.4 — Commit:** `docs(security): F10 Phase-2 security review report + credential rotation log`.

---

## Done criteria

- [ ] `pnpm security:gates` green: no server secret in `.next/static`/`out`, no secret under `NEXT_PUBLIC_`, UI never imports supabase-js/fetch/localStorage (only `lib/data|fx|auth|lock` + `app/api` do).
- [ ] `pnpm audit --prod` has zero unresolved high/critical advisories (or each is documented as non-exploitable).
- [ ] RLS: cross-user SELECT/UPDATE/DELETE/INSERT denied on `categories`, `expenses`, `settings`, `budgets`, `category_rules`; `fx_rates` read-OK/write-denied; `rls-coverage.sql` proves no user-scoped table lacks RLS+policy.
- [ ] Auth: exhaustive allowlist test passes (only `/login`, `/auth/callback`, PWA/static public); callback rejects forged/missing `code`; gate uses server-validated `getUser()`; `e2e-auth` bypass proven inert under `NODE_ENV=production` (unit + prod-server curl).
- [ ] Headers: CSP + `nosniff` + `Referrer-Policy` + `Permissions-Policy(publickey-credentials-get=(self))` + `X-Frame-Options` present (config test + preview curl); SW/PWA still works; HSTS confirmed from Vercel.
- [ ] App-lock: PIN hash device-local only (no DB/network), PBKDF2 ≥100k iters + per-PIN salt, attempt backoff, WebAuthn `userVerification: required`.
- [ ] Input: `/api/fx` 400s the full malformed battery and never echoes raw input; PDF rejects bad magic/oversize and renders a `<script>` merchant as inert text; no `dangerouslySetInnerHTML`/`eval` in app code.
- [ ] Lifecycle: export includes all user tables; account deletion removes cloud rows + the auth user (id always from the session, never the body); explicit sign-out wipes the local cache (policy documented).
- [ ] `docs/superpowers/SECURITY-REVIEW-PHASE2.md` written with findings/severity/fix/gate; D7 credential rotation executed and logged (no key values committed).
- [ ] Full gauntlet green: `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm security:gates && pnpm test:int && pnpm security:rls && pnpm e2e`.
```
