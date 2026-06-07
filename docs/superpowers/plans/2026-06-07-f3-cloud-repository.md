# F3 — Cloud Repository (Supabase + RLS) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Authenticated Cóndor users' data (expenses, categories, settings, budgets, fx_rates, category_rules) lives in Supabase Postgres under per-user Row-Level Security. A `SupabaseRepository implements Repository` swaps in behind the existing `Repository` seam — **zero changes to the store, selectors, or UI**. Preset categories are seeded per user app-side on first use. Existing localStorage data is offered for a one-time, idempotent import into the cloud.

**Architecture:** Phase-1 invariant preserved — components never touch `supabase-js`/`fetch`/`localStorage`; only the store + selectors do, and the store is built from a repository chosen by `repository-factory.ts`. With a Supabase session → `SupabaseRepository`; without a session (SSR / unit tests / pre-login) → `LocalStorageRepository` (login is required at runtime per D1, but the factory must not throw during SSR/tests). The cloud schema mirrors the Phase-1 TypeScript types **exactly** (verified against `lib/domain/types.ts`); `user_id uuid not null default auth.uid()` is added server-side and never appears in the client types. RLS policy `user_id = auth.uid()` (USING + WITH CHECK) on every user table; `fx_rates` is global-read, service-write. `deleteCategory(id, reassignTo)` is atomic via a Postgres RPC function. This is F3 of the revised Phase-2 design (depends on F1 Auth; precedes F4 Sync). Sync/offline (`SyncingRepository`, outbox, LWW) is **out of scope** — F4.

**Tech Stack:** Supabase (Postgres 15 + RLS) · `@supabase/supabase-js` v2 (`{ data, error }` pattern, `.upsert({ onConflict })`, `.rpc()`) · `@supabase/ssr` browser client from F1 (reused, not created here) · Supabase CLI (`supabase start`, `supabase db push`, `supabase migration new`) · Next.js 16 server runtime (static export already dropped in F0) · existing: Zustand, Zod, Vitest. pnpm throughout. Project ref `svgphkbtspqgsliqbsfx`.

> **Credentials:** This plan names env vars only — never literal key values. Required (provisioned in F0): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (client, RLS-guarded), `SUPABASE_SECRET_KEY` (server-only, never `NEXT_PUBLIC_`). For local tests, `supabase start` prints a local URL + keys consumed via `SUPABASE_TEST_URL` / `SUPABASE_TEST_PUBLISHABLE_KEY` / `SUPABASE_TEST_SECRET_KEY` in a local-only `.env.test` (gitignored).

> **Assumptions / discrepancies vs the original plan §3 schema (read before coding):**
> 1. **`expenses.time` column added.** The original §3 SQL omits `time`, but `Expense` (real type, `lib/domain/types.ts:15`) has `time?: string` ('HH:mm'). The migration includes `time text` (nullable). Confirmed required.
> 2. **`category_id` is NOT a uuid FK and is NOT `references categories(id)`.** Preset category ids are strings like `'preset-comida'` (`lib/domain/presets.ts:21`), and custom ids are `crypto.randomUUID()` (`lib/domain/ids.ts`). They are mixed. So `expenses.category_id` is `text not null` (no FK), and `categories.id` is `text primary key` (not uuid). Same for `budgets.category_id` / `category_rules.category_id`. The original §3 `category_id uuid ... references categories(id)` is **wrong against the real types** and is corrected here. Atomic reassignment integrity is enforced by the RPC, not a FK.
> 3. **`settings.id` semantics.** Phase-1 `Settings` has no id; cloud `settings` is one row per user keyed by `user_id` (PK). `schemaVersion` maps to `schema_version int`. Matches original §3.
> 4. **`categories.created_at/updated_at` not in the `Category` type.** Kept as DB-only bookkeeping columns (defaults), never mapped to/from the client `Category`. Same for `category_rules`.
> 5. **`expenses.amount` is `numeric`, `base_amount`/`fx_rate` nullable numeric** — mirrors `amount: number`, `baseAmount: number | null`, `fxRate: number | null`. `source text not null default 'manual'` (values `'manual' | 'import'`; `'import'` arrives in F6).
> 6. **Seeding is app-side, not a DB trigger** (decision documented in Task 4). Rationale below.
> 7. **No `import_jobs` table** (D3 dropped it). **`category_rules` added** (design §4) — schema present here so RLS is uniform, though it is exercised by F6.
> 8. **`budgets` table created here** with RLS, but its `Repository` methods (`listBudgets` etc.) are **F8**, not F3 — the interface in `repository.ts` is unchanged by F3.

---

## Conventions

- Migrations live in `supabase/migrations/` (created in F0; create the dir if absent).
- Every commit message is given verbatim. Commit after each task that ends green. Do **not** `git commit` until a task says so, and never push.
- Mapping helpers convert camelCase domain objects ↔ snake_case rows in **one place** (`lib/data/supabase-mappers.ts`) so column names live in exactly one file.
- Run the **entire existing suite** (`pnpm test`) after structural changes — the 3.4k-line Phase-1 suite must stay green throughout.

---

## Task 1 — Quick win: SQL migration for schema + RLS + indexes

**Files:** `supabase/migrations/0001_core.sql`

The SQL below mirrors the real types exactly (see discrepancy notes in the header).

- [ ] Create `supabase/migrations/` if it does not exist.
- [ ] Write `supabase/migrations/0001_core.sql` with this exact content:

```sql
-- 0001_core.sql — Cóndor cloud core schema (F3)
-- Columns mirror lib/domain/types.ts verbatim. user_id is server-injected (RLS), never in client types.

-- ---- categories ----------------------------------------------------------
-- id is TEXT (preset ids like 'preset-comida' + uuid customs coexist) — NOT uuid.
create table public.categories (
  id          text not null,
  user_id     uuid not null default auth.uid(),
  name        text not null,
  color       text not null,
  icon        text not null,
  is_preset   boolean not null default false,
  hidden      boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (user_id, id)
);

-- ---- expenses ------------------------------------------------------------
-- category_id is TEXT (no FK — preset ids are strings; integrity via RPC on reassign).
-- time mirrors Expense.time?: 'HH:mm'. base_amount / fx_rate nullable.
create table public.expenses (
  id           text not null,
  user_id      uuid not null default auth.uid(),
  amount       numeric not null check (amount > 0),
  currency     text not null,
  base_amount  numeric,
  fx_rate      numeric,
  date         date not null,
  time         text,
  category_id  text not null,
  merchant     text,
  note         text,
  source       text not null default 'manual',  -- 'manual' | 'import'
  created_at   timestamptz not null,
  updated_at   timestamptz not null,
  primary key (user_id, id)
);

-- ---- settings (one row per user) -----------------------------------------
create table public.settings (
  user_id        uuid primary key default auth.uid(),
  base_currency  text not null default 'COP',
  locale         text not null default 'es',
  theme          text not null default 'auto',
  dashboard_view text not null default 'bars',
  schema_version int  not null default 1
);

-- ---- budgets (RLS uniform now; repo methods are F8) ----------------------
create table public.budgets (
  id          text not null,
  user_id     uuid not null default auth.uid(),
  category_id text not null,
  amount_base numeric not null check (amount_base >= 0),
  period      text not null default 'monthly',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (user_id, id),
  unique (user_id, category_id, period)
);

-- ---- category_rules (RLS uniform now; exercised by F6) -------------------
create table public.category_rules (
  id          text not null,
  user_id     uuid not null default auth.uid(),
  pattern     text not null,
  category_id text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (user_id, id),
  unique (user_id, pattern)
);

-- ---- fx_rates (GLOBAL read, service-write only — no user_id) -------------
create table public.fx_rates (
  from_ccy   text not null,
  to_ccy     text not null,
  on_date    date not null,
  rate       numeric not null,
  fetched_at timestamptz not null default now(),
  primary key (from_ccy, to_ccy, on_date)
);

-- ---- indexes -------------------------------------------------------------
create index expenses_user_date_idx on public.expenses (user_id, date desc);
create index expenses_category_idx  on public.expenses (category_id);

-- ---- RLS: every user table -----------------------------------------------
alter table public.categories      enable row level security;
alter table public.expenses        enable row level security;
alter table public.settings        enable row level security;
alter table public.budgets         enable row level security;
alter table public.category_rules  enable row level security;
alter table public.fx_rates        enable row level security;

create policy "own rows" on public.categories
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on public.expenses
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own row" on public.settings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on public.budgets
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own rows" on public.category_rules
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- fx_rates: anyone authenticated may read; writes only via the secret (service) key,
-- which bypasses RLS. No write policy → no client writes possible.
create policy "global read" on public.fx_rates
  for select using (true);
```

- [ ] Start local Supabase and apply: `supabase start` (expect `API URL: http://127.0.0.1:54321` and printed keys), then `supabase db reset` (re-applies all migrations from scratch; expect `Applying migration 0001_core.sql...` then `Finished supabase db reset`).
- [ ] Verify tables exist: `supabase db diff` (expect **no schema diff** — empty output, meaning migration == DB state).
- [ ] Commit: `feat(db): F3 core schema + RLS + indexes (mirrors Phase-1 types)`

---

## Task 2 — Quick win: atomic `deleteCategory` RPC

**Files:** `supabase/migrations/0002_delete_category_rpc.sql`

`deleteCategory(id, reassignTo)` must (a) reject presets, (b) optionally reassign expenses, (c) delete the row — atomically, scoped to `auth.uid()`. A `security definer` function with a fixed `search_path` does this in one transaction. Mirrors `LocalStorageRepository.deleteCategory` semantics exactly (throws on preset; reassigns only when `reassignTo` given).

- [ ] Create `supabase/migrations/0002_delete_category_rpc.sql`:

```sql
-- 0002_delete_category_rpc.sql — atomic category delete + optional reassign (F3)
create or replace function public.delete_category(
  p_id          text,
  p_reassign_to text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_is_preset boolean;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select is_preset into v_is_preset
  from public.categories
  where user_id = v_uid and id = p_id;

  if v_is_preset is null then
    raise exception 'category % not found', p_id;
  end if;
  if v_is_preset then
    raise exception 'Cannot delete preset category "%"', p_id;
  end if;

  if p_reassign_to is not null then
    update public.expenses
      set category_id = p_reassign_to, updated_at = now()
      where user_id = v_uid and category_id = p_id;
  end if;

  delete from public.categories
    where user_id = v_uid and id = p_id;
end;
$$;

revoke all on function public.delete_category(text, text) from public;
grant execute on function public.delete_category(text, text) to authenticated;
```

- [ ] Apply: `supabase db reset` (expect both migrations applied, no errors).
- [ ] Smoke-test the RPC via SQL (optional but recommended): `supabase db reset` then in `supabase studio` or psql confirm `select public.delete_category('x')` raises `not authenticated` (no JWT in raw psql).
- [ ] Commit: `feat(db): F3 atomic delete_category RPC (reject preset, reassign, delete)`

---

## Task 3 — TDD: snake_case ↔ camelCase mappers

**Files:** `lib/data/supabase-mappers.ts`, `tests/unit/data/supabase-mappers.test.ts`

Pure functions, no network — fast unit tests. This isolates every column name in one file.

- [ ] **RED** — write `tests/unit/data/supabase-mappers.test.ts`:
  - `expenseToRow` maps `categoryId→category_id`, `baseAmount→base_amount`, `fxRate→fx_rate`, `createdAt→created_at`, `updatedAt→updated_at`, keeps `time` and `source`, and omits `user_id` (server injects it).
  - `rowToExpense` is the exact inverse and yields an object deep-equal to the original `makeExpense()` fixture (round-trip). Verify `time` undefined when row `time` is null; `merchant`/`note` undefined when null.
  - `categoryToRow` / `rowToCategory`: `isPreset↔is_preset`, `hidden` defaults to `false`→`undefined` mapping matches the `Category` type (`hidden?: boolean`). `rowToCategory` must drop `created_at`/`updated_at`.
  - `settingsToRow` / `rowToSettings`: `baseCurrency↔base_currency`, `dashboardView↔dashboard_view`, `schemaVersion↔schema_version`.
  - Run: `pnpm test supabase-mappers` (expect failures — module not found).
- [ ] **GREEN** — write `lib/data/supabase-mappers.ts` with `expenseToRow`/`rowToExpense`/`categoryToRow`/`rowToCategory`/`settingsToRow`/`rowToSettings` and exported `Row` types (`ExpenseRow`, `CategoryRow`, `SettingsRow`). Convert `null`↔`undefined` for optional fields. `rowToExpense` casts `source` to `Expense['source']`. Re-run: `pnpm test supabase-mappers` (expect all green).
- [ ] Commit: `feat(data): F3 supabase row mappers (camelCase<->snake_case)`

---

## Task 4 — `SupabaseRepository` implementation

**Files:** `lib/data/supabase-repository.ts`

Implements `Repository` method-for-method against a `SupabaseClient` injected via the constructor (so tests can pass a local client). Decision: **constructor takes a `SupabaseClient`** rather than creating one internally — keeps it pure/testable and reuses F1's browser client at the call site.

**Seeding decision (documented in code header):** Preset categories are seeded **app-side on the first `listCategories()`** (when the user has zero category rows), NOT via a DB trigger on `auth.users`. Rationale: (a) testable without auth-admin hooks — the round-trip test just calls `listCategories()`; (b) keeps preset definitions in one place (`PRESET_CATEGORIES`), so changing presets does not require a new SQL migration; (c) a trigger on `auth.users` runs with elevated privileges and is harder to keep in sync with the TS preset list and to reason about under RLS. Trade-off: a tiny extra round-trip on first use (acceptable; mirrors `LocalStorageRepository`'s first-run seeding at line 80–84).

- [ ] Write `lib/data/supabase-repository.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Expense, Category, Settings, ExportBundle } from '@/lib/domain/types';
import { SCHEMA_VERSION } from '@/lib/domain/types';
import { PRESET_CATEGORIES } from '@/lib/domain/presets';
import { DEFAULT_SETTINGS } from './local-storage-repository';
import type { Repository } from './repository';
import {
  expenseToRow, rowToExpense,
  categoryToRow, rowToCategory,
  settingsToRow, rowToSettings,
} from './supabase-mappers';

// Seeding: preset categories are inserted app-side on the first listCategories()
// when the user has zero rows. See plan Task 4 for the rationale (testability,
// single source of preset truth, RLS simplicity). NOT a DB trigger.

export class SupabaseRepository implements Repository {
  constructor(private readonly sb: SupabaseClient) {}

  // ---- Expenses ----------------------------------------------------------
  async listExpenses(): Promise<Expense[]> {
    const { data, error } = await this.sb
      .from('expenses')
      .select('*')
      .order('date', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(rowToExpense);
  }

  async upsertExpense(e: Expense): Promise<Expense> {
    const { error } = await this.sb
      .from('expenses')
      .upsert(expenseToRow(e), { onConflict: 'user_id,id' });
    if (error) throw error;
    return e;
  }

  async deleteExpense(id: string): Promise<void> {
    const { error } = await this.sb.from('expenses').delete().eq('id', id);
    if (error) throw error;
  }

  // ---- Categories --------------------------------------------------------
  async listCategories(): Promise<Category[]> {
    const { data, error } = await this.sb.from('categories').select('*');
    if (error) throw error;
    if ((data ?? []).length === 0) {
      // First use — seed presets for this user.
      const rows = PRESET_CATEGORIES.map(categoryToRow);
      const { error: seedErr } = await this.sb
        .from('categories')
        .upsert(rows, { onConflict: 'user_id,id' });
      if (seedErr) throw seedErr;
      return [...PRESET_CATEGORIES];
    }
    return data.map(rowToCategory);
  }

  async upsertCategory(c: Category): Promise<Category> {
    const { error } = await this.sb
      .from('categories')
      .upsert(categoryToRow(c), { onConflict: 'user_id,id' });
    if (error) throw error;
    return c;
  }

  async deleteCategory(id: string, reassignTo?: string): Promise<void> {
    const { error } = await this.sb.rpc('delete_category', {
      p_id: id,
      p_reassign_to: reassignTo ?? null,
    });
    if (error) throw error; // RPC raises on preset / not-found — surfaces as error
  }

  // ---- Settings ----------------------------------------------------------
  async getSettings(): Promise<Settings> {
    const { data, error } = await this.sb
      .from('settings')
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (!data) return { ...DEFAULT_SETTINGS };
    return rowToSettings(data);
  }

  async putSettings(s: Settings): Promise<Settings> {
    const { error } = await this.sb
      .from('settings')
      .upsert(settingsToRow(s), { onConflict: 'user_id' });
    if (error) throw error;
    return s;
  }

  // ---- Export ------------------------------------------------------------
  async exportAll(): Promise<ExportBundle> {
    const [expenses, categories, settings] = await Promise.all([
      this.listExpenses(),
      this.listCategories(),
      this.getSettings(),
    ]);
    return {
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      expenses,
      categories,
      settings,
    };
  }

  // ---- Wipe --------------------------------------------------------------
  async wipeAll(): Promise<void> {
    // RLS scopes every delete to auth.uid(). neq on a never-matching id deletes all own rows.
    for (const table of ['expenses', 'budgets', 'category_rules', 'categories'] as const) {
      const { error } = await this.sb.from(table).delete().neq('id', '__none__');
      if (error) throw error;
    }
    const { error } = await this.sb.from('settings').delete().neq('user_id', '00000000-0000-0000-0000-000000000000');
    if (error) throw error;
  }
}
```

- [ ] Note on `upsertExpense`/`upsertCategory`/`putSettings`: they do **not** `.select()` back — the domain object is already authoritative and is returned as-is (matches `LocalStorageRepository` which returns the input). `user_id` is filled by the column default `auth.uid()`.
- [ ] `pnpm typecheck` (expect no errors). If `@supabase/supabase-js` types are missing, it was installed in F1; if not, `pnpm add @supabase/supabase-js`.
- [ ] Commit: `feat(data): F3 SupabaseRepository implementing Repository under RLS`

---

## Task 5 — `repository-factory.ts`

**Files:** `lib/data/repository-factory.ts`, `tests/unit/data/repository-factory.test.ts`

With a session → `SupabaseRepository`; otherwise (SSR, unit tests, pre-login) → `LocalStorageRepository`. Per D1 login is required at runtime, but the factory must degrade gracefully so SSR/tests never throw.

- [ ] **RED** — `tests/unit/data/repository-factory.test.ts`:
  - `createRepository(null)` (no client) → `instanceof LocalStorageRepository`.
  - `createRepository(fakeSupabaseClient)` → `instanceof SupabaseRepository`.
  - Run: `pnpm test repository-factory` (expect fail).
- [ ] **GREEN** — `lib/data/repository-factory.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Repository } from './repository';
import { LocalStorageRepository } from './local-storage-repository';
import { SupabaseRepository } from './supabase-repository';

/**
 * F3: pick the repository for the current session.
 * - Supabase client present (authed) → SupabaseRepository (RLS-scoped).
 * - No client (SSR / unit tests / pre-login) → LocalStorageRepository.
 * Login is required at runtime (D1); this fallback only keeps SSR/tests safe.
 */
export function createRepository(client: SupabaseClient | null): Repository {
  return client ? new SupabaseRepository(client) : new LocalStorageRepository();
}
```

- [ ] Re-run: `pnpm test repository-factory` (green). Then `pnpm test` (full suite, expect all green — nothing else changed).
- [ ] Commit: `feat(data): F3 repository factory (session -> Supabase, else local)`

> **Wiring note (not F3):** The store composition root (`lib/store/store.ts:274` `defaultStore`) keeps using `LocalStorageRepository` for now. Re-building the store from `createRepository(session.client)` on auth change is **F4's** concern (it also adds the syncing decorator). F3 ships the factory + repo without touching `store.ts`, so the existing store tests stay green.

---

## Task 6 — One-time local→cloud import

**Files:** `lib/data/import-local.ts`, `tests/unit/data/import-local.test.ts`

Detects existing `condor:*` localStorage data, runs once, idempotent. Pure logic + injected repos so it is unit-testable without a browser-driven prompt.

- [ ] **RED** — `tests/unit/data/import-local.test.ts` (jsdom env, `localStorage` available):
  - `hasLocalDataToImport()` → `true` when `condor:expenses` or `condor:categories` or `condor:settings` exists and `condor:imported` is absent; `false` once `condor:imported` is set; `false` on empty storage.
  - `importLocalToCloud(localRepo, cloudRepo)`: seed `localRepo` (a real `LocalStorageRepository`) with 2 expenses, 1 custom category, custom settings; pass a **fake cloud repo** (in-memory implementing `Repository`); assert cloud received `upsertExpense` x2, `upsertCategory` for the custom (presets skipped — see below), `putSettings` once; and `localStorage.getItem('condor:imported')` is set.
  - **Idempotency:** calling `importLocalToCloud` twice → cloud upserts happen only on the first call (guard on `condor:imported`); second call is a no-op.
  - Run: `pnpm test import-local` (expect fail).
- [ ] **GREEN** — `lib/data/import-local.ts`:

```ts
import type { Repository } from './repository';
import { LocalStorageRepository } from './local-storage-repository';

const IMPORTED_KEY = 'condor:imported';
const LOCAL_KEYS = ['condor:expenses', 'condor:categories', 'condor:settings'] as const;

/** True when there is un-imported local data worth offering to migrate. */
export function hasLocalDataToImport(): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  if (localStorage.getItem(IMPORTED_KEY) !== null) return false;
  return LOCAL_KEYS.some((k) => localStorage.getItem(k) !== null);
}

/**
 * One-time, idempotent migration of local data into the cloud repo.
 * Guarded by condor:imported. Presets are NOT re-uploaded (the cloud seeds its
 * own on first listCategories); only user-created categories are migrated.
 */
export async function importLocalToCloud(
  local: Repository,
  cloud: Repository,
): Promise<{ imported: boolean; expenses: number; categories: number }> {
  if (!hasLocalDataToImport()) return { imported: false, expenses: 0, categories: 0 };

  const bundle = await local.exportAll();

  // Ensure cloud presets exist before referencing them / uploading customs.
  await cloud.listCategories();

  const customCats = bundle.categories.filter((c) => !c.isPreset);
  for (const c of customCats) await cloud.upsertCategory(c);
  for (const e of bundle.expenses) await cloud.upsertExpense(e);
  await cloud.putSettings(bundle.settings);

  localStorage.setItem(IMPORTED_KEY, new Date().toISOString());
  return { imported: true, expenses: bundle.expenses.length, categories: customCats.length };
}

/** Convenience: build a local repo + run the import against a given cloud repo. */
export async function runFirstSignInImport(cloud: Repository) {
  return importLocalToCloud(new LocalStorageRepository(), cloud);
}
```

- [ ] Re-run: `pnpm test import-local` (green).
- [ ] Commit: `feat(data): F3 one-time idempotent local->cloud import`

> **Prompt/UI note (light):** The user-facing "Importar tus datos locales?" prompt belongs to the F1/F4 sign-in flow that constructs the cloud repo. F3 delivers the idempotent engine + the `hasLocalDataToImport()` gate; the call site (`runFirstSignInImport`) is wired when the cloud store is built (F4). If a minimal prompt is desired within F3, add it behind the existing Ajustes "Cuenta" section from F1 — but keep the engine UI-free as above.

---

## Task 7 — Integration tests against local Supabase (round-trip + RLS isolation)

**Files:** `tests/integration/supabase-repository.int.test.ts`, `vitest.integration.config.ts`, `package.json` (script), `.env.test` (gitignored)

These hit a real local Postgres via `supabase start`, so they run in a separate Vitest project with the **node** environment (not jsdom) and are excluded from the default `pnpm test` run (which must stay offline/fast).

- [ ] Add `vitest.integration.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/integration/**/*.int.test.ts'],
    // Integration tests share one DB; run serially to avoid cross-test interference.
    fileParallelism: false,
    testTimeout: 30_000,
  },
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
});
```

- [ ] Add script to `package.json`: `"test:int": "vitest run --config vitest.integration.config.ts"`.
- [ ] Ensure default `vitest.config.ts` excludes integration: add `"**/tests/integration/**"` to its `exclude` array (so `pnpm test` never needs a running DB).
- [ ] Create `.env.test` (gitignored — confirm `.gitignore` has `.env*` or add `.env.test`) holding the **local** values printed by `supabase start`:
  - `SUPABASE_TEST_URL=http://127.0.0.1:54321`
  - `SUPABASE_TEST_PUBLISHABLE_KEY=<local anon/publishable key from `supabase start`>`
  - `SUPABASE_TEST_SECRET_KEY=<local service_role key from `supabase start`>`
  (Local-only keys; never the production secret. Still no literals in this plan.)
- [ ] Write `tests/integration/supabase-repository.int.test.ts`. Two JWTs are minted by creating two users via the admin (secret-key) client, then signing each in to get a user-scoped client:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SupabaseRepository } from '@/lib/data/supabase-repository';
import { PRESET_CATEGORIES } from '@/lib/domain/presets';
import { DEFAULT_SETTINGS } from '@/lib/data/local-storage-repository';
import type { Expense } from '@/lib/domain/types';

const URL = process.env.SUPABASE_TEST_URL!;
const PUBLISHABLE = process.env.SUPABASE_TEST_PUBLISHABLE_KEY!;
const SECRET = process.env.SUPABASE_TEST_SECRET_KEY!;

const admin = createClient(URL, SECRET, { auth: { persistSession: false } });

async function makeUserClient(email: string): Promise<{ client: SupabaseClient; id: string }> {
  const password = 'test-password-123';
  const { data: created, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (error) throw error;
  const client = createClient(URL, PUBLISHABLE, { auth: { persistSession: false } });
  const { error: signErr } = await client.auth.signInWithPassword({ email, password });
  if (signErr) throw signErr;
  return { client, id: created.user!.id };
}

function makeExpense(over: Partial<Expense> = {}): Expense {
  return {
    id: crypto.randomUUID(),
    amount: 10000, currency: 'COP', baseAmount: 10000, fxRate: 1,
    date: '2026-01-01', categoryId: 'preset-comida', source: 'manual',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

describe('SupabaseRepository (local Supabase)', () => {
  let aClient: SupabaseClient, bClient: SupabaseClient;
  let repoA: SupabaseRepository, repoB: SupabaseRepository;

  beforeAll(async () => {
    const a = await makeUserClient(`a_${Date.now()}@condor.test`);
    const b = await makeUserClient(`b_${Date.now()}@condor.test`);
    aClient = a.client; bClient = b.client;
    repoA = new SupabaseRepository(aClient);
    repoB = new SupabaseRepository(bClient);
  });

  afterAll(async () => {
    await repoA.wipeAll(); await repoB.wipeAll();
  });

  it('first listCategories seeds presets for the user', async () => {
    const cats = await repoA.listCategories();
    expect(cats).toHaveLength(PRESET_CATEGORIES.length);
    expect(cats.map((c) => c.id).sort()).toEqual(PRESET_CATEGORIES.map((c) => c.id).sort());
  });

  it('expense round-trips with time / nulls preserved', async () => {
    const e = makeExpense({ time: '14:30', baseAmount: null, fxRate: null, currency: 'USD' });
    await repoA.upsertExpense(e);
    const list = await repoA.listExpenses();
    const got = list.find((x) => x.id === e.id)!;
    expect(got).toEqual(e);
  });

  it('settings round-trip', async () => {
    const s = { ...DEFAULT_SETTINGS, baseCurrency: 'USD', locale: 'en' as const };
    await repoA.putSettings(s);
    expect(await repoA.getSettings()).toEqual(s);
  });

  it('deleteCategory RPC reassigns then deletes; rejects presets', async () => {
    await repoA.upsertCategory({ id: crypto.randomUUID(), name: 'X', color: '#fff', icon: 'comida', isPreset: false });
    const cats = await repoA.listCategories();
    const custom = cats.find((c) => c.name === 'X')!;
    const e = makeExpense({ categoryId: custom.id });
    await repoA.upsertExpense(e);

    await repoA.deleteCategory(custom.id, 'preset-otros');
    expect((await repoA.listCategories()).find((c) => c.id === custom.id)).toBeUndefined();
    expect((await repoA.listExpenses()).find((x) => x.id === e.id)!.categoryId).toBe('preset-otros');

    await expect(repoA.deleteCategory('preset-comida')).rejects.toBeTruthy();
  });

  it('RLS: user B cannot read user A rows', async () => {
    const e = makeExpense({ id: crypto.randomUUID(), merchant: 'A-only' });
    await repoA.upsertExpense(e);
    const bList = await repoB.listExpenses();
    expect(bList.find((x) => x.id === e.id)).toBeUndefined();
  });

  it('RLS: user B cannot write into user A space (own user_id is forced)', async () => {
    // B upserts; even if it shared an id, the row is B-scoped and invisible to A.
    const shared = makeExpense({ id: 'shared-id', merchant: 'B-write' });
    await repoB.upsertExpense(shared);
    const aList = await repoA.listExpenses();
    expect(aList.find((x) => x.id === 'shared-id')).toBeUndefined();
  });
});
```

- [ ] Run: `supabase start` (if not already up), then `pnpm test:int` (expect all green; ~6 tests passing). If `auth.admin.createUser` fails, confirm the secret/service key (not publishable) is in `SUPABASE_TEST_SECRET_KEY`.
- [ ] Commit: `test(data): F3 round-trip + RLS isolation integration tests (local supabase)`

---

## Task 8 — Import idempotency integration check + final verification

**Files:** `tests/integration/import-local.int.test.ts`

Proves the import lands real rows in Postgres and is idempotent end-to-end (jsdom-style localStorage isn't available in node env — provide a minimal in-test localStorage shim, or keep this test in the jsdom unit run and assert against a real `SupabaseRepository` for a signed-in user).

- [ ] Write `tests/integration/import-local.int.test.ts`: shim `globalThis.localStorage` with a `Map`-backed stub at the top of the file; seed `condor:expenses`/`condor:categories`/`condor:settings`; create one signed-in user client (reuse the `makeUserClient` helper — extract it to `tests/integration/_helpers.ts`); call `importLocalToCloud(new LocalStorageRepository(), new SupabaseRepository(client))`; assert cloud `listExpenses()` count matches; call again and assert no duplicate rows + `condor:imported` still set.
- [ ] Extract `makeUserClient` + `makeExpense` into `tests/integration/_helpers.ts` and import from both int test files (avoid duplication).
- [ ] Run: `pnpm test:int` (expect all green, including the new import test).
- [ ] Full local gate: `pnpm typecheck && pnpm lint && pnpm test` (offline suite green) **and** `pnpm test:int` (DB suite green).
- [ ] Push the schema to the linked remote project once verified locally: `supabase db push` (target `svgphkbtspqgsliqbsfx`; expect `Applying migration 0001_core.sql... 0002_delete_category_rpc.sql... Finished supabase db push`).
- [ ] Commit: `test(data): F3 import idempotency integration test + helpers`

---

## Done criteria

- [ ] `supabase/migrations/0001_core.sql` + `0002_delete_category_rpc.sql` applied locally (`supabase db reset` clean) and pushed to `svgphkbtspqgsliqbsfx` (`supabase db push`).
- [ ] RLS enabled on `categories`, `expenses`, `settings`, `budgets`, `category_rules`, `fx_rates`; `user_id = auth.uid()` (USING + WITH CHECK) on all user tables; `fx_rates` global-read / no client write.
- [ ] `SupabaseRepository` implements every `Repository` method; mappers round-trip; `deleteCategory` is atomic via RPC.
- [ ] `repository-factory.ts` returns Supabase with a client, Local without; store/UI untouched.
- [ ] Import is idempotent (`condor:imported` guard), presets not re-uploaded.
- [ ] `pnpm test` green (offline) AND `pnpm test:int` green (RLS isolation + round-trip + import idempotency against local Supabase).
- [ ] No credential literals committed; `.env.test` gitignored.
```
