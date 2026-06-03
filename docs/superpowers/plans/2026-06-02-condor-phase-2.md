# Cóndor Phase 2 Implementation Plan — Cloud, Auth, Import, Insights

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan milestone-by-milestone. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **This is an architecture-forward plan.** Unlike the Phase 1 plan (mechanical, fully-specified), several Phase 2 subsystems depend on choices that must be confirmed against current docs at build time (Supabase SSR auth, PDF parsing, LLM prompts, rate-limit libs). Those points are marked **[verify via context7]**. Each milestone is independently shippable.

**Goal:** Evolve Cóndor from a local-first single-device app into a multi-device, authenticated cloud app — adding Google sign-in, per-user cloud sync, PDF statement import with LLM categorization, month-over-month trends + anomaly detection, and budgets — **without rewriting the UI**, by reimplementing the `Repository` and `FxProvider` seams established in Phase 1.

**Architecture:** Keep all Phase-1 UI, store, selectors, and components. Swap `LocalStorageRepository` → `SupabaseRepository` (Postgres + Row-Level Security) behind the same `Repository` interface; wrap it in a sync layer so the app stays offline-first. Add server endpoints (FX proxy, PDF import, LLM) with rate limiting. Add new pure selectors + screens for trends/budgets.

**Tech Stack (confirm latest stable via context7 at build):** Supabase (Postgres + Auth + RLS + Storage + Edge Functions) · `@supabase/ssr` + `@supabase/supabase-js` · Google OAuth · Next.js 16 **server runtime** (drop `output: 'export'`) · Upstash Redis + `@upstash/ratelimit` · Claude API (`@anthropic-ai/sdk`, prompt caching) for categorization · a PDF text-extraction lib (e.g. `unpdf`/`pdf-parse` — [verify via context7]) · existing: Zustand, Zod, date-fns, next-intl, Tailwind v4, shadcn. pnpm throughout.

---

## 0. How this plan is organized

Phase 2 is **five independent subsystems**. Build them as ordered milestones; each ends green and shippable behind a flag:

| Milestone | Delivers | Depends on |
|-----------|----------|------------|
| **M0** Infra & deployment shift | Server-capable Next app on the chosen host; Supabase + Upstash provisioned; env wired | — |
| **M1** Auth | Google sign-in/out, sessions, route protection, guest↔account coexistence | M0 |
| **M2** Cloud Repository | Postgres schema + RLS; `SupabaseRepository`; one-time local→cloud import | M1 |
| **M3** Offline-first sync | Optimistic local cache + background reconcile; cross-device | M2 |
| **M4** Server FX + rate limiting | `ServerFxProvider` proxy + shared rate cache; Upstash limits | M0 (M2 for cache table) |
| **M5** PDF import + LLM categorize | Upload → parse → Claude categorize → review → bulk insert | M2, M4-style limiting |
| **M6** Trends + anomaly | Month-over-month selectors; "normal vs emergencia"; Tendencias view | M2/M3 (needs accumulated data) |
| **M7** Budgets | Per-category monthly budgets + progress + alerts | M2 |
| **M8** Hardening | Security review, RLS tests, e2e, Lighthouse, Phase-1 perf follow-up | all |

Ship order: **M0 → M1 → M2 → M3 → M4 → M5 → M6 → M7 → M8.** M6/M7 can swap order. After M3 the app is a working multi-device cloud tracker even if M5–M7 slip.

---

## 1. Locked decisions (flagged for veto before M0)

1. **Backend platform: Supabase** (Auth + Postgres + RLS + Storage + Edge Functions), provisioned via **Vercel Marketplace** *or* directly (Supabase CLI is already authenticated on this machine). Rationale: per-user **Row-Level Security** is native (the spec's "per-user row-level isolation"); one provider covers auth + DB + file storage (for PDFs) + serverless (Deno Edge Functions for parsing). Alternative considered: Neon (DB) + Auth.js/Clerk (auth) — more moving parts, manual isolation. **[verify provisioning path via context7 + the supabase skill]**
2. **Hosting for Phase 2: Vercel** (server runtime), not the current static export. Rationale: the spec assumes Vercel + Marketplace; native Next 16 server support, Route Handlers/Server Actions, middleware for auth, easy Upstash/Supabase integration, preview deploys. **Phase 1 (v1) currently deploys to Render as a static site — that stays as the "local-only" build; Phase 2 is a distinct server deployment.** (Render *can* also host the Next server if you prefer one platform — see Open Decisions.)
3. **Drop `output: 'export'`** for the Phase-2 build. Static export cannot do cookie-based SSR auth, Route Handlers, or middleware. The UI is unaffected (the Repository seam absorbs the change). Keep the app **client-heavy**; add server only for auth callback, FX proxy, PDF/LLM, and rate-limited endpoints.
4. **Repository swap, not rewrite:** implement `SupabaseRepository implements Repository` using `supabase-js` under RLS. The store is constructed via the existing `createCondorStore(repo, fx)` factory — swapping the repo is the entire integration for CRUD. Keep `LocalStorageRepository` as the **offline cache** layer (M3).
5. **Offline-first via optimistic local + background sync**, conflict policy **last-write-wins by `updatedAt`** per record. Rationale: single human across a few devices → conflicts are rare; LWW is simple and correct enough. CRDTs are overkill (YAGNI). A `SyncingRepository` decorator composes the local cache + remote.
6. **FX moves server-side** behind `ServerFxProvider` (a Route Handler proxying Frankfurter, caching rates in a shared `fx_rates` table, rate-limited). Client still only sees `getRate(from, base, date)`. Privacy posture preserved (only currency codes + date leave the device, now via our endpoint).
7. **PDF categorization uses the Claude API** (`@anthropic-ai/sdk` with **prompt caching**), invoked from a server function; LLM output is **Zod-validated** and surfaced as *suggestions the user reviews*, never auto-committed. **[use the claude-api skill; verify model id at build]**
8. **Rate limiting: Upstash Redis + `@upstash/ratelimit`**, per-user keys, on the FX proxy, PDF upload, and LLM endpoints. **[verify via context7]**
9. **Trends/anomaly = pure client selectors** over synced data (no new server compute in Phase 2); "emergencia" = a month's category spend that is a statistical outlier vs that category's trailing baseline.

If any of these are wrong, say so before M0.

---

## 2. Architecture (extends the Phase-1 seam)

```
            UI (unchanged) ── Zustand store ──┐
                                              │ Repository iface (unchanged)
                          ┌───────────────────┴───────────────────┐
                          │            SyncingRepository           │  ← M3 decorator
                          │  local cache (LocalStorageRepository)  │
                          │            +                           │
                          │  remote (SupabaseRepository, RLS)      │  ← M2
                          └───────────────────┬───────────────────┘
                                              │
   FxProvider iface ── ServerFxProvider ──► /api/fx (proxy+cache, rate-limited)  ← M4
                                              │
   Auth (Supabase, @supabase/ssr, middleware) ─ session/cookies                 ← M1
   /api/import (PDF → parse → Claude → suggestions, rate-limited)               ← M5
   Supabase Postgres: profiles, expenses, categories, settings, fx_rates,
                      budgets, import_jobs  — all under RLS per auth.uid()       ← M2/M7
```

**Invariant preserved:** components never import `supabase-js`, `fetch`, or `localStorage` directly — only the store + selectors. Verified by the same grep gate from Phase 1.

---

## 3. Data model (cloud) + RLS

Reuse the Phase-1 TypeScript types verbatim (`Expense`, `Category`, `Settings`, `ExportBundle`). Add `userId` server-side (RLS-injected, not in the client type). New Phase-2 types: `Budget`, `ImportJob`, `TrendPoint`, `Anomaly`.

Postgres schema (each table has `user_id uuid not null default auth.uid()` + RLS):

```sql
-- migrations/0001_core.sql  [exact columns mirror Phase-1 types]
create table categories (
  id uuid primary key, user_id uuid not null default auth.uid(),
  name text not null, color text not null, icon text not null,
  is_preset boolean not null default false, hidden boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table expenses (
  id uuid primary key, user_id uuid not null default auth.uid(),
  amount numeric not null check (amount > 0), currency text not null,
  base_amount numeric, fx_rate numeric,
  date date not null, category_id uuid not null references categories(id) on delete restrict,
  merchant text, note text, source text not null default 'manual',  -- 'manual' | 'import'
  created_at timestamptz not null, updated_at timestamptz not null
);
create table settings (
  user_id uuid primary key default auth.uid(),
  base_currency text not null default 'COP', locale text not null default 'es',
  theme text not null default 'auto', dashboard_view text not null default 'bars',
  schema_version int not null default 1
);
create table budgets (                              -- M7
  id uuid primary key, user_id uuid not null default auth.uid(),
  category_id uuid not null references categories(id) on delete cascade,
  amount_base numeric not null check (amount_base >= 0),
  period text not null default 'monthly',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (user_id, category_id, period)
);
create table fx_rates (                             -- M4 shared cache (no user_id; read-only to clients)
  from_ccy text not null, to_ccy text not null, on_date date not null, rate numeric not null,
  fetched_at timestamptz not null default now(), primary key (from_ccy, to_ccy, on_date)
);
create table import_jobs (                          -- M5
  id uuid primary key, user_id uuid not null default auth.uid(),
  status text not null default 'pending',  -- pending|parsing|categorizing|ready|committed|failed
  file_path text, suggestions jsonb, error text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
```

RLS pattern (every user-scoped table):
```sql
alter table expenses enable row level security;
create policy "own rows" on expenses
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
```
`fx_rates` is global read, server-write only (service role).

---

## Milestone M0 — Infra & deployment shift

**Goal:** A server-capable Next app deploys to Vercel (preview + prod); Supabase project + Upstash provisioned; env vars wired locally and in the host. CRUD still works (against existing local repo) — no behavior change yet.

**Checkpoint:** `pnpm build` (no `output:'export'`) succeeds; `vercel deploy` (preview) serves the app; `supabase status` / project reachable; env keys present (`vercel env ls`).

- [ ] **M0.1** Decide & record the Phase-2 deployment target (Vercel recommended; see Open Decisions). **[verify with the vercel:marketplace + supabase skills]**
- [ ] **M0.2** Remove `output: 'export'` + `images.unoptimized` from `next.config.ts` (keep a separate static build path for the Render v1 if desired, e.g. an env-gated config). Confirm `pnpm build` produces a server build.
- [ ] **M0.3** Provision Supabase: create project (Supabase CLI is authenticated — `supabase projects create` or Vercel Marketplace). Capture `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-only). `supabase link` the repo; create `supabase/migrations/`.
- [ ] **M0.4** Provision Upstash Redis (Vercel Marketplace) → `UPSTASH_REDIS_REST_URL`/`TOKEN`. Add `ANTHROPIC_API_KEY` (server-only) for M5.
- [ ] **M0.5** Link Vercel project (`vercel link`), push env (`vercel env add ...` for preview+prod; pull locally with `vercel env pull .env.local`). NEVER expose service role / Anthropic keys to the client (no `NEXT_PUBLIC_` prefix).
- [ ] **M0.6** CI: a GitHub Action running `pnpm install && pnpm typecheck && pnpm lint && pnpm test && pnpm build` on PRs (e2e optional/nightly). Vercel handles deploy previews per PR.
- [ ] **M0.7** Commit: `chore(infra): drop static export, provision supabase + upstash, wire env`.

---

## Milestone M1 — Auth (Google)

**Goal:** Users sign in with Google; sessions persist via cookies; protected areas redirect unauthenticated users; **guest/local mode still works** (an unauthenticated user keeps using the Phase-1 localStorage repo until they sign in).

**Checkpoint:** Sign in with Google → session cookie set → `auth.uid()` available server-side; sign out clears it; a Playwright test drives the flow (mock/stub the OAuth where needed).

**Files:** `lib/auth/supabase-browser.ts`, `lib/auth/supabase-server.ts` (`@supabase/ssr` clients), `middleware.ts` (session refresh + guard), `app/auth/callback/route.ts`, sign-in/out UI in Ajustes + a header affordance, `lib/auth/useSession.ts`.

- [ ] **M1.1 [verify via context7 + supabase skill]** Install `@supabase/supabase-js @supabase/ssr`. Create browser + server Supabase clients per the current `@supabase/ssr` cookie pattern (the API has changed across versions — confirm `getAll/setAll` cookie methods).
- [ ] **M1.2** Configure Google OAuth in the Supabase dashboard (provider keys) + redirect URLs (local + preview + prod). `app/auth/callback/route.ts` exchanges the code for a session.
- [ ] **M1.3** `middleware.ts`: refresh session on each request; optionally guard `/` etc. — but DESIGN for guest mode: do NOT hard-block; instead expose session state to the app so it chooses local vs cloud repo.
- [ ] **M1.4** UI: "Iniciar sesión con Google"/"Sign in with Google" button (Ajustes "Cuenta"/"Account" section + a small header avatar/menu); sign-out. Add i18n keys (`Cuenta` namespace, both locales).
- [ ] **M1.5** `useSession()` hook exposing `{ user, status }` to the app (the store/composition root reads it to pick the repo in M2).
- [ ] **M1.6** Component/e2e tests for the auth UI states (signed-out/in). Commit: `feat(auth): supabase google sign-in + sessions + guest coexistence`.

---

## Milestone M2 — Cloud Repository + local→cloud import

**Goal:** Authenticated users' data lives in Supabase under RLS; the store uses `SupabaseRepository`; on first sign-in, existing localStorage data is offered for one-time import.

**Checkpoint:** Signed-in user adds an expense → row appears in Postgres with their `user_id`; another device with the same account sees it after refresh; RLS denies cross-user reads (tested).

**Files:** `supabase/migrations/0001_core.sql` (+ RLS), `lib/data/supabase-repository.ts`, `lib/data/repository-factory.ts` (picks local vs supabase from session), `lib/data/import-local.ts`, store composition-root update.

- [ ] **M2.1** Write migrations (schema §3 + RLS policies) and apply (`supabase db push` / migration apply). Seed preset categories per-user **on first session** (a trigger on new `auth.users`, or app-side seeding in the repo's first `listCategories`).
- [ ] **M2.2** `SupabaseRepository implements Repository` — map every method (listExpenses/upsertExpense/deleteExpense/listCategories/upsertCategory/deleteCategory(id,reassignTo)/getSettings/putSettings/exportAll/wipeAll) to supabase-js queries. `deleteCategory` reassign = an UPDATE of expenses then DELETE (in a transaction/rpc). Keep the same async contract — **zero store/UI changes**.
- [ ] **M2.3** `repository-factory.ts`: returns `SupabaseRepository` when authed, else `LocalStorageRepository`. Update the store's composition root (`defaultStore`) to build from the factory + re-hydrate on auth change.
- [ ] **M2.4** First-sign-in import: detect existing `condor:*` localStorage data; prompt "Import your local data?" → `exportAll()` (local) → bulk upsert into Supabase → mark imported. Idempotent.
- [ ] **M2.5 (tests)** RLS isolation test (two users, user B cannot read A's rows); repository round-trip tests against a local Supabase (`supabase start`) in CI; import-merge test. Commit: `feat(data): SupabaseRepository under RLS + local→cloud import`.

---

## Milestone M3 — Offline-first sync

**Goal:** Keep the Phase-1 instant/offline feel for authed users: writes apply to a local cache immediately and reconcile to Supabase in the background; reads hydrate from cache then refresh from cloud; works offline and re-syncs on reconnect.

**Checkpoint:** Airplane-mode add → visible instantly → reconnect → row in Postgres; two devices converge (LWW by `updatedAt`); no data loss across a kill+reload mid-sync.

**Files:** `lib/data/syncing-repository.ts` (decorator wrapping local cache + `SupabaseRepository`), `lib/data/sync-queue.ts` (durable outbox in localStorage), Supabase Realtime subscription (optional) for live cross-device updates.

- [ ] **M3.1** `SyncingRepository`: reads return local cache immediately; writes go to cache + enqueue a sync op; a background worker flushes the queue to Supabase, applying **LWW by `updatedAt`**; pull remote changes on connect/focus (and via Realtime if enabled).
- [ ] **M3.2** Conflict handling: per-record LWW; deletes tombstoned until confirmed. Document the policy in code.
- [ ] **M3.3** Wire `SyncingRepository` into the factory for authed users (guest stays pure-local).
- [ ] **M3.4 (tests)** offline-add→reconnect, two-device convergence (simulated), queue durability across reload. Commit: `feat(sync): offline-first syncing repository (LWW)`.

---

## Milestone M4 — Server FxProvider + rate limiting

**Goal:** FX requests go through our server (cached in `fx_rates`, rate-limited), not the client→Frankfurter directly; `ServerFxProvider` implements the same `getRate`.

**Checkpoint:** A non-base expense triggers `/api/fx` once; repeat hits the DB cache (no upstream call); rate limit returns 429 past the threshold; offline → graceful `null` (store already handles).

**Files:** `app/api/fx/route.ts` (GET, Node runtime), `lib/fx/server-fx-provider.ts`, `lib/ratelimit.ts` (Upstash), `fx_rates` table (from §3).

- [ ] **M4.1** `/api/fx?from&to&date`: check `fx_rates` cache → on miss, fetch Frankfurter server-side, upsert cache (service role), return rate. Validate inputs with Zod; only currency codes + date accepted.
- [ ] **M4.2** `lib/ratelimit.ts` with `@upstash/ratelimit` (sliding window), keyed by `user_id` (or IP for guests); apply to `/api/fx`. **[verify via context7]**
- [ ] **M4.3** `ServerFxProvider implements FxProvider` → calls `/api/fx`, returns `number | null` (same contract). Swap into the FX composition root for all users (guests too — it's keyless + cached). Keep client Frankfurter as a fallback only if offline.
- [ ] **M4.4 (tests)** cache-hit avoids upstream, 429 on limit, null on upstream failure. Commit: `feat(fx): server FX proxy with shared cache + upstash rate limit`.

---

## Milestone M5 — PDF statement import + LLM categorization

**Goal:** User uploads a bank/credit-card PDF; the server extracts transactions, Claude proposes category + merchant + amount + date per line; the user reviews/edits a suggestions table; accepted rows bulk-insert as `source:'import'` expenses.

**Checkpoint:** Upload a sample statement → suggestions appear → edit one → "Import N" → N expenses created with correct categories; oversized/non-PDF rejected; rate-limited; LLM output Zod-validated (never trusted raw).

**Files:** `app/api/import/route.ts` (upload→job) + `app/api/import/[id]/route.ts` (status/result) **or** a Supabase Edge Function for parsing; `lib/import/parse-pdf.ts`, `lib/import/categorize.ts` (Claude), `lib/import/schema.ts` (Zod for suggestions), Supabase Storage bucket `statements`, review UI `app/importar/page.tsx`, `import_jobs` table.

- [ ] **M5.1 [verify via context7]** Choose a PDF text-extraction approach that runs in the server runtime (e.g. `unpdf`/`pdfjs`/`pdf-parse`). Extract raw text + heuristic line→transaction splitting. Enforce file-type + size limits; store the upload in Supabase Storage (private bucket, RLS).
- [ ] **M5.2 [use the claude-api skill]** `categorize.ts`: send extracted transactions to Claude (`@anthropic-ai/sdk`, **prompt caching** on the category list + few-shot), asking for structured JSON: per line `{ date, amount, currency, merchant, suggestedCategoryId, confidence }`. **Zod-validate** the response; drop/flag low-confidence; map to existing user categories (fallback "Otros").
- [ ] **M5.3** Job model: `import_jobs` rows track status (`pending→parsing→categorizing→ready`); the upload endpoint creates a job and processes async (Edge Function/queue or inline for Phase 2 scale). Rate-limit the upload + LLM calls (M4 limiter).
- [ ] **M5.4** Review UI `app/importar/page.tsx`: a table of suggestions with editable category (reuse `CategoryChip`), amount, date, merchant; select-all/deselect; "Importar N gastos" → bulk upsert via the store (so sync + base-amount FX run). Reachable from Ajustes/Histórico.
- [ ] **M5.5 (security)** Sandbox/limits: validate PDF magic bytes, cap pages/size, time-box parsing, never `eval` extracted content, escape on render. The LLM never writes to the DB — only proposes; the user commits. **[run the security-review skill on this milestone]**
- [ ] **M5.6 (tests)** parse a fixture PDF → expected transactions; categorize with a mocked Claude response → validated suggestions; reject non-PDF/oversized; e2e of the review→import flow. Commit: `feat(import): PDF upload + Claude categorization + review/commit`.

---

## Milestone M6 — Trends + anomaly detection ("normal vs emergencia")

**Goal:** With accumulated months of data, show month-over-month trends per category and flag spends/months that are out of the ordinary ("emergencia espontánea" vs normal).

**Checkpoint:** Tendencias view shows per-category trend lines + a flagged outlier; the anomaly rule is unit-tested on fixtures.

**Files:** `lib/domain/trends.ts` (pure selectors: `monthOverMonth`, `categoryBaseline`, `detectAnomalies`), `components/charts/TrendLine.tsx` (hand-rolled SVG, zero-dep), `app/tendencias/page.tsx` (or extend Histórico per spec §2.4), i18n keys.

- [ ] **M6.1 (TDD)** `trends.ts` pure selectors: `monthOverMonth(expenses, categoryId, nMonths)` → series; `categoryBaseline(...)` → trailing median + MAD (median absolute deviation); `detectAnomalies(...)` → flag a month/expense whose base spend exceeds `median + k·MAD` (k configurable) → label `'emergencia'` vs `'normal'`. Test on fixtures (steady history + one spike).
- [ ] **M6.2** `TrendLine.tsx` hand-rolled SVG sparkline/line (no chart lib — same constraint as Phase 1). `aria` summary + accessible table fallback.
- [ ] **M6.3** Tendencias screen: per-category trend + a "this month vs your normal" callout; anomaly chips on flagged expenses in Histórico. Commit: `feat(insights): month-over-month trends + anomaly detection`.

---

## Milestone M7 — Budgets

**Goal:** Per-category monthly budgets with progress indicators and over-budget warnings.

**Checkpoint:** Set a budget on a category → Inicio/Categorías show progress (spent/budget) → exceeding it shows a warning state; budget persists per user.

**Files:** `budgets` table + RLS (from §3), `Budget` type + Zod, store actions `setBudget`/`deleteBudget`, `lib/domain/budget-selectors.ts` (`budgetProgress`), UI: budget control in Categorías + progress on Inicio bars/Categorías rows, i18n.

- [ ] **M7.1** `Budget` type + Zod + migration (already in §3). Repository methods `listBudgets/upsertBudget/deleteBudget` added to the `Repository` interface (and implemented in Local + Supabase + Syncing repos — extending the seam consistently).
- [ ] **M7.2** `budgetProgress(expenses, budgets, month)` pure selector → `{ categoryId, spentBase, budgetBase, pct, over }[]`. TDD.
- [ ] **M7.3** UI: set/edit budget in Categorías (a field on the category sheet/list); progress bars + over-budget danger tint on Inicio + Categorías. Commit: `feat(budgets): per-category monthly budgets + progress`.

---

## Milestone M8 — Hardening, security, perf, acceptance

**Goal:** Production-ready: RLS proven, endpoints rate-limited + authz'd, e2e green, Lighthouse targets met (incl. the deferred Phase-1 perf pass now that SSR is available), security review clean.

**Checkpoint:** Security-review skill clean; RLS/authz tests green; full e2e (auth → cloud CRUD → offline sync → import → trends → budgets) green; Lighthouse ≥90 across perf/a11y/best-practices.

- [ ] **M8.1 [run the security-review skill]** on the whole diff: authz on every endpoint, RLS coverage on every table, no service-role/Anthropic key leakage, input validation, PDF sandboxing, rate-limit coverage, OWASP basics. Fix findings.
- [ ] **M8.2** RLS + authz integration tests (cross-user denial on every table; unauthenticated endpoint rejection).
- [ ] **M8.3** Perf pass (now feasible with SSR): server-render the shell, code-split heavy screens (importar, tendencias) + charts, trim next-intl bundle → clear the Phase-1 ≥90 / <120KB budget the static build missed.
- [ ] **M8.4** Full e2e covering the cloud flows (Playwright, against `supabase start` + a test user). Update `docs/superpowers/PHASE1-ACCEPTANCE.md` → add a Phase-2 acceptance section.
- [ ] **M8.5** Commit + production deploy; tag `v2.0`.

---

## 4. Security & privacy (Phase 2)

- **Per-user isolation via RLS** on every user table (`user_id = auth.uid()`), proven by tests (M2.5, M8.2). `fx_rates` is the only shared table (global read, service-role write).
- **Secrets server-only:** `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, Upstash token never `NEXT_PUBLIC_`. Client uses only the anon key (RLS-guarded).
- **Rate limiting** on `/api/fx`, `/api/import`, LLM calls (Upstash), per user.
- **PDF parsing sandboxed/limited** (type+size+page+time caps; magic-byte check; no eval; escaped render). LLM output is *suggestions only*, Zod-validated, user-committed.
- **FX privacy preserved:** only currency codes + date leave the device (now via our proxy).
- **Data export/delete** (existing `exportAll`/`wipeAll`) extended to cloud: account deletion removes all user rows (cascade) — a "Delete account" action.
- Keep the **UI-never-touches-network/storage** invariant (grep gate in M8).

---

## 5. Rollout, migration, backout

- **Feature-flag** each milestone (env or a simple flag) so cloud features ship dark and enable per-environment.
- **Guest→account migration** is one-time, idempotent, user-initiated (M2.4); local data is never destroyed by sign-in (it remains the offline cache).
- **Backout:** because the seam is preserved, reverting to local-only is flipping the repository factory back to `LocalStorageRepository`. The Render static v1 remains a always-working fallback build.
- **Two deploys coexist:** Render static `v1` (local-only, no account) and Vercel `v2` (cloud). Decide whether v2 supersedes v1 or they run in parallel (see Open Decisions).

---

## 6. Self-review vs spec §10 + §7.2

- §10 Google auth + cloud DB reimplementing Repository → M1, M2. Server FxProvider → M4. PDF import + server parse + LLM categorization → M5. API rate limiting → M4/M5. Month-over-month trends + anomaly → M6. Budgets → M7. "No UI rewrites thanks to §3.2" → preserved (Repository/FxProvider swap only).
- §7.2 Phase-2 security (Google auth, per-user RLS, API rate limiting, sandboxed PDF, secrets in env) → §4 + M8.
- **Gap check:** every §10 item maps to a milestone; nothing unassigned. The one genuinely novel risk surface (PDF/LLM) gets a dedicated security pass (M5.5, M8.1).

---

## 7. Open decisions for you (answer before M0)

1. **Hosting:** Vercel for v2 (recommended — Marketplace + native Next) **or** keep everything on Render (Next server as a Render Web Service + external Supabase/Upstash)? This affects M0 provisioning.
2. **v1 vs v2 coexistence:** does cloud v2 *replace* the app, or do you want to keep the Render static local-only build live alongside it?
3. **Supabase provisioning route:** via **Vercel Marketplace** (unified billing, auto env) or the **Supabase CLI** directly (already authenticated here)?
4. **Anonymous/guest mode:** keep full guest (local-only) usage indefinitely, or require sign-in after a trial?
5. **Sync transport:** background queue only, or also **Supabase Realtime** for instant cross-device updates (more infra, nicer UX)?
6. **PDF scope first cut:** which bank/card formats to target first (affects parsing heuristics)?

Once you've answered 1–3 (the blockers), M0 can start.
