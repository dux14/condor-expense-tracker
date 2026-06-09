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

TBD-measure

## 3. Optimizations applied

TBD-measure

## 4. Free-tier thresholds & alerts

TBD-measure

## 5. Spend management & when to upgrade

TBD-measure

## 6. Verification (suite + e2e green)

TBD-measure
