# F11 — Cost Review (Vercel + Supabase) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Audit the production cost footprint of Cóndor (Vercel app `condor` + Supabase project `svgphkbtspqgsliqbsfx`) after F0–F8 are live, prove the no-LLM / no-Upstash / no-Storage design (decisions D3/D4/D5) keeps both platforms inside their free tiers, apply a short list of concrete optimizations, and write down the limits-vs-usage-vs-projection thresholds to watch. This is an audit + light-optimization feature: it produces one living document (`docs/superpowers/COST-REVIEW-PHASE2.md`) and a handful of small, verified config/code changes. It must NOT regress functionality — the full suite + e2e stay green.

**Architecture:** Pure measurement + tuning over the existing stack; no new runtime surface. Vercel side: one Hobby project serving a Next.js server build (after F0 dropped `output:'export'`), with exactly one dynamic server endpoint (`/api/fx`, F5), a session-refresh middleware (F1), a hand-rolled service worker (`public/sw.js`), and otherwise static/prerendered pages. Supabase side: Postgres with RLS user tables (`expenses`, `categories`, `settings`, `budgets`, `fx_rates`, `category_rules`), accessed by `supabase-js` over HTTPS (no pooler-critical path, no Realtime, no Storage). The cost levers are: function invocations + Active CPU (driven almost entirely by `/api/fx` and middleware), Fast Data Transfer (driven by page/asset payloads — bundle size + SW cache hit ratio), Image Optimization usage (driven by `next/image`), and Supabase DB size / egress / MAU / the 7-day inactivity pause. The audit reads these via the Vercel CLI / dashboard and Supabase CLI / SQL, compares against live-verified free-tier limits, then tightens the SW precache, the middleware matcher, the image strategy, and the bundle budget.

**Tech Stack:** Vercel CLI (`vercel`, authenticated as `dux14`) + Vercel dashboard for metrics the CLI doesn't expose; Supabase CLI (`supabase`, linked to `svgphkbtspqgsliqbsfx`) + raw SQL via `supabase db` / SQL editor; Next.js 16 build output (`pnpm build`) for bundle-size budgets; `public/sw.js` (hand-rolled SW) for precache tuning; `middleware.ts` (F1) for matcher scoping; `next.config.ts` for the image strategy; `next/image` (`components/common/CondorLogo.tsx`). pnpm for every command. WebSearch / official docs for verifying 2026 free-tier numbers before recording them.

---

## Dependencies & assumptions (read before starting)

- **Runs LAST.** F0–F8 must be merged and deployed to production (`https://condor-ecru-gamma.vercel.app/`). This plan measures the *real* production footprint; running it before the features ship produces meaningless numbers. If `/api/fx` (F5) or the migrations (F3/F7/F8) are not yet in prod, STOP and report.
- **Vercel CLI is authenticated** as `dux14` (global setup). Verify with `vercel whoami`. The local repo must be linked: `vercel link` (project `condor`, scope `dux14`) if `.vercel/project.json` is absent. NEVER print or paste tokens.
- **Supabase CLI is authenticated** (org `dux14's Org`) and the repo is linked to `svgphkbtspqgsliqbsfx` (done in F0 via `supabase link`). Verify with `supabase projects list` and `cat supabase/config.toml | grep project_id`. NEVER print the `sb_secret`/`sbp_` values.
- **Free-tier numbers drift — verify live.** The reference figures below were confirmed via web search on **2026-06-07**; treat them as *starting hypotheses* and re-confirm each one against the official pricing/limits pages (or the dashboard's own usage meter, which always shows the current cap) before writing it into the threshold table. Do NOT hardcode a number you didn't re-verify this session.
  - **Vercel Hobby (ref. 2026-06-07):** 1M function invocations/mo · 4 Active CPU hours/mo · 100 GB Fast Data Transfer/mo · 1M edge requests/mo · 10 s function max duration · Hobby is paused (not billed) on overage; you cannot buy extra usage on Hobby. Source: vercel.com/docs/plans/hobby, vercel.com/docs/limits.
  - **Supabase Free (ref. 2026-06-07):** 500 MB DB size · 5 GB DB egress/mo · 5 GB cached egress/mo · 50,000 MAU · 1 GB Storage (unused here) · 2 active projects · **project pauses after 7 days of no database activity** (dashboard visits / cached responses don't count; ~30 s to wake on resume). Source: supabase.com/pricing, supabase.com/docs/guides/platform/billing-on-supabase.
- **App profile:** single user / a handful of users, personal finance PWA. Expected real usage is orders of magnitude under every limit; the *only* plausible free-tier risk is the Supabase 7-day inactivity pause (a personal app can easily go a week untouched) and, secondarily, accidental Image Optimization usage now that F0 enabled it.
- **The service worker is hand-rolled** (`public/sw.js`, `CACHE_VER = 'condor-v2'`, app-shell precache + SWR for same-origin + network-first navigations + `api.frankfurter.app` never-cache). `@serwist/next`/`serwist` are in `package.json` but unused — do not introduce Serwist as part of F11.
- **No credential values in the doc or commits.** Reference env vars / projects by name only.
- Every commit is scoped to F11. Commit messages are given verbatim per task.

---

## Task 0 — Preconditions + create the living doc (quick win)

- [ ] **0.1** Verify tooling + linkage (no secrets printed):
  ```bash
  vercel whoami
  test -f .vercel/project.json && cat .vercel/project.json || echo "NOT LINKED — run: vercel link"
  supabase projects list
  grep -n project_id supabase/config.toml || echo "NOT LINKED — run: supabase link"
  ```
  **Expected:** `vercel whoami` prints `dux14`; `.vercel/project.json` shows project name `condor`; `supabase projects list` lists `svgphkbtspqgsliqbsfx`; `config.toml` contains its `project_id`.
  **If linkage is missing:** run `vercel link` (scope `dux14`, project `condor`) and/or `supabase link --project-ref svgphkbtspqgsliqbsfx`, then re-run.

- [ ] **0.2** Confirm F0–F8 are in production (the things this audit measures must exist):
  ```bash
  grep -n "output" next.config.ts || echo "OK: no output:export (F0 landed)"
  ls app/api/fx/route.ts && echo "OK: /api/fx exists (F5 landed)"
  ls middleware.ts && echo "OK: middleware exists (F1 landed)"
  ls supabase/migrations/*.sql
  ```
  **Expected:** no `output:` line in `next.config.ts`; `/api/fx/route.ts` present; `middleware.ts` present; migration files present.
  **If any fail:** STOP — F11 runs after F0–F8. Report which feature is missing.

- [ ] **0.3** Create the skeleton document `docs/superpowers/COST-REVIEW-PHASE2.md` with these headings (fill them in across the tasks below — leave `TBD-measure` placeholders only inside this doc, never in code):
  ```markdown
  # Cóndor Phase 2 — Cost Review (Vercel + Supabase)

  _Audit date: 2026-06-__ · Author: <agent/Samu> · App: condor (Vercel, dux14) / svgphkbtspqgsliqbsfx (Supabase)_
  _Profile: single/few users, personal finance PWA. Design recap: no LLM (D3), no Upstash (D4), no Realtime/Storage (D5/D3)._

  ## 1. Vercel baseline (Hobby)
  ## 2. Supabase baseline (Free)
  ## 3. Optimizations applied
  ## 4. Free-tier thresholds & alerts
  ## 5. Spend management & when to upgrade
  ## 6. Verification (suite + e2e green)
  ```
- [ ] **0.4** Commit: `docs(cost): scaffold Phase-2 cost review document`.

---

## Task 1 — Vercel baseline via CLI + dashboard (section 1)

Record real numbers; where the CLI can't surface a metric, document the exact dashboard path so the next reviewer doesn't guess.

- [ ] **1.1** Plan + recent deployments (CLI):
  ```bash
  vercel teams ls            # confirm the team/plan owning `condor`
  vercel projects ls         # confirm project name + framework
  vercel ls condor           # recent deployments
  vercel inspect <latest-prod-deployment-url>   # build + function metadata
  ```
  Record in §1: current plan (expected **Hobby**), production URL, latest prod deployment id, build framework/runtime.
  **Note:** the Hobby plan name shows in the dashboard account/plan page; if `vercel teams ls` is ambiguous, confirm at **Dashboard → (account) → Settings → Plan**.

- [ ] **1.2** Usage metrics (dashboard — the CLI does not expose historical usage meters on Hobby). Document each path and copy the current value + the meter's stated cap into §1:
  - Function invocations + **Active CPU**: **Dashboard → condor → Usage → Functions** (Active CPU hours, invocation count).
  - **Fast Data Transfer** (bandwidth): **Dashboard → condor → Usage → Fast Data Transfer**.
  - **Edge Requests**: **Dashboard → condor → Usage → Edge Requests** (middleware runs here — sanity-check the matcher isn't firing on assets).
  - **Image Optimization**: **Dashboard → condor → Usage → Image Optimization** (transformations / source images). This is the metric F0 turned on — expect near-zero if the only `next/image` is the static logo; if it's non-trivial, Task 4 addresses it.
  - **Build minutes / build time**: **Dashboard → condor → Usage → Builds** (or read per-build duration from `vercel inspect`).
  Note the current billing period so the numbers are anchored in time.

- [ ] **1.3** Sanity-check what actually invokes functions (so §1 explains the drivers, not just totals):
  ```bash
  ls app/api/*/route.ts                # should be exactly: app/api/fx/route.ts
  grep -rn "runtime" app/api app/**/route.ts 2>/dev/null
  ```
  **Expected:** the only Function is `/api/fx` (F5), plus middleware on the edge. Confirm there are no stray API routes from earlier phases. Record the driver list in §1.

- [ ] **1.4** Write §1 of the doc with the measured values + drivers + the conclusion (expected: invocations/CPU/bandwidth far under Hobby caps for a personal app). Commit: `docs(cost): record Vercel Hobby baseline`.

---

## Task 2 — Supabase baseline via CLI + SQL (section 2)

- [ ] **2.1** DB size + per-table row counts + per-table on-disk size (SQL). Run against the linked project — prefer `supabase db` / the SQL editor; do NOT paste connection strings into the doc:
  ```sql
  -- total logical DB size
  select pg_size_pretty(pg_database_size(current_database())) as db_size;

  -- per-table rows + total size (public schema, user tables)
  select
    relname as table,
    n_live_tup as est_rows,
    pg_size_pretty(pg_total_relation_size(relid)) as total_size
  from pg_stat_user_tables
  where schemaname = 'public'
  order by pg_total_relation_size(relid) desc;
  ```
  Record `db_size` and the per-table breakdown in §2. **Expected tables:** `expenses`, `categories`, `settings`, `budgets`, `fx_rates`, `category_rules`. Largest is likely `fx_rates` (one row per from/to/date pair) — note its growth pattern (bounded by currency-pairs × dates the user actually queries).

- [ ] **2.2** Egress + MAU + connections (dashboard — these are platform meters, not SQL). Document the path and copy values into §2:
  - **DB egress** (5 GB/mo cap): **Dashboard → svgphkbtspqgsliqbsfx → Reports → Database / Usage → Egress**.
  - **MAU** (50k cap): **Dashboard → Authentication → Users** count, and **Usage → Monthly Active Users**. Expected: 1–few.
  - **Connections:** **Dashboard → Database → Connection Pooling** / **Reports → Database**. Note: the app uses `supabase-js` over HTTPS (PostgREST), so direct-connection/pooler pressure is effectively nil — record this as "non-critical, HTTP data API" in §2.
  Egress estimate cross-check (back-of-envelope, document the formula): `egress ≈ avg_response_bytes × requests/month`. For a single user syncing a small ledger, this is a few MB/month — log the estimate next to the meter reading.

- [ ] **2.3** Verify the inactivity-pause behavior **live** (this is the one real risk for a personal app):
  - Re-confirm the current Free-tier pause rule via official docs (WebSearch `supabase free tier project pause inactivity 2026` → supabase.com/docs). Reference (2026-06-07): pauses after **7 days with no database activity**; ~30 s wake on resume; manual unpause from the dashboard.
  - Decide + document a mitigation in §2 (pick ONE, default to **Option A**):
    - **Option A (recommended, zero-cost):** Accept the pause; document the manual-unpause path (**Dashboard → Project → Restore/Resume**) and the ~30 s first-request latency. Rationale: a personal app that's gone a week unused has no live session to disrupt; the cost of a keep-alive is added invocations/complexity for no user benefit. The PWA's offline cache (SW + localStorage) keeps the app usable while the project wakes.
    - **Option B (only if Samu wants zero wake-latency):** A daily health-check that issues a trivial query (`select 1` against a tiny table) to count as DB activity. **Implement WITHOUT Vercel Cron** (Hobby cron is limited and adds invocations) — prefer a free external pinger (e.g. a GitHub Actions scheduled workflow hitting a read-only Supabase RPC, or `cron-job.org`). If chosen, add it as a separate documented task; do NOT add it silently. Note the trade-off: tiny added egress/invocations vs. no wake-latency.
  - Default for F11: document **Option A** unless Samu explicitly requests Option B.

- [ ] **2.4** Write §2 with measured DB size, row counts, egress, MAU, connection note, and the chosen pause mitigation. Commit: `docs(cost): record Supabase Free baseline + inactivity-pause decision`.

---

## Task 3 — Quick-win optimizations: SW precache + FX cache + middleware matcher (section 3)

These are the high-leverage, low-risk levers. Verify each with a build/test before moving on.

- [ ] **3.1 — `/api/fx` cache hit ratio (verify F5's headers are doing their job).** Confirm the endpoint still emits the immutable cache header for past dates (set in F5) and that the SW correctly bypasses the upstream FX host:
  ```bash
  grep -n "Cache-Control\|max-age=86400\|immutable" app/api/fx/route.ts
  grep -n "NEVER_CACHE\|frankfurter" public/sw.js
  ```
  **Expected:** `app/api/fx/route.ts` sets `Cache-Control: public, max-age=86400, immutable` for resolved past-date rates; `public/sw.js` lists `api.frankfurter.app` in `NEVER_CACHE`. Then spot-check live:
  ```bash
  curl -sI "https://condor-ecru-gamma.vercel.app/api/fx?from=USD&to=COP&date=2026-06-01" | grep -i "cache-control\|x-vercel-cache"
  ```
  **Note:** `/api/fx` requires an authenticated session (F5 returns 401 anon), so this curl may 401 — that's fine; the goal is to confirm the header shape on an authorized request (use a browser devtools Network capture against a logged-in session if curl is unauthenticated). Record the observed `x-vercel-cache` HIT/MISS behavior in §3. **If the header is missing**, that's an F5 regression — report it; do not patch F5 logic inside F11.

- [ ] **3.2 — Service worker precache audit.** The SW already precaches the app shell. Make sure it precaches the *real* shipped routes and brand assets so repeat visits don't re-hit Vercel (saving Fast Data Transfer + edge requests). Cross-check `APP_SHELL` against the actual routes/assets:
  ```bash
  find app -name page.tsx -not -path "*/node_modules/*"   # routes that should be in APP_SHELL
  ls public/brand public/icons
  grep -n "APP_SHELL\|CACHE_VER" public/sw.js
  ```
  **Expected today:** `APP_SHELL` lists `/`, `/anadir`, `/categorias`, `/ajustes`, `/historico`, the manifest, and the brand/icon PNGs. After F1, a `/login` route exists — add `/login` to `APP_SHELL` if it's a real prerendered page. If F6/F7/F8 added a route (e.g. `/tendencias`), add it too. When you change `APP_SHELL`, **bump `CACHE_VER`** (e.g. `condor-v2` → `condor-v3`) so clients re-precache.
  Apply the edit, then verify the SW still parses:
  ```bash
  node --check public/sw.js && echo "sw.js OK"
  ```
  **Expected:** `sw.js OK`. Record the precache list + new `CACHE_VER` in §3.

- [ ] **3.3 — Middleware matcher excludes static assets (coordinate with F1).** Every request the middleware runs on is a billed edge request *and* adds latency. Confirm F1's matcher already excludes Next internals, static files, images, the manifest, and the service worker:
  ```bash
  grep -n "matcher" -A8 middleware.ts
  ```
  **Expected:** a matcher like `'/((?!_next/static|_next/image|favicon.ico|icons|brand|manifest.webmanifest|sw.js).*)'` (or equivalent negative-lookahead) — i.e. middleware does NOT run on `sw.js`, `/icons/*`, `/brand/*`, the manifest, or `_next/*`. **If the matcher is missing any of `sw.js` / `icons` / `brand` / `manifest.webmanifest`**, add them to the negative lookahead (this is a legitimate F11 tightening — it directly cuts edge-request count). Re-run the auth middleware test to prove the gate still works:
  ```bash
  pnpm test run tests/unit/auth/middleware-session.test.ts
  ```
  **Expected:** all middleware-session tests pass (the matcher change must not weaken the gate; if a test asserts behavior on an excluded path, the exclusion is correct and the test scope was wrong — flag it, don't blindly edit). Record the final matcher in §3.

- [ ] **3.4** Commit: `perf(cost): precache real routes in SW + tighten middleware matcher to skip static assets`.

---

## Task 4 — Image strategy decision: `next/image` vs `unoptimized` (section 3 cont.)

F0 removed `images.unoptimized`, so Vercel Image Optimization is now active. Cóndor's only `next/image` consumer is the static, small brand logo (`components/common/CondorLogo.tsx`, `src="/brand/condor-mark.png"`). On Hobby, Image Optimization is metered and capped — paying that meter to "optimize" a single tiny static PNG is pure overhead. Decide deliberately and document the trade-off.

- [ ] **4.1** Inventory all `next/image` usage and the assets behind it:
  ```bash
  grep -rn "next/image\|<Image" app components src 2>/dev/null
  ls -la public/brand public/icons
  ```
  **Expected:** essentially one consumer (`CondorLogo.tsx`) pointing at a small local PNG; icons are referenced directly (manifest/`<link>`), not via `next/image`. Record the inventory in §3.

- [ ] **4.2** Decide the strategy (default: **re-disable optimization explicitly**). Rationale: assets are static, small, and few; Hobby Image Optimization quota is limited; pre-sized PNGs need no runtime transform. Set it explicitly in `next.config.ts` so the choice is visible and intentional:
  ```ts
  // next.config.ts — explicit: assets are static/small, skip the metered optimizer on Hobby (F11)
  const nextConfig: NextConfig = {
    images: { unoptimized: true },
    // ...keep whatever F0/F1 added (e.g. remotePatterns for Google avatar in F1)
  };
  ```
  **Trade-off to write in §3:** `unoptimized: true` means `next/image` serves the original file as-is (no WebP/AVIF re-encode, no per-viewport resizing) — fine for a hand-sized, already-optimized logo; it removes all Image Optimization metering and avoids the Hobby cap entirely. The alternative (keep optimization) only pays off if the app later serves many large/remote images — revisit then.
  **Important:** if F1 added `images.remotePatterns` for the Google avatar (`lh3.googleusercontent.com`), preserve it. Note that with `unoptimized: true`, remote avatars are still rendered (just not re-encoded) — confirm the avatar still loads (it's typically a tiny remote image; the initials fallback covers failure).
  **Alternative if you must keep optimization for remote avatars but not local assets:** use a custom `loader` that passes local `/brand`/`/icons` through untouched. Only do this if §1.2's Image Optimization meter showed meaningful usage; otherwise the global `unoptimized: true` is simpler and strictly cheaper.

- [ ] **4.3** Verify the build is clean and the logo/avatar still render:
  ```bash
  pnpm build
  pnpm test run tests/unit
  ```
  **Expected:** build succeeds; unit tests pass. Then visually confirm the logo renders (`pnpm dev`, load `/`) and, if applicable, the Google avatar in Ajustes.

- [ ] **4.4** Commit: `perf(cost): set images.unoptimized explicitly — skip metered image optimizer for small static assets`.

---

## Task 5 — Bundle-size budget + static prerender of /login (section 3 cont.)

The Phase-1 budget is **< 120 KB first-load JS**. Measure it, list the worst offenders, and keep cheap pages static.

- [ ] **5.1** Produce the build report and read First Load JS per route:
  ```bash
  pnpm build
  ```
  Next prints a per-route table with **First Load JS** and a shared-chunk line. Copy into §3: (a) the largest First Load JS across routes, (b) the shared baseline, (c) whether any route exceeds 120 KB. Flag the **top offenders** (largest contributing chunks). Known heavy-by-design dep to watch: the PDF parser (`unpdf`/pdfjs, F6) — per D9/F6 it MUST be lazy-loaded (dynamic `import()`), so it should NOT appear in any route's First Load JS. Verify:
  ```bash
  grep -rn "unpdf\|pdfjs" app components lib src 2>/dev/null | grep -v "import(" 
  ```
  **Expected:** the PDF parser is only referenced via dynamic `import()` (the grep above, which filters out dynamic imports, should return nothing in render paths). If pdfjs is in a route's static First Load JS, that's an F6 budget bug — report it.

- [ ] **5.2** Confirm cheap pages are statically prerendered (not forced dynamic), which keeps them off the function/CPU meters. Check the build output's render-mode markers (○ Static / ƒ Dynamic) for `/login` and the marketing-ish shell pages:
  ```bash
  grep -rn "force-dynamic\|export const dynamic\|export const revalidate" app 2>/dev/null
  ```
  **Expected:** `/login` (F1) is a client component but should be **statically prerendered** (no `force-dynamic`); the gate is enforced by middleware, not by making the page dynamic. If anything forces `/login` (or other static pages) dynamic without need, note it. Only the routes that genuinely read per-request session data (handled by middleware) need dynamic behavior; the page shells stay static. Record the static/dynamic split in §3. Do not refactor F1 inside F11 — if `/login` is needlessly dynamic, flag it as a follow-up.

- [ ] **5.3** Write the §3 "Optimizations applied" summary: FX cache verified, SW precache widened, middleware matcher tightened, image optimizer disabled, bundle budget measured (with the offender list) and within/over 120 KB, static-prerender status. Commit: `docs(cost): record bundle budget + static-prerender audit`.

---

## Task 6 — Thresholds, alerts, and spend management (sections 4 + 5)

- [ ] **6.1** Build the §4 threshold table — three columns per metric: **limit (live-verified)** · **current usage (from Tasks 1–2)** · **projection / headroom**. Re-confirm each limit this session (don't trust the references blindly):
  | Platform | Metric | Free limit (verify live, date it) | Current | Projection / headroom |
  |---|---|---|---|---|
  | Vercel Hobby | Function invocations / mo | ~1M (verify) | from §1 | trivial for 1 user |
  | Vercel Hobby | Active CPU hrs / mo | ~4 (verify) | from §1 | `/api/fx` only |
  | Vercel Hobby | Fast Data Transfer / mo | ~100 GB (verify) | from §1 | SW cuts repeat fetches |
  | Vercel Hobby | Edge requests / mo | ~1M (verify) | from §1 | matcher excludes assets |
  | Vercel Hobby | Image Optimization | capped (verify) | ~0 after Task 4 | N/A (unoptimized) |
  | Supabase Free | DB size | 500 MB (verify) | from §2 | grows w/ fx_rates+ledger |
  | Supabase Free | DB egress / mo | 5 GB (verify) | from §2 | few MB/mo |
  | Supabase Free | MAU | 50,000 (verify) | from §2 | 1–few |
  | Supabase Free | Inactivity pause | 7 days no DB activity (verify) | n/a | mitigation = Task 2.3 |
  Set a **watch line** at ~70% of each limit and write it in §4 ("if X exceeds 70% of cap, act"). For a single-user app the realistic trigger is none of these except the pause.

- [ ] **6.2** Document §5 spend management — what actually happens at the edge of each free tier and when upgrading is warranted:
  - **Vercel Hobby:** on exceeding included usage the project is **paused, not billed** (Hobby cannot purchase overage). Re-verify via docs. Consequence: if a cap is hit, the *site goes down* until the period resets or you upgrade to **Pro (~$20/mo)** — which is the trigger to upgrade (sustained traffic approaching caps, or a need to never go down). Document where to see/enable any spend/usage notifications: **Dashboard → (account) → Settings → Billing / Usage**.
  - **Supabase Free:** Free has no paid overage; exceeding caps degrades/restricts the project rather than auto-billing. The **Spend Cap** concept applies to *paid* plans (Pro $25/mo with a spend cap that, when on, prevents overage charges by restricting usage). On Free, the practical controls are the usage meters + the inactivity pause. Document: upgrade to Pro is warranted only if (a) DB > ~500 MB, (b) the 7-day pause becomes unacceptable (Pro projects don't auto-pause), or (c) egress approaches 5 GB. Re-verify the spend-cap mechanics live.
  - State the headline conclusion: **with D3/D4/D5 in force and 1–few users, Cóndor stays comfortably inside both free tiers; the only operational item is the Supabase 7-day pause (mitigation per Task 2.3).**

- [ ] **6.3** Commit: `docs(cost): thresholds table + spend-management + upgrade triggers`.

---

## Task 7 — Verification: app fully functional after optimizations (section 6)

The optimizations touched `public/sw.js`, `middleware.ts` (matcher), and `next.config.ts` (images). Prove nothing broke.

- [ ] **7.1** Full unit + integration suite:
  ```bash
  pnpm test
  ```
  **Expected:** the entire existing suite (the ~3.4k-line suite plus everything F1–F8 added) is green. Zero failures. If anything fails, it is caused by a Task 3/4 change — fix the change (or revert that specific optimization), never weaken a test.

- [ ] **7.2** Production build:
  ```bash
  pnpm build
  ```
  **Expected:** clean build, no new warnings about images/middleware/routes.

- [ ] **7.3** End-to-end (auth gate, lock, picker, import review, core flows):
  ```bash
  pnpm e2e
  ```
  **Expected:** all Playwright specs pass. Pay special attention to: the login gate still redirects (matcher change), static assets still load (matcher exclusions), the logo/avatar render (image change), and offline/PWA behavior still works (SW `CACHE_VER` bump → confirm the SW re-installs and the app shell is available offline).

- [ ] **7.4** Manual PWA smoke (since the SW changed): `pnpm dev`, install/reload as PWA, toggle offline in devtools, confirm the precached routes load offline and the new `CACHE_VER` is the active cache (Application → Cache Storage). Record pass/fail in §6.

- [ ] **7.5** Fill §6 with the verification evidence (suite count, build status, e2e status, PWA smoke result). Commit: `docs(cost): record post-optimization verification (suite + build + e2e green)`.

---

## Done criteria

- `docs/superpowers/COST-REVIEW-PHASE2.md` is complete: live-verified Vercel + Supabase baselines, applied-optimization summary, a thresholds table (limit / current / projection at 70% watch lines), spend-management + upgrade-trigger notes, and verification evidence.
- Applied changes are minimal and verified: SW precache widened + `CACHE_VER` bumped, middleware matcher excludes static assets, `images.unoptimized` set explicitly with a documented trade-off, bundle budget measured against 120 KB with offenders listed.
- Supabase 7-day inactivity-pause decision is documented (default: accept + manual unpause; Option B keep-alive only if Samu requests it).
- `pnpm test`, `pnpm build`, and `pnpm e2e` all green; PWA offline smoke passes.
- No credential values appear anywhere in the doc or commits.
- Headline conclusion recorded: the no-LLM / no-Upstash / no-Storage design keeps both platforms inside their free tiers for the single/few-user profile.
```
