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

-- ---- privilege hardening (defense in depth) ------------------------------
-- Supabase's default ACL grants table privileges to `anon`. RLS already blocks
-- anon (auth.uid() is null → no row matches), but for a real-money app we also
-- revoke at the privilege layer. Login is required at runtime (D1), so only the
-- `authenticated` role ever needs access; the secret/service key bypasses both.
revoke all on table
  public.categories, public.expenses, public.settings,
  public.budgets, public.category_rules
  from anon;
grant all on table
  public.categories, public.expenses, public.settings,
  public.budgets, public.category_rules
  to authenticated;
-- fx_rates: read-only for clients; writes happen only via the secret/service key
-- (which bypasses both grants and RLS). Strip write privileges from authenticated.
revoke all on table public.fx_rates from anon, authenticated;
grant select on table public.fx_rates to authenticated;
