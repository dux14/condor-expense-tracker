# Cóndor Phase 2 — Revised Design (2026-06-07)

**Status:** Approved by Samu (this session). Revises `docs/superpowers/plans/2026-06-02-condor-phase-2.md`.
**Goal:** Multi-device cloud app (desktop web, PWA mobile, web mobile) under one Google account, with bank-grade access control, plus aesthetic fixes, a full security scan, and a cost review.

---

## 1. Decisions locked this session (supersede the original plan where they conflict)

| # | Decision | Replaces |
|---|----------|----------|
| D1 | **No guest mode.** Login with Google is required to use the app. localStorage becomes the offline cache only. One-time import of existing local data on first sign-in stays. | Plan §M1.3/M2.3 guest coexistence |
| D2 | **App-lock (new scope):** lock screen on app open AND after N minutes of inactivity (default 5, configurable in Ajustes). Unlock via **WebAuthn platform authenticator** (Face ID iPhone, Touch ID Mac, Android fingerprint) with **PIN fallback** (4–6 digits, hashed via PBKDF2, stored device-local only). Lock is a UI gate over a live Supabase session — works offline. | — (new) |
| D3 | **PDF import without LLM.** Deterministic, **100% client-side** parser (`unpdf`/pdfjs in the browser — the PDF never leaves the device). Per-institution extraction templates fed by collected fixture PDFs. Categorization via a learning **merchant→category rules engine** (user corrections persist as rules in their account). Removes: Claude API, `ANTHROPIC_API_KEY`, Supabase Storage, `import_jobs` table, `/api/import` endpoints. | Plan §M5, locked decision 7 |
| D4 | **No Upstash Redis.** The only server endpoint left is `/api/fx`: protect it with the `fx_rates` DB cache + `Cache-Control` headers + per-instance in-memory cache and a lightweight in-memory rate limiter (Fluid Compute reuses instances). | Plan locked decision 8, §M0.4, §M4.2 |
| D5 | **Sync = background only** (on open, focus regain, reconnect). No Supabase Realtime. LWW by `updatedAt`. | Plan open decision 5 |
| D6 | **Vercel only.** Production already lives at `https://condor-ecru-gamma.vercel.app/`. No Render v1 to maintain. | Plan open decisions 1–2 |
| D7 | **Supabase project already provisioned** (`svgphkbtspqgsliqbsfx`), Google OAuth client already created. Secrets go in `.env.local` + Vercel env (server-only, never `NEXT_PUBLIC_` for the secret key). **Rotate the `sb_secret` key and the `sbp_` access token after setup** — they transited a chat channel. | Plan §M0.3 |
| D8 | **Per-feature short plans.** Each feature gets its own writing-plan split into short task sections (quick wins first) so an implementation session never exceeds ~80% context. | Plan execution model |
| D9 | **Mobile-first, PWA-first, performance-first.** Every screen/flow is designed for mobile (incl. iOS standalone PWA: safe-areas, touch targets, offline) and made responsive up to desktop — never the reverse. New features must keep the PWA installable/offline-capable and respect the perf budget (Lighthouse ≥90, no heavy deps; e.g. PDF parsing must be lazy-loaded so it never weighs on the core bundle). | — (cross-cutting principle) |

## 2. Architecture (delta over the Phase-1 seam)

```
        Login gate (Google via Supabase Auth, required)        ← F1
        App-lock gate (WebAuthn / PIN, open + inactivity)      ← F2  [UI gate, offline-capable]
                          │
   UI (unchanged) ── Zustand store ── Repository iface (unchanged)
                          │
              SyncingRepository (LWW, outbox in localStorage)  ← F4
              ├─ local cache: LocalStorageRepository (existing)
              └─ remote: SupabaseRepository under RLS          ← F3
                          │
   FxProvider ── ServerFxProvider ─► /api/fx (DB cache + memory cache + light rate limit) ← F5
   Client-side PDF parser (templates per bank) + rules engine  ← F6  [no server]
   Postgres: expenses, categories, settings, fx_rates,
             budgets, category_rules — RLS on every user table ← F3/F7/F8
```

Invariant preserved: components never import `supabase-js`/`fetch`/`localStorage` directly — only store + selectors (grep gate).

## 3. Feature breakdown (each gets its own plan file)

| Plan | Feature | Contents (summary) |
|------|---------|--------------------|
| **F0** | Infra | Drop `output:'export'`; `supabase link` (project `svgphkbtspqgsliqbsfx`); `supabase/migrations/`; `.env.local` + `vercel env` (URL, publishable key client-side; secret key server-only); CI gate. |
| **F1** | Auth | `@supabase/ssr` browser+server clients, `middleware.ts` session refresh + login requirement, `app/auth/callback`, login screen, sign-out in Ajustes, `useSession`. No guest mode. |
| **F2** | App-lock | Lock screen component + `useAppLock`; WebAuthn register/verify (platform authenticator, `userVerification: required`); PIN setup + PBKDF2 hash; inactivity timer (default 5 min, configurable); enable/disable in Ajustes; works offline; lock state never blocks data sync. |
| **F3** | Cloud repo | Migrations (schema below) + RLS `user_id = auth.uid()` on every user table; `SupabaseRepository implements Repository`; per-user preset seeding; one-time local→cloud import (idempotent, prompted); RLS isolation tests. |
| **F4** | Sync | `SyncingRepository` decorator + durable outbox (localStorage); flush on open/focus/reconnect; LWW by `updatedAt`; delete tombstones; convergence + durability tests. |
| **F5** | Server FX | `/api/fx?from&to&date` (Zod-validated): `fx_rates` table cache → Frankfurter on miss; in-memory per-instance cache + `Cache-Control`; light in-memory rate limit; `ServerFxProvider` same `getRate` contract. |
| **F6** | PDF import | Client-side `unpdf`/pdfjs extraction; per-institution template registry (start with fixtures Samu collects; generic fallback template); review table UI (reuse CategoryChip) → bulk insert `source:'import'`; `category_rules` table (merchant pattern → category, learned from corrections); magic-byte/size caps; everything stays on-device. |
| **F7** | Trends + anomaly | Pure selectors (`monthOverMonth`, `categoryBaseline` median+MAD, `detectAnomalies`); hand-rolled SVG `TrendLine`; Tendencias view; anomaly chips in Histórico. (Unchanged from original plan M6.) |
| **F8** | Budgets | `budgets` table + RLS; `Budget` type + repo methods in all three repos; `budgetProgress` selector; UI in Categorías + Inicio. (Unchanged from M7.) |
| **F9** | Aesthetic fixes | (a) **Native date/time picker not opening** — diagnose first (likely hidden-input + `showPicker()` gesture/visibility constraints on iOS/desktop), fix `DatePickerRow`/`TimePickerRow`; (b) **icon pool** — expand `lib/domain/icons.ts` to ~50–60 curated Lucide icons grouped by theme, scrollable `IconPicker` grid; (c) **PWA safe-areas** — audit header vs notch + bottom nav overflow on iOS standalone, fix paddings (`556d422` was insufficient). |
| **F10** | Security scan | `/security-review` over front + API + RLS policies; cross-user denial tests per table; secret-leak grep; headers (CSP etc.); fix findings. |
| **F11** | Cost review | Vercel: function invocations/active CPU, image optimization, bandwidth. Supabase: free-tier MAU/storage/egress, connection usage. Verify the no-LLM/no-Upstash/no-Storage design keeps both inside free tiers; document thresholds to watch. |

Suggested order: **F0 → F1 → F3 → F4 → F2 → F5 → F9 → F6 → F7 → F8 → F10 → F11** (F2 needs F1's session; F9 is independent and can interleave as quick wins).

## 4. Data model changes vs original plan

- Keep: `categories`, `expenses`, `settings`, `budgets`, `fx_rates` (schema as in original plan §3).
- **Drop:** `import_jobs` (no server import pipeline).
- **Add:** `category_rules (id, user_id, pattern text, category_id, created_at, updated_at, unique(user_id, pattern))` — merchant-matching rules for F6, RLS-scoped, synced like other user data.
- `fx_rates`: global read, server-write only (secret key).

## 5. Security posture

- RLS on every user table, proven by cross-user denial tests (F3, F10).
- Secret key (`sb_secret_…`) server-only; client gets only the publishable key. No `NEXT_PUBLIC_` leaks. Rotate chat-exposed keys post-setup (D7).
- App-lock: WebAuthn `userVerification: required`; PIN stored only as PBKDF2 hash, device-local; lock does not gate the service worker or sync (data already RLS-protected server-side).
- PDFs: parsed in-browser, never uploaded. Magic-byte + size checks; no eval; escaped render.
- FX privacy: only currency codes + date leave the device, via our proxy.
- Account deletion: cloud `wipeAll` + auth user deletion path in Ajustes.

## 6. Testing

Per feature: unit (vitest) for selectors/parsers/rules-engine/lock logic, repository round-trip against `supabase start`, RLS isolation tests, Playwright e2e for auth flow (stubbed OAuth), lock flow, picker fix, and import review flow. Existing 3.4k-line suite must stay green throughout.

## 7. Out of scope (this phase)

Supabase Realtime, native apps, LLM categorization (revisit when request volume justifies it), multi-account/shared ledgers.
