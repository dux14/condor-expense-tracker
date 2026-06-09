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

TBD-measure

## 4. Free-tier thresholds & alerts

TBD-measure

## 5. Spend management & when to upgrade

TBD-measure

## 6. Verification (suite + e2e green)

TBD-measure
