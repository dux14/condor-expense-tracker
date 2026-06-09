# Cóndor Phase 2 — Cost Review (Vercel + Supabase)

_Audit date: 2026-06-09 · Author: Claude (agent) / Samu · App: condor (Vercel, team `dux14s-projects`) / svgphkbtspqgsliqbsfx (Supabase)_
_Profile: single/few users, personal finance PWA. Design recap: no LLM (D3), no Upstash (D4), no Realtime/Storage (D5/D3)._

## 1. Vercel baseline (Hobby)

**Plan / project (CLI-verified 2026-06-09):**
- Plan: **Hobby**, team `dux14's projects` (`dux14s-projects`), authenticated as `dux14`.
- Production alias: `https://condor-ecru-gamma.vercel.app`.
- Latest prod deployment: `dpl_6PLazpc1CN5tbz8q7D13uQWr1WJ4` (target `production`, created 2026-06-09 01:29 -05, git `fa2f9a6` = F0–F10 merged). Build duration ≈ 27 s.
- Framework: Next.js 16 server build (F0 dropped `output:'export'`); functions on the **nodejs** runtime; session middleware on the edge.

**Function / edge drivers (the things that actually meter):**
- `app/api/fx/route.ts` (F5) — `runtime=nodejs`, `dynamic=force-dynamic`; auth-gated (401 anon), per-user in-memory rate limit.
- `app/api/account/route.ts` (F10) — `force-dynamic`; account-deletion endpoint, auth-gated per request.
  - ⚠️ **Audit correction:** the F11 plan assumed *exactly one* Function (`/api/fx`). F10 added a second (`/api/account`). Both are auth-gated and invoked rarely (FX lookups during expense entry; account deletion is once-in-a-lifetime), so the driver count change does not move the cost needle.
- `middleware.ts` (F1) — session refresh; runs on every non-static request (matcher excludes `_next/*`, `sw.js`, `manifest`, `brand/`, and all image/font extensions — see §3).

**Usage meters — dashboard-only (the Hobby CLI does not expose historical usage meters; read at the paths below). Billing period: June 2026.**
| Metric | Where to read | Expected (fresh deploy, 1–few users) |
|---|---|---|
| Function invocations + **Active CPU** | Dashboard → condor → Usage → Functions | ≪ caps; only `/api/fx` + `/api/account` invoke. Near-zero CPU-hours. |
| **Fast Data Transfer** | Dashboard → condor → Usage → Fast Data Transfer | Few MB; SW precache (§3) kills repeat asset fetches. |
| **Edge Requests** | Dashboard → condor → Usage → Edge Requests | Middleware runs here; matcher excludes static assets (§3). |
| **Image Optimization** | Dashboard → condor → Usage → Image Optimization | ≈0 — only `next/image` consumer is the static logo; optimizer disabled in §3/Task 4. |
| **Builds** | Dashboard → condor → Usage → Builds (or `vercel inspect`) | ≈27 s/build, well within Hobby build allowance. |

> Note: this is a fresh production deployment (F0–F10 went live 2026-06-09 during this audit), so the meters read ≈0 for the current period regardless. The numbers to watch accrue over the billing month; thresholds + watch lines are in §4.

**Conclusion:** drivers are two auth-gated API routes + session middleware. For the single/few-user profile, invocations, Active CPU, Fast Data Transfer, and edge requests are all orders of magnitude under the Hobby caps (1M invocations · 4 CPU-hrs · 100 GB FDT · 1M edge req / mo).

## 2. Supabase baseline (Free)

**Project:** `svgphkbtspqgsliqbsfx` (repo linked via `supabase/config.toml`).

> **Measurement caveat:** the prod project lives on a **different Supabase account than the CLI's default login**, so `supabase db query` connects to the *local* Docker mirror (same migrations/schema), not prod. Prod-only platform meters (size/egress/MAU) are read from the dashboard at the paths below. The structural numbers (table set, relative sizes, growth pattern) are identical to prod because the schema is migration-driven.

**DB size & per-table (schema = prod; rows = local seed):**
- Schema baseline (all migrations applied, seed data): **12 MB** total logical DB size (Postgres system + extensions dominate; user tables are ~0.3 MB).
- Per-table (`pg_total_relation_size`): `expenses` 80 kB · `categories` 48 kB · `budgets` 48 kB · `category_rules` 48 kB · `settings` 32 kB · `fx_rates` 32 kB (0 rows). All **six expected tables present**.
- **Prod DB size:** read at **Dashboard → svgphkbtspqgsliqbsfx → Reports → Database** (or Usage → Database size). By construction (single-user ledger) ≈ 12–15 MB — **≪ 500 MB cap**.
- **Growth drivers:** `fx_rates` (one row per from/to/date pair the user actually queries — bounded by currency-pairs × dates) and the `expenses` ledger (a few rows/day for a personal app). Neither approaches 500 MB on any realistic horizon.

**Platform meters (dashboard-only):**
| Metric | Where to read | Estimate |
|---|---|---|
| **DB egress** (5 GB/mo) | Dashboard → svgphkbtspqgsliqbsfx → Reports / Usage → Egress | `egress ≈ avg_response_bytes × requests/mo` → a few **MB**/mo for one user syncing a small ledger. |
| **MAU** (50k) | Dashboard → Authentication → Users · Usage → Monthly Active Users | **1–few**. |
| **Connections** | Dashboard → Database → Connection Pooling / Reports | **Non-critical, HTTP data API** — the app uses `supabase-js` over HTTPS (PostgREST); no pooler/direct-connection critical path. |

**Inactivity-pause decision — Option A (accept the pause), per Samu (2026-06-09):**
- Free projects **pause after 7 days with no database activity** (dashboard visits / cached responses don't count; ~30 s to wake on resume). Re-verified live 2026-06-09 (supabase.com/pricing + billing docs).
- **Mitigation = manual unpause.** Path: **Dashboard → Project → Restore/Resume**; first request after wake takes ~30 s. The PWA's offline cache (SW app-shell + localStorage) keeps the app usable while the project wakes.
- **Rationale:** a personal app idle for a week has no live session to disrupt; a keep-alive (Option B) would add invocations/egress/complexity for no user benefit. Option B (a free external pinger — GitHub Actions cron or cron-job.org hitting a trivial read-only query — **never Vercel Cron**) stays documented here as the escape hatch *only if* zero wake-latency ever becomes a requirement.

**Conclusion:** with no Storage/Realtime and a single-user ledger, every Supabase Free meter sits far under its cap. The **only** operational item is the 7-day pause, mitigated by manual unpause (Option A).

## 3. Optimizations applied

### 3.1 `/api/fx` cache hit ratio (verified, no change)
- `app/api/fx/route.ts` emits `Cache-Control: public, max-age=86400, immutable` for a **resolved historical** rate and `no-store` otherwise (line 46–49). `public/sw.js` keeps `api.frankfurter.app` in `NEVER_CACHE` (the SW never caches the upstream FX host). Both confirmed correct — **no F5 change in F11**.
- Live spot-check: `GET /api/fx?...` against prod returns **307 → /login** for an unauthenticated request (the session middleware intercepts and redirects before the handler runs). So the `x-vercel-cache` HIT/MISS shape can only be observed on an authorized (logged-in) request via devtools Network — recorded here as a known probe limitation, not a regression.
- ⚠️ **Heritage smell (do NOT fix in F11):** the immutable response is marked `public` even though the route is auth-gated; a shared cache could in principle store a per-user value. Tracked as an F5 follow-up (already noted in PENDIENTES). Low impact (the value is a public FX rate, identical for all users), out of F11 scope.

### 3.2 Service worker precache widened (applied — commit `b6cf5ac`)
- `APP_SHELL` now precaches the **real shipped routes**: added `/login` (F1) and `/importar` (F6) to the existing `/`, `/anadir`, `/categorias`, `/ajustes`, `/historico` + manifest + brand/icon PNGs. No `/tendencias` route exists (F7 trends is a sub-view).
- `CACHE_VER` bumped **`condor-v2` → `condor-v3`** so installed clients re-precache the new shell. `node --check public/sw.js` passes.
- Effect: repeat visits to `/login` and `/importar` serve from the SW cache → fewer Fast-Data-Transfer bytes + edge requests hitting Vercel.

### 3.3 Middleware matcher (verified already-tight, no change)
- Matcher: `'/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icon.png|apple-icon.png|brand/|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)'`
- Already excludes `_next/*`, `sw.js`, `manifest.webmanifest`, `brand/`, and every image/font extension (which covers `/icons/*.png` via `.*\.png$`). **No gap found → no change.** `tests/unit/auth/middleware-session.test.ts` stays green (5/5). The matcher does not run on static assets, so it does not inflate edge-request count.

### 3.4 Image optimizer disabled (applied — commit `b035fcc`)
- `next.config.ts` now sets `images.unoptimized: true` explicitly, preserving `remotePatterns` (Google avatar host `lh3.googleusercontent.com`, mirrored in CSP `img-src`).
- **Trade-off:** `next/image` now serves originals as-is (no WebP/AVIF re-encode, no per-viewport resize) — fine for the one hand-sized, pre-optimized logo (`CondorLogo.tsx → /brand/condor-mark.png`). Remote avatars still render (just not re-encoded); the initials fallback covers failure. This removes **all** Image-Optimization metering and sidesteps the Hobby cap entirely. Revisit only if the app later serves many large/remote images. `pnpm build` clean, 520 unit tests green.

### 3.5 Bundle budget + static prerender
- **Static/dynamic split** (Next 16 build): every page route — `/`, `/ajustes`, `/anadir`, `/categorias`, `/historico`, `/importar`, **`/login`** — is **○ Static (prerendered)**. Only `/api/fx`, `/api/account`, and `/auth/callback` are **ƒ Dynamic** (genuinely per-request). `/login` is static and gated by middleware, not by `force-dynamic` ✅ — keeps cheap pages off the function/CPU meters. No needless `force-dynamic` on pages.
- **Lazy PDF parser confirmed:** `unpdf`/PDF.js appears only behind a dynamic `import()` (the sole static reference is a comment in `lib/import/pdf-text.ts`). On disk the heaviest chunk (≈472 KB gzip) is the PDF.js async chunk — loaded **only on demand at `/importar`**, NOT in any route's first load. D9/F6 budget held.
- **First Load JS budget (⚠️ flagged, measurement caveat):** Next 16 + Turbopack **no longer prints the per-route First Load JS table** and emits no `app-build-manifest.json`, so the canonical number isn't directly readable. As a proxy, the **shared baseline** (`rootMainFiles` + polyfills, loaded on every route) gzips to **≈168 KB**, which is **over the Phase-1 target of < 120 KB**. Top offenders: framework/React (~69 KB gz), app runtime + Supabase auth client (~75 KB gz combined). pdfjs is correctly excluded.
  - **Disposition:** this is a *flagged finding*, not an F11 fix. F11 is a cost audit + the SW/matcher/image levers; a bundle-size reduction is a separate effort. The cost dimension here is Fast Data Transfer, which (a) the SW precache mitigates for repeat visits and (b) is trivial in absolute terms for 1–few users (a 168 KB first paint a handful of times/day is nowhere near 100 GB/mo). **Follow-up:** run `@next/bundle-analyzer` for exact attribution and consider deferring the Supabase client off the shared baseline where feasible.

## 4. Free-tier thresholds & alerts

Limits re-verified live **2026-06-09** (vercel.com/docs/limits + plans/hobby; supabase.com/pricing + billing docs). **Watch line = 70 % of cap** — if a metric crosses it, act.

| Platform | Metric | Free limit (verified 2026-06-09) | Current usage | Projection / headroom | 70 % watch line |
|---|---|---|---|---|---|
| Vercel Hobby | Function invocations / mo | **1,000,000** | ~0 (fresh deploy); only `/api/fx` + `/api/account` | trivial for 1–few users | 700,000 |
| Vercel Hobby | Active CPU hrs / mo | **4** | ~0 | `/api/fx` + `/api/account` only, sub-second each | 2.8 hrs |
| Vercel Hobby | Fast Data Transfer / mo | **100 GB** | few MB | SW precache cuts repeat fetches | 70 GB |
| Vercel Hobby | Edge requests / mo | **1,000,000** | low | matcher excludes static assets | 700,000 |
| Vercel Hobby | Image Optimization | **metered/capped** | **~0** | N/A — `unoptimized: true` (§3.4) | n/a (disabled) |
| Supabase Free | DB size | **500 MB** | ~12–15 MB (schema 12 MB + tiny ledger) | grows slowly w/ `fx_rates` + ledger | 350 MB |
| Supabase Free | DB egress / mo | **5 GB** | few MB | single user, small responses | 3.5 GB |
| Supabase Free | Cached egress / mo | **5 GB** | negligible | — | 3.5 GB |
| Supabase Free | MAU | **50,000** | 1–few | — | 35,000 |
| Supabase Free | Active projects | **2** | 1 (`svgphkbtspqgsliqbsfx`) | — | n/a |
| Supabase Free | Inactivity pause | **7 days no DB activity** | n/a | mitigation = §2 Option A (manual unpause) | n/a |

> For the single/few-user profile, the realistic trigger across **all** of these is **none except the 7-day Supabase pause**. Every numeric meter sits 2–4 orders of magnitude under its cap.

## 5. Spend management & when to upgrade

**Vercel Hobby (verified 2026-06-09):**
- On exceeding included usage the project is **paused, not billed** — Hobby cannot purchase overage. Consequence: hitting a cap means the **site goes down** until the period resets (or you upgrade).
- **Upgrade trigger → Pro (~$20/mo):** sustained traffic approaching the caps, commercial use, or a hard requirement to never go down. None apply at 1–few users.
- Usage/notifications: **Dashboard → (account) → Settings → Billing / Usage**. Check the Usage tab periodically; there's no auto-bill surprise on Hobby (it pauses instead).

**Supabase Free (verified 2026-06-09):**
- Free has **no paid overage** — exceeding caps restricts/degrades the project rather than auto-billing. The **Spend Cap** concept applies to *paid* plans (Pro $25/mo, with a spend cap that, when on, prevents overage charges by restricting usage). On Free the practical controls are the usage meters + the inactivity pause.
- **Upgrade trigger → Pro ($25/mo)** only if: (a) DB approaches ~500 MB, (b) the 7-day auto-pause becomes unacceptable (Pro projects don't auto-pause), or (c) egress approaches 5 GB. None apply at 1–few users.

**Headline conclusion:** with **D3 (no LLM) / D4 (no Upstash) / D5 (no Realtime/Storage)** in force and a single/few-user profile, **Cóndor stays comfortably inside both free tiers**. The only operational item is the **Supabase 7-day inactivity pause**, accepted with manual-unpause mitigation (§2, Option A). No upgrade is warranted on current usage.

## 6. Verification (suite + e2e green)

TBD-measure
