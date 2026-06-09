# Cóndor — Phase-2 Security Review (F10)

**Scope:** Cumulative security audit-with-fixes over Phase-2 features F0–F9 of Cóndor, a real-money
personal-finance PWA (Next.js 16 App Router · Supabase Postgres + RLS · offline-first sync · server FX
proxy · client PDF import · device-local app-lock).

**Diff reviewed:** `9136e54..690c00c` (base = F9 merge; head = F10 branch `feat/f10-security-scan`).
**Date:** 2026-06-09 · **Reviewer:** dux14 (Samuel Duque) with Claude Code (subagent-driven, two-stage review per task).
**Tools:** `/security-review` (high-confidence vuln scan over the diff), automated gates (`pnpm security:gates`),
RLS coverage SQL + per-table cross-user integration suite, Zod malformed-input battery, app-lock unit tests,
production-build `curl` of the auth bypass + headers.

---

## 1. Summary

The audit found the cloud-confidentiality boundary (Supabase RLS + server-validated auth) **already
sound** — `/security-review` reported zero high-confidence vulnerabilities across the F0–F9 diff and
positively confirmed every key property. Most sections therefore **lock in** existing correctness with
regression gates/tests rather than fixing holes. Two areas needed **real code fixes**:

- **App-lock backoff was not persistent** (Medium/High): the brute-force throttle lived in React state,
  so reloading the PWA reset it — defeating it on a stolen device. Fixed with a persistent, time-based
  lockout (`lib/lock/backoff.ts`).
- **Data lifecycle was incomplete** (Medium): export omitted budgets + category_rules; there was no
  account-deletion path; explicit sign-out did not wipe the local cache on a shared device. All added,
  with the account-deletion endpoint made **server-authoritative** (no client-trust, ordered to avoid
  orphaning cloud PII).

All gates green at close: typecheck · lint (0 errors) · 604 unit tests · `pnpm build` · `security:gates`
(4/4) · 32 integration tests · `security:rls`. E2E (`pnpm e2e`) is browser-dependent and runs in CI.

---

## 2. Findings

| ID | Area | Severity | Description | Fix / Disposition | Regression gate |
|----|------|----------|-------------|-------------------|-----------------|
| F10-01 | deps | Low (was High) | `playwright <1.55.1` advisory — dev/build-time transitive only, never in the production runtime bundle. | Accepted (reclassified Low; not in prod surface). Bump opportunistically. | `pnpm audit` in CI |
| F10-02 | deps | Low (was Moderate) | `postcss <8.5.10` advisory — build-toolchain transitive via Next; our CSS is authored, not attacker-controlled. | Accepted (reclassified Low; not exploitable in our usage). | `pnpm audit` in CI |
| F10-03 | RLS | — (verified) | Per-table cross-user isolation on all 5 user tables (categories/expenses/settings/budgets/category_rules) + `fx_rates` global-read/client-write-denied. | No defect — RLS + `with check` + privilege revokes confirmed. | `rls-isolation.int.test.ts` (21) · `security:rls` SQL |
| F10-04 | auth | — (verified) | Middleware gate uses server-validated `getUser()` (not cookie `getSession()`); OAuth callback validates `code` and is open-redirect-safe on `next`. | No defect. | `middleware-allowlist.test.ts` · `auth-callback.test.ts` |
| F10-05 | auth | — (verified) | The `e2e-auth` test bypass is hard-gated `NODE_ENV !== 'production'`. | No defect — proven inert at the real HTTP layer (prod build → `307 /login` with the bypass cookie). | `e2e-bypass-prod.test.ts` + prod-build curl |
| F10-06 | headers | Low→fixed | No CSP / security headers were set. | **Fixed:** strict CSP + `X-Content-Type-Options`/`Referrer-Policy`/`X-Frame-Options`/`Permissions-Policy` (WebAuthn-enabled) via `next.config.ts` `headers()`; PWA service worker + Google avatars verified working. | `security-headers.test.ts` |
| F10-07 | input | — (verified) | `/api/fx` Zod gate rejects malformed currency/date; error body emits only static Zod messages (no raw-input echo); duplicate-param pollution resolves deterministically to the first value. | No defect. | `fx-input-hardening.test.ts` (14) |
| F10-08 | input | — (verified) | PDF import enforces magic-byte (`%PDF-`) + 10 MB size cap before parsing; merchant text renders React-escaped (no `dangerouslySetInnerHTML`). | No defect. | `pdf-guards.test.ts` · `pdf-xss.test.tsx` · UI-invariant `eval`/`dangerouslySetInnerHTML` gate |
| **F10-09** | **lock** | **Medium/High → FIXED** | App-lock attempt backoff lived in **in-memory React state**; a PWA reload reset it, making a 4-digit PIN (10k space) brute-forceable at no cost on a held device. | **Fixed:** persistent, time-based lockout in `lib/lock/backoff.ts` (localStorage-backed, `MAX_ATTEMPTS=5`, 30 s window) wired into `LockScreen`; lockout now **survives reload**. | `lock-backoff.test.ts` (reload-survival assertion) |
| F10-10 | lock | — (verified) | PIN hashing: PBKDF2-HMAC-SHA-256, 210 000 iterations, 16-byte random per-PIN salt, constant-time compare; hash never leaves the device. WebAuthn ceremonies require `userVerification: 'required'` + platform authenticator. | No defect. | `pin-hash.test.ts` · `webauthn-uv.test.ts` |
| **F10-11** | **lifecycle** | **Medium → FIXED** | `exportAll()` omitted `budgets` + `category_rules` (incomplete personal backup). | **Fixed:** `ExportBundle` extended; both repos updated symmetrically; import schema is backward-compatible (`.default([])`). | `export-complete.int.test.ts` |
| **F10-12** | **lifecycle** | **Medium → ADDED** | No account-deletion path (cloud rows + auth user). | **Added:** `DELETE /api/account` — **server-authoritative**: deletes the user's rows (scoped by the **verified session** `user_id`, never the request body) **before** `auth.admin.deleteUser`, aborting on error so cloud PII can't be orphaned (no FK cascade). UI flow wired in Ajustes. | `account-delete.test.ts` (session-id invariant + ordering) |
| **F10-13** | **lifecycle** | **Medium → ADDED** | Explicit sign-out did not wipe the local cache → previous user's data visible on a shared device. | **Added:** `wipeLocalCache()` — prefix-sweeps all `condor:*` data keys (drift-proof), preserves app-lock config on sign-out, clears it on account deletion. | `local-wipe.test.ts` (drift guard + preserve/clear) |
| F10-14 | input/arch | Low → fixed | A raw `fetch()` to the deletion endpoint was added in a UI component (violates the "UI never touches network directly" invariant). | **Fixed:** extracted to `lib/auth/delete-account.ts`. | `check-ui-invariant.sh` |

**Commit map (F10 branch `feat/f10-security-scan`):**
`e3136a3` gates+audit (F10-01/02) · `3c79975` RLS (F10-03) · `47a20f9` auth surface (F10-04/05) ·
`9a4589a` headers/CSP (F10-06) · `021dd83` input hardening (F10-07/08) · `c5683e2` app-lock (F10-09/10) ·
`690c00c` data lifecycle (F10-11/12/13/14).

---

## 3. Gate inventory (how to re-run each)

| Gate | Command | Asserts |
|------|---------|---------|
| Secret-leak | `pnpm exec bash scripts/security/check-secret-leak.sh` | `SUPABASE_SECRET_KEY` never reachable from client bundle |
| NEXT_PUBLIC hygiene | `bash scripts/security/check-public-env.sh` | no secret exposed under `NEXT_PUBLIC_` |
| UI invariant | `bash scripts/security/check-ui-invariant.sh` | UI/non-edge code never imports supabase-js, calls raw `fetch`/`localStorage`, or uses `dangerouslySetInnerHTML`/`eval`/`new Function` |
| All three above | `pnpm security:gates` | bundles the gates for CI |
| RLS coverage (SQL) | `pnpm security:rls` | every public table has RLS on; every `user_id` table has a policy |
| RLS isolation (live) | `pnpm test:int tests/integration/rls-isolation.int.test.ts` | per-table cross-user SELECT/UPDATE/DELETE/INSERT denial + fx_rates read/write |
| Security headers | `pnpm test tests/unit/security/security-headers.test.ts` | CSP + 4 headers present, load-bearing directives intact |
| Prod auth-bypass | `pnpm test tests/unit/security/e2e-bypass-prod.test.ts` | bypass cookie inert under `NODE_ENV=production` |
| Allowlist / callback | `pnpm test tests/unit/security/middleware-allowlist.test.ts tests/unit/security/auth-callback.test.ts` | protected routes gated; callback rejects forged code/`next` |
| Input battery | `pnpm test tests/unit/security/fx-input-hardening.test.ts tests/unit/security/pdf-guards.test.ts tests/component/security/pdf-xss.test.tsx` | malformed FX → 400; PDF magic/size; merchant XSS inert |
| App-lock | `pnpm test tests/unit/security/pin-hash.test.ts tests/unit/security/lock-backoff.test.ts tests/unit/security/webauthn-uv.test.ts` | PBKDF2 params; persistent backoff; WebAuthn UV |
| Lifecycle | `pnpm test tests/unit/security/account-delete.test.ts tests/unit/security/local-wipe.test.ts` + `pnpm test:int tests/integration/export-complete.int.test.ts` | session-only deletion; cache wipe; full export |

**Full gauntlet (run at close, all green):**
`pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm security:gates` →
`supabase start && pnpm test:int && pnpm security:rls`. (`pnpm e2e` is browser-dependent → CI.)

---

## 4. Verified by hand

- **Production auth-bypass (F10-05):** `pnpm build` + `next start`, then
  `curl -s -i -b 'e2e-auth=1' http://localhost:3210/` → `HTTP/1.1 307 Temporary Redirect`, `location: /login`
  (not a 200 app shell). The bypass cookie grants nothing in a production build.
- **Security headers + SW (F10-06):** prod server `curl -s -i /sw.js` → `200`, `content-type: application/javascript`;
  `curl -s -I /` carries the full CSP + `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: DENY`,
  `Permissions-Policy: publickey-credentials-get=(self), …`. `connect-src` resolved the Supabase origin from env.
- **App-lock reload-survival (F10-09):** unit-proven — after `MAX_ATTEMPTS` failures, a fresh `isLockedOut()`
  read (simulating reload) still reports locked and the persisted key exists.
- **Session refresh / sign-out cookie cleanup:** middleware uses `getUser()` and returns the cookie-mutated
  response so rotated tokens persist; `supabase.auth.signOut()` clears `sb-*` cookies. Real-device OAuth
  refresh + cookie-clear is a manual acceptance step (deferred to on-device check).
- **Live preview header curl (§4.3):** deferred — to be captured against a Vercel preview where Vercel also
  injects `Strict-Transport-Security` (HSTS). See §6.

---

## 5. Residual risk / accepted items

- **CSP `'unsafe-inline'` on `script-src`** (Low): pragmatic Next-16 baseline. Future hardening: nonce-based CSP
  once verified not to break the Serwist SW.
- **`connect-src` env fallback + unpinned realtime** (Low): if `NEXT_PUBLIC_SUPABASE_URL` is unset at build,
  `connect-src`/`wss` fall back to `*.supabase.co` (any project). The `NEXT_PUBLIC` gate + build-time presence
  mitigate; consider failing the prod build loudly if unset and deriving the `wss` host from the origin.
- **Dependency advisories F10-01/02** (Low): dev/build-time transitive only; bump opportunistically.
- **Per-instance FX rate limiter** (per design decision D4): in-memory sliding window is per-serverless-instance,
  not global. Accepted for Phase 2.
- **App-lock is a presence/UV gate, not a confidentiality boundary** (by design): the real boundary is
  server-side Supabase RLS. The WebAuthn assertion is not verified against a backend (no RP server) — intentional.

---

## 6. Credential rotation checklist (D7) — ⚠️ PENDING USER EXECUTION

**Why:** during planning, a Supabase **secret (service) key** (`sb_secret_…`) and a **personal access token**
(`sbp_…`) transited a chat channel and must be rotated. **Rotation affects the live production deployment and
requires Supabase dashboard access to project `svgphkbtspqgsliqbsfx` (a different account than the default CLI
login).** It was therefore NOT executed autonomously — the steps below are for the project owner to run.
**Do not paste any key value into this report.**

```
[ ] Rotate the Supabase SECRET (service) key:
    Dashboard → Project svgphkbtspqgsliqbsfx → Settings → API → roll the service/secret key.
    Update SUPABASE_SECRET_KEY in:
      - .env.local (local)
      - Vercel: `vercel env rm SUPABASE_SECRET_KEY <env>` + `vercel env add SUPABASE_SECRET_KEY <env>`
        for Production + Preview + Development
    Redeploy. Smoke-test: /api/fx still upserts fx_rates; confirm the OLD key is rejected.

[ ] Rotate the `sbp_…` Supabase personal ACCESS TOKEN (CLI/management token):
    Supabase account → Access Tokens → revoke the exposed token → create a new one →
    re-auth the CLI (`supabase login`). Confirm `supabase projects list` works.

[ ] Confirm no SECRET ever shipped client-side: re-run `pnpm security:gates` (the secret-leak +
    NEXT_PUBLIC gates). The publishable key is client-safe and does NOT need rotation.

[ ] Record rotation date + operator here once done:  ____________________  (no key values).
```

---

## 7. Status at close

F10 complete: 14 findings dispositioned (3 real fixes: F10-09 lock, F10-11/12/13 lifecycle, F10-06 headers;
the rest verified-clean and regression-locked). All automated gates green. **Outstanding:** D7 credential
rotation (§6, owner action) and the live-preview HSTS/header curl (§4.3, post-deploy).
