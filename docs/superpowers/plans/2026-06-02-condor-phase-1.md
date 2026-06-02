# Cóndor Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-first, bilingual, installable PWA expense tracker that captures expenses, converts to a base currency, and ranks monthly spending — matching `condor-mockups/`.

**Architecture:** UI → Zustand store + pure selectors → `Repository` + `FxProvider` interfaces. Phase 1 implements those with localStorage + Frankfurter. Static export (`output: 'export'`) enforces "no backend". Charts (bars/treemap) are zero-dependency SVG/CSS; donut + day-strip are hand-rolled SVG. Geometry is precomputed in pure, tested functions.

**Tech Stack (versions verified via context7, 2026-06-02):** Next.js `16.2.2` (App Router, `output: 'export'`) · React 19 · TypeScript · Tailwind CSS v4 (CSS-first `@theme`) · shadcn/ui · Zustand `persist` · next-intl (client provider, no i18n routing) · Zod · date-fns · Frankfurter FX (keyless) · @serwist/next (PWA) · Vitest + Testing Library (unit/component) · Playwright (e2e). Package manager: **pnpm**. IDs: `crypto.randomUUID()`.

---

## Decisions made during planning (flagged for veto)

1. **`output: 'export'` (static).** Strongest enforcement of the "NO backend" hard constraint; trivially offline-cacheable. Trade-off: no Next image optimization / route handlers (we need neither).
2. **Client-driven i18n.** Because locale lives in localStorage and toggles at runtime, we wrap the app in a client `NextIntlClientProvider` whose `locale`/`messages` come from the store — not next-intl's server `i18n/request.ts`. No URL locale segments.
3. **Money stored as `number`, rounded to currency minor units on entry** (spec §5.5). `schemaVersion` reserves the escape hatch to integer minor units if precision bugs appear.
4. **Top 6 + "Otros"** collapse threshold for bars/donut (spec §5.2). Treemap shows all.
5. **Delta chip** shows only when prior-month data exists (spec §2.3).

If any of these are wrong, say so before Phase 0.

---

## File structure

```
condor/  (repo root = /home/samu/code/personal/Mark-VI-Mny)
  next.config.ts                 # output:'export', withSerwist
  tailwind / app/globals.css     # Tailwind v4 @theme tokens (dark default + light)
  app/
    layout.tsx                   # <html>, fonts, Providers
    providers.tsx                # 'use client': store hydration gate, theme, NextIntlClientProvider
    (tabs)/inicio/page.tsx
    (tabs)/historico/page.tsx
    anadir/page.tsx
    categorias/page.tsx
    ajustes/page.tsx
    sw.ts                        # Serwist service worker
    ~offline/page.tsx            # offline fallback
  components/
    nav/BottomNav.tsx AddFab.tsx
    home/MonthSwitcher.tsx MonthTotal.tsx ViewSwitcher.tsx SpendingView.tsx
    charts/RankedBars.tsx DonutChart.tsx Treemap.tsx SpendByDayStrip.tsx
    expense/AmountInput.tsx CurrencyPill.tsx DatePickerRow.tsx TextFieldRow.tsx
    category/CategoryBadge.tsx CategoryChip.tsx CategoryListItem.tsx
              ColorSwatchPicker.tsx IconPicker.tsx NewCategorySheet.tsx
    tx/TransactionRow.tsx
    settings/SettingRow.tsx SegmentedControl.tsx
    common/ConfirmDialog.tsx UndoToast.tsx EmptyState.tsx CondorLogo.tsx
    ui/                          # shadcn primitives
  lib/
    domain/types.ts schemas.ts presets.ts palette.ts icons.ts ids.ts selectors.ts
    domain/geometry.ts           # treemap squarify + donut arc + bar widths (pure)
    format/money.ts date.ts
    data/repository.ts local-storage-repository.ts
    fx/fx-provider.ts frankfurter-fx-provider.ts fx-cache.ts
    store/store.ts migrations.ts
    i18n/messages.ts             # client message loader
  messages/es.json en.json
  public/manifest.webmanifest icons/* 
  tests/
    unit/ (vitest)  component/ (vitest+RTL)  e2e/ (playwright)
  vitest.config.ts playwright.config.ts
```

---

## Phase 0 — Scaffold & tooling

**Goal:** A running Next.js 16 static-export app with Tailwind v4, shadcn, Vitest, Playwright, and pnpm — committed.

**Checkpoint at end:** `pnpm dev` serves a blank page; `pnpm test` runs (0 tests ok); `pnpm build` produces `out/`; `pnpm exec playwright test` boots.

- [ ] **0.1** Verify latest stable versions via context7 for: tailwindcss (v4 `@theme` syntax), shadcn (Tailwind v4 init), zustand, zod, date-fns, @serwist/next. Pin what context7 reports. (Next.js `16.2.2`, next-intl already confirmed.)
- [ ] **0.2** `git init` (repo is not currently a git repo). Add `.gitignore` (node_modules, .next, out, coverage, test-results, playwright-report).
- [ ] **0.3** Scaffold: `pnpm create next-app@latest . --ts --app --tailwind --eslint --no-src-dir --import-alias "@/*"` (run in repo root; keep existing `docs/`). Confirm it pins Next 16.2.2.
- [ ] **0.4** Set `next.config.ts`: `output: 'export'`, `images: { unoptimized: true }`. Verify `pnpm build` emits `out/`.
- [ ] **0.5** Add fonts via `next/font/google`: Space Grotesk (headings/money), Inter (body). Expose as CSS vars `--font-space-grotesk`, `--font-inter` on `<html>`.
- [ ] **0.6** `pnpm dlx shadcn@latest init` (Tailwind v4 mode). Confirm `components.json`, `@/components/ui`, `lib/utils.ts` (cn).
- [ ] **0.7** Install runtime deps: `pnpm add zustand zod date-fns next-intl @serwist/next serwist`.
- [ ] **0.8** Install test deps: `pnpm add -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom @playwright/test`. `pnpm exec playwright install chromium`.
- [ ] **0.9** `vitest.config.ts`: jsdom env, `@/*` alias, setup file importing `@testing-library/jest-dom`, globals true. Add `playwright.config.ts`: `webServer` runs `pnpm build && pnpm exec serve out` (or `next start` won't apply with export → use `serve out` or `next dev`), baseURL, chromium project, mobile viewport 390×844.
- [ ] **0.10** `package.json` scripts: `dev`, `build`, `test` (`vitest run`), `test:watch`, `e2e` (`playwright test`), `lint`, `typecheck` (`tsc --noEmit`).
- [ ] **0.11** Commit: `chore: scaffold Next 16 static PWA with Tailwind v4, shadcn, vitest, playwright`.

---

## Phase 1 — Domain types, schemas, presets (TDD)

**Goal:** Typed data model + Zod validation + seeded presets + palette, all unit-tested. No React.

**Checkpoint:** `pnpm test tests/unit/domain` green; types exported and importable.

**Files:** Create `lib/domain/types.ts`, `schemas.ts`, `palette.ts`, `icons.ts`, `presets.ts`, `ids.ts`; Test `tests/unit/domain/schemas.test.ts`, `presets.test.ts`.

- [ ] **1.1** `lib/domain/types.ts` — exact spec §4 types: `Currency`, `DashboardView`, `ThemePref`, `Locale`, `Expense`, `Category`, `Settings`, `ExportBundle`. Add `SCHEMA_VERSION = 1` const.
- [ ] **1.2** `lib/domain/palette.ts` — `CATEGORY_PALETTE = ['#C9B6FF','#FF9EB1','#FFD98A','#9EC1FF','#7EE8C9']` (cycle); helper `paletteColorFor(index)`.
- [ ] **1.3** `lib/domain/icons.ts` — curated icon key→lucide component map (e.g. `comida:Utensils, transporte:Car/Bus, ocio:Gamepad2, turismo:Plane, videojuegos:Gamepad2, mercado:ShoppingCart, salud:HeartPulse, servicios:Receipt, entretenimiento:Clapperboard, otros:CircleDot, mascotas:PawPrint`). `ICON_KEYS` array for the picker. Use lucide-react (shadcn dep).
- [ ] **1.4 (TDD) Write failing test** `presets.test.ts`: `PRESET_CATEGORIES` has the 10 spec presets (comida, transporte, ocio, entretenimiento, turismo, videojuegos, mercado, salud, servicios, otros), each `isPreset:true`, stable ids, a palette color, a valid icon key; "otros" exists (reassign target).
- [ ] **1.5** Run → fail. Implement `lib/domain/presets.ts`. Run → pass.
- [ ] **1.6 (TDD)** `schemas.test.ts`: valid Expense parses; amount ≤0 rejected; bad date format rejected; unknown currency warns-but-allows (we keep a known ISO list `KNOWN_CURRENCIES` and a `parseExpense` that allows override). Category/Settings/ExportBundle round-trip. `null` baseAmount/fxRate allowed.
- [ ] **1.7** Run → fail. Implement `lib/domain/schemas.ts` (Zod mirrors of each type; `expenseSchema`, `categorySchema`, `settingsSchema`, `exportBundleSchema`; `KNOWN_CURRENCIES` list). Run → pass.
- [ ] **1.8** `lib/domain/ids.ts`: `newId = () => crypto.randomUUID()`. Commit: `feat(domain): types, zod schemas, presets, palette`.

---

## Phase 2 — Format helpers (TDD)

**Goal:** Locale-aware money parse/format and date/month helpers.

**Checkpoint:** `pnpm test tests/unit/format` green.

**Files:** Create `lib/format/money.ts`, `date.ts`; Test `tests/unit/format/money.test.ts`, `date.test.ts`.

- [ ] **2.1 (TDD)** `money.test.ts`:
  - `formatMoney(2847500,'COP','es')` → `"$2.847.500"` (no decimals for COP) — assert via `Intl.NumberFormat` expectation, not hardcoded glyphs that vary by ICU; test the numeric grouping + currency.
  - `formatMoney(12.5,'USD','en')` → `"$12.50"`.
  - `parseAmount('2.847.500','es')` → `2847500`; `parseAmount('12,50','es')` → `12.5`; `parseAmount('1,234.56','en')` → `1234.56`.
  - `roundToMinorUnits(12.349,'USD')` → `12.35`; `roundToMinorUnits(2847500.7,'COP')` → `2847500` (COP minor units = 0).
- [ ] **2.2** Run → fail. Implement `money.ts`: `formatMoney(amount,currency,locale)` via `Intl.NumberFormat(locale,{style:'currency',currency})`; `parseAmount(input,locale)` deriving group/decimal separators from `Intl.NumberFormat(locale).formatToParts`; `roundToMinorUnits` via `Intl.NumberFormat(...).resolvedOptions().maximumFractionDigits`. Run → pass.
- [ ] **2.3 (TDD)** `date.test.ts`: `monthKey('2026-06-15')`→`'2026-06'`; `todayKey()` shape; `daysInMonth('2026-06')`→30; `prevMonthKey('2026-06')`→`'2026-05'`; `isInMonth('2026-06-30','2026-06')` true / `'2026-07-01'` false; `formatMonthLabel('2026-06','es')`→ contains "junio"/"Junio".
- [ ] **2.4** Run → fail. Implement `date.ts` using date-fns (`format`, `parseISO`, `getDaysInMonth`, `subMonths`) + locale (`date-fns/locale/es`, `enUS`). Run → pass. Commit: `feat(format): locale money + date helpers`.

---

## Phase 3 — Pure selectors (TDD)

**Goal:** View-model selectors used by every screen, fully unit-tested without React.

**Checkpoint:** `pnpm test tests/unit/selectors` green.

**Files:** Create `lib/domain/selectors.ts`; Test `tests/unit/selectors.test.ts`. Test fixtures: a `makeExpense(partial)` helper.

Selector signatures (lock these — UI depends on them):
```ts
expensesInMonth(expenses: Expense[], month: string): Expense[]
monthTotal(expenses: Expense[], month: string): { totalBase: number; unconvertedCount: number }
rankedByCategory(expenses: Expense[], categories: Category[], month: string, topN = 6):
  { categoryId: string; name: string; color: string; icon: string; totalBase: number; pct: number }[] // sorted desc, tail folded into 'otros'
spendByDay(expenses: Expense[], month: string):
  { day: number; totalBase: number; isToday: boolean }[] // length = daysInMonth
deltaVsPrevMonth(expenses: Expense[], month: string):
  { pct: number; hasPrev: boolean } // hasPrev=false when no prior-month data
transactionsByDay(expenses: Expense[], categories: Category[], month: string):
  { day: string; rows: {expense: Expense; category: Category}[] }[] // for Histórico
```

- [ ] **3.1 (TDD)** Write `selectors.test.ts` covering: month filtering by calendar day; total sums `baseAmount` skipping nulls and counting them as `unconvertedCount`; ranking sorts desc and folds tail beyond topN into an "Otros" bucket using the otros preset color; `pct` sums to ~100; `spendByDay` returns correct length with `isToday` flag; `deltaVsPrevMonth` computes %, `hasPrev:false` with no prior data; `transactionsByDay` groups + sorts days desc.
- [ ] **3.2** Run → fail. Implement `selectors.ts` (pure, no store import). Run → pass. Commit: `feat(domain): pure selectors with tests`.

---

## Phase 4 — Data layer: Repository (TDD)

**Goal:** `Repository` interface + `LocalStorageRepository` (async-by-default), export/wipe.

**Checkpoint:** `pnpm test tests/unit/data` green (jsdom localStorage).

**Files:** Create `lib/data/repository.ts` (interface from spec §3.3 verbatim), `lib/data/local-storage-repository.ts`; Test `tests/unit/data/local-storage-repository.test.ts`.

- [ ] **4.1** `repository.ts`: the spec §3.3 `Repository` interface exactly.
- [ ] **4.2 (TDD)** test: upsert→list round-trips expenses; delete removes; `deleteCategory(id, reassignTo)` moves its expenses' `categoryId` to `reassignTo`; categories seed presets on first read; settings get/put with defaults (`baseCurrency:'COP', locale:'es', theme:'auto', dashboardView:'bars', schemaVersion:1`); `exportAll` returns `ExportBundle`; `wipeAll` clears keys.
- [ ] **4.3** Run → fail. Implement `local-storage-repository.ts`: namespaced keys (`condor:expenses`, `condor:categories`, `condor:settings`), JSON (de)serialize, seed presets when empty, all methods return Promises. Guard `typeof window`. Run → pass. Commit: `feat(data): localStorage repository`.

---

## Phase 5 — FX layer (TDD)

**Goal:** `FxProvider` interface + Frankfurter implementation with per-date cache + offline fallback.

**Checkpoint:** `pnpm test tests/unit/fx` green (fetch mocked).

**Files:** Create `lib/fx/fx-provider.ts`, `lib/fx/fx-cache.ts`, `lib/fx/frankfurter-fx-provider.ts`; Test `tests/unit/fx/frankfurter-fx-provider.test.ts`.

- [ ] **5.1** `fx-provider.ts`: spec §3.4 interface `getRate(from, base, date): Promise<number>`.
- [ ] **5.2 (TDD)** test (mock `globalThis.fetch`): `from===base`→returns 1 (no fetch); fetch success caches `{from,base,date}→rate`; second call hits cache (no 2nd fetch); fetch failure with prior cache → returns last cached pair rate; fetch failure, no cache → **throws/returns null sentinel** so store can set `baseAmount:null`. Past-date cache is immutable.
- [ ] **5.3** Run → fail. Implement `fx-cache.ts` (localStorage `condor:fxcache`) + `frankfurter-fx-provider.ts` (`GET https://api.frankfurter.app/{date}?from={from}&to={base}`, parse `.rates[base]`). Decide the null contract: `getRate` returns `number | null` — update interface + selectors accordingly. Run → pass. Commit: `feat(fx): Frankfurter provider with cache + offline fallback`.

---

## Phase 6 — Store: Zustand + persist + migrations (TDD)

**Goal:** Single store wiring Repository + FxProvider; actions compute/persist `baseAmount`; persisted via `persist` with `migrate`.

**Checkpoint:** `pnpm test tests/unit/store` green.

**Files:** Create `lib/store/store.ts`, `lib/store/migrations.ts`; Test `tests/unit/store/store.test.ts`, `migrations.test.ts`.

Store shape:
```ts
interface CondorState {
  expenses: Expense[]; categories: Category[]; settings: Settings; hydrated: boolean;
  addExpense(input): Promise<void>;   // computes fxRate+baseAmount via FxProvider, rounds, persists
  updateExpense(id, patch): Promise<void>; // recompute baseAmount if amount/currency/date changed
  deleteExpense(id): Promise<void>;
  addCategory / updateCategory(input): Promise<void>;
  deleteCategory(id, reassignTo): Promise<void>;
  setSettings(patch): Promise<void>;  // if baseCurrency changed → recomputeAllBaseAmounts()
  recomputeAllBaseAmounts(): Promise<void>;
  exportAll(): Promise<ExportBundle>; wipeAll(): Promise<void>;
}
```
FxProvider + Repository are injected (module singletons, swappable in tests/Phase 2).

- [ ] **6.1 (TDD)** `migrations.test.ts`: `migrate(state, fromVersion)` — v0→v1 no-op/normalize; unknown shape falls back to defaults. Implement `migrations.ts`. 
- [ ] **6.2 (TDD)** `store.test.ts` (inject fake FxProvider returning fixed rate, in-memory repo): `addExpense` with non-base currency sets `fxRate` + `baseAmount` (rounded) and appends; with base currency sets rate=1; offline FxProvider (returns null) → `baseAmount:null, fxRate:null`; `updateExpense` recomputes on currency change only; `deleteExpense` removes; `deleteCategory` reassigns; `setSettings({baseCurrency})` triggers `recomputeAllBaseAmounts`.
- [ ] **6.3** Run → fail. Implement `store.ts` with `create<CondorState>()(persist(...,{ name:'condor', version:1, migrate, partialize, onRehydrateStorage→set hydrated }))`. Run → pass. Commit: `feat(store): zustand store + persist + migrations`.

---

## Phase 7 — Design system, tokens, theming, i18n provider

**Goal:** Tailwind v4 tokens (dark default + light), theme provider (dark/light/auto from store), fonts, and the client i18n provider. App shell renders with correct colors.

**Checkpoint:** A throwaway page shows mint `#7EE8C9` on ink `#0E131F`; toggling `settings.theme` flips to light tokens; `useTranslations` resolves a test key in ES and EN.

**Files:** `app/globals.css` (`@theme`), `app/providers.tsx`, `lib/i18n/messages.ts`, `messages/es.json`, `messages/en.json` (seed keys), `components/common/CondorLogo.tsx`.

- [ ] **7.1** `app/globals.css`: Tailwind v4 `@import "tailwindcss"` + `@theme` mapping every §6.1 token to CSS vars (`--color-bg`, `--color-surface`, `--color-surface-2/3`, `--color-text`, `--color-muted`, `--color-outline`, `--color-primary`, `--color-on-primary`, `--color-danger`, plus the 5 category palette colors). Define `:root` (dark default) and `.light` overrides (bg `#FAFAF7`, surface `#FFFFFF`, text `#1A1F2B`). Radius var 12px; font vars. Soft shadow utility.
- [ ] **7.2** `app/providers.tsx` (`'use client'`): (a) hydration gate — render nothing until `useStore(s=>s.hydrated)`; (b) apply `light`/dark class to `<html>` from `settings.theme` (`auto`→`matchMedia('(prefers-color-scheme)')`, respect changes); (c) `NextIntlClientProvider` with `locale=settings.locale`, `messages` from `lib/i18n/messages.ts`, `timeZone='America/Bogota'`; (d) wrap `prefers-reduced-motion` awareness.
- [ ] **7.3** `lib/i18n/messages.ts`: `getMessages(locale)` statically importing `messages/es.json` / `en.json` (both bundled; tiny). Seed both files with a `Common` namespace (app name, save, cancel, delete) for smoke test.
- [ ] **7.4** `app/layout.tsx`: `<html lang>` (lang from a server default 'es'; client provider corrects), font vars, `<body class="bg-bg text-text font-inter">`, render `<Providers>{children}</Providers>`. Mobile viewport meta, theme-color meta `#0E131F`.
- [ ] **7.5** `components/common/CondorLogo.tsx`: inline SVG of the condor-in-radar-ping-ring (from `00-logo.png`) — mint glyph, dashed ring; prop `animate` gating the wings+ping pulse (CSS keyframes, disabled under `prefers-reduced-motion`).
- [ ] **7.6** Verify visually (Playwright screenshot or `pnpm dev` + manual). Commit: `feat(ui): design tokens, theming, i18n provider, logo`.

---

## Phase 8 — Base components (component inventory)

**Goal:** Build the §6.2 inventory as reusable, store/selector-wired components. Component tests where logic exists (parsing, persistence, reassign). Markup driven by mockups + frontend-design skill.

**Checkpoint:** Each component renders in isolation matching its mockup region; `pnpm test tests/component` green.

> Apply **ui-ux-pro-max** + **frontend-design** for visual polish; match the soft-tech pastel mockups (no generic AI look). All targets ≥44px; tabular figures for money.

- [ ] **8.1** `AmountInput` (large Space Grotesk number, locale-aware parse via `parseAmount`, controlled). **Component test:** typing `2.847.500` in es yields value `2847500`. `CurrencyPill` (dropdown, default base). 
- [ ] **8.2** `CategoryBadge` (colored circle + lucide icon) and `CategoryChip` (selectable, mint ring when active).
- [ ] **8.3** `TransactionRow` (badge + merchant/note + amount original, base-currency subtext). `DatePickerRow`, `TextFieldRow`.
- [ ] **8.4** `MonthSwitcher` (pill ▾; prev/next + label via `formatMonthLabel`; drives a shared `month` — store it in a small UI store or URL search param `?m=YYYY-MM`; **decision:** keep `month` in a lightweight client context/Zustand UI slice, default `todayKey()`). `MonthTotal` (big mint number + `formatMoney` + delta chip via `deltaVsPrevMonth`, hidden when `!hasPrev`).
- [ ] **8.5** `ViewSwitcher` (segmented pill Barras/Dona/Treemap; reads/writes `settings.dashboardView`). **Component test:** clicking Dona persists `dashboardView:'donut'`.
- [ ] **8.6** `BottomNav` (3 tabs Inicio/Histórico + raised mint center `AddFab` notch → `/anadir`; active tint mint). `SettingRow`, `SegmentedControl`, `ConfirmDialog` (shadcn AlertDialog), `UndoToast` (shadcn Sonner), `EmptyState`.
- [ ] **8.7** `ColorSwatchPicker` (palette + custom hex), `IconPicker` (ICON_KEYS grid), `CategoryListItem` (badge + name + month total + edit/delete), `NewCategorySheet` (shadcn Sheet/Dialog: name + color + icon → `addCategory`).
- [ ] Commit per logical group: `feat(ui): <group> components`.

---

## Phase 9 — Charts: zero-dependency SVG/CSS (TDD geometry)

**Goal:** Bars + Treemap pure CSS/SVG (no lib); Donut + day-strip hand-rolled SVG. Geometry precomputed in tested pure functions (perf + testability).

**Checkpoint:** `pnpm test tests/unit/geometry` green; charts render from `rankedByCategory`/`spendByDay`; bars are the accessible representation (list semantics + aria).

**Files:** Create `lib/domain/geometry.ts`; Test `tests/unit/geometry.test.ts`; `components/charts/RankedBars.tsx`, `Treemap.tsx`, `DonutChart.tsx`, `SpendByDayStrip.tsx`.

- [ ] **9.1 (TDD)** `geometry.test.ts`:
  - `barWidths(items, maxPct)` → each item width % relative to the largest (largest = 100%).
  - `squarify(items, width, height)` → non-overlapping rects whose areas are proportional to value and that tile the box (sum of areas ≈ W·H; assert proportionality + bounds). Treemap algorithm is the squarified treemap.
  - `donutArcs(items, radius, stroke)` → array of `{ d|dashArray, offset, color }` whose angular spans are proportional and sum to full circle.
  - `dayBarHeights(series, maxHeight)` → per-day heights scaled to max.
- [ ] **9.2** Run → fail. Implement `geometry.ts` (pure). Run → pass.
- [ ] **9.3** `RankedBars.tsx`: ordered list; each row = `CategoryBadge` + name + `formatMoney` + pct, CSS-width bar in category color; grow-in animation gated by reduced-motion; row tap → `/historico?cat=<id>&m=<month>` (drill-in). Renders the "sin convertir" count when present.
- [ ] **9.4** `Treemap.tsx`: absolutely-positioned divs from `squarify`, category colors, label+amount when the cell is big enough; `aria-label` summary.
- [ ] **9.5** `DonutChart.tsx`: SVG circle arcs from `donutArcs` + legend list (proportions). `aria-label` summary.
- [ ] **9.6** `SpendByDayStrip.tsx` ("¿Cuándo gastaste?"): thin vertical bars from `dayBarHeights`; today bar mint; axis labels (01 / HOY / last day) per mockup. **Distinct control from ViewSwitcher** — never merged.
- [ ] **9.7** `SpendingView.tsx`: mode dispatcher reading `settings.dashboardView` → Bars/Donut/Treemap. Commit: `feat(charts): zero-dep bars/treemap + svg donut/day-strip`.

---

## Phase 10 — Screens (mockup order) + app shell

**Goal:** Assemble the five screens to match `condor-mockups/`, wired to store/selectors/components.

**Checkpoint:** Each screen visually matches its mockup; navigation works; empty states render.

- [ ] **10.1 Inicio** (`01-inicio.png`): header (`CondorLogo` + "Cóndor" + `MonthSwitcher`); `MonthTotal` + delta; `ViewSwitcher`; `SpendingView`; "¿Cuándo gastaste?" `SpendByDayStrip`; `BottomNav`+FAB. Empty state when no expenses.
- [ ] **10.2 Añadir** (`02-anadir.png`): top bar (back, "Añadir gasto", "Guardar"); big `AmountInput` + `CurrencyPill` + "≈ se convierte a tu moneda base" hint; `DatePickerRow` (default today, future warns); horizontal `CategoryChip`s (presets + custom + "＋ Nueva" → `NewCategorySheet`); merchant + note `TextFieldRow`s; primary "Guardar gasto" → `addExpense` → back to Inicio. Zod-validate on submit.
- [ ] **10.3 Categorías** (`03-categorias.png`): "PREDETERMINADAS" list + "PERSONALIZADAS" list (`CategoryListItem` with month totals from selectors); "＋ Nueva categoría" + palette preview; edit/delete; delete-with-expenses → `ConfirmDialog` offering reassign to "Otros" (uses `deleteCategory(id, otrosId)`). Reachable from Inicio header.
- [ ] **10.4 Ajustes** (`04-ajustes.png`): Preferencias (moneda base select → `recomputeAllBaseAmounts`; idioma ES/EN; tema `SegmentedControl` Oscuro/Claro/Auto; vista de inicio); Datos (Exportar JSON download via `exportAll` + Blob; Borrar todo → `ConfirmDialog` → `wipeAll`); Acerca de (logo, "v1.0 · Fase 1", "Lo ve todo desde arriba.", "Tus datos se guardan solo en este dispositivo."). Reachable from Inicio header.
- [ ] **10.5 Histórico** (no mockup; tokens + `TransactionRow`): month-scoped `transactionsByDay`, grouped by day headers, each row original + base subtext; honors `?cat=` drill-in filter; shares `MonthSwitcher`.
- [ ] **10.6** Wire drill-in (bar/row tap → Histórico filtered) and edit flow (tap a transaction → Añadir in edit mode → `updateExpense`). Commit per screen: `feat(screen): <name>`.

---

## Phase 11 — i18n sweep

**Goal:** Every visible string comes from `messages/es.json` + `en.json`; ES default, EN complete; runtime toggle works without reload.

**Checkpoint:** Toggling idioma in Ajustes re-renders all screens in EN; no hardcoded Spanish in JSX.

- [ ] **11.1** Extract all UI strings into namespaces (`Common`, `Inicio`, `Anadir`, `Categorias`, `Ajustes`, `Historico`, `Categories` preset names). Replace literals with `useTranslations`.
- [ ] **11.2** Ensure number/date formatting uses active locale (`settings.locale`) everywhere via `formatMoney`/`formatMonthLabel`.
- [ ] **11.3** Verify EN parity (no missing keys — add a dev-time check or test asserting key sets match). Commit: `feat(i18n): full ES/EN coverage`.

---

## Phase 12 — PWA (Serwist) + icons + motion

**Goal:** Installable, offline-capable PWA with condor icons and the app-open ping.

**Checkpoint:** `pnpm build` emits `public/sw.js` + `out/`; app installs; works offline (FX degrades to "sin conversión"); Lighthouse PWA installable check passes.

**Files:** `app/sw.ts`, `app/~offline/page.tsx`, `public/manifest.webmanifest`, `public/icons/*`, `next.config.ts` (withSerwist), `tsconfig.json` (webworker lib + `@serwist/next/typings`).

- [ ] **12.1** Generate icons from `00-logo.png`/`CondorLogo`: 192, 512, and maskable (safe-zone padded) PNGs into `public/icons/`. `manifest.webmanifest`: name "Cóndor", short_name, theme_color `#0E131F`, background `#0E131F`, display standalone, icons, start_url `/`.
- [ ] **12.2** `app/sw.ts` per @serwist/next (`defaultCache`, precache, `cacheOnNavigation`, `~offline` fallback). Update `next.config.ts` to wrap with `withSerwist({ swSrc:'app/sw.ts', swDest:'public/sw.js' })`; add webworker lib + types to tsconfig. Verify SW emits under `output:'export'`.
- [ ] **12.3** App-open ping animation on `CondorLogo` (Inicio header mount), gated by `prefers-reduced-motion`. Commit: `feat(pwa): serwist sw, manifest, icons, app-open ping`.

---

## Phase 13 — E2E (Playwright)

**Goal:** The spec §7.3 core flow passes end-to-end against the built static app.

**Checkpoint:** `pnpm e2e` green.

**Files:** `tests/e2e/core-flow.spec.ts`.

- [ ] **13.1** Write the flow: add expense → see it on Inicio (total + top bar) → drill into category (Histórico filtered) → edit → delete → switch ViewSwitcher + reload (persisted) → change base currency in Ajustes (totals recompute) → offline add (graceful "sin conversión") → export JSON + wipe (empty state) → toggle ES↔EN → toggle dark/light. Use stable `data-testid`s added during Phase 8/10.
- [ ] **13.2** Run → green. Commit: `test(e2e): core flow`.

---

## Phase 14 — Lighthouse, a11y, acceptance

**Goal:** Hit perf/a11y budgets and verify every §9 acceptance criterion.

**Checkpoint:** All §9 boxes checked; Lighthouse mobile ≥90 perf/a11y/best-practices; first-load JS < ~120kb gz.

- [ ] **14.1** Run Lighthouse (mobile) on the built app; fix regressions (bundle, LCP <2s, no layout thrash). Confirm no charting lib in the bundle.
- [ ] **14.2** a11y pass: AA contrast (mint for large numbers/accents only, body uses `--text`), ≥44px targets, chart text alternatives/aria, keyboard nav, reduced-motion gating.
- [ ] **14.3** Walk spec §9 acceptance list explicitly; verify "UI never imports localStorage/fetch directly" (grep components for `localStorage`/`fetch` → none). Confirm only currency/date reach Frankfurter.
- [ ] **14.4** Final commit + (optional) `vercel deploy`. 

---

## Self-review (spec coverage)

- §2.1 Expense CRUD + validation → Phases 1,6,10.2,10.6. §2.2 Categories incl. delete-reassign → 1,4,8.7,10.3. §2.3 Dashboard (total/delta/3 views/day-strip/empty) → 3,8,9,10.1. §2.4 Histórico → 3,10.5. §2.5 Settings (currency/lang/theme/view/export/wipe) → 6,10.4. §2.6 Nav (3 tabs + FAB, header affordances) → 8.6,10.
- §3 Architecture seams (Repository/FxProvider/selectors, async) → 3,4,5,6. §4 Data model + Zod + migrations → 1,6. §5 algorithms (month scope, ranking, day series, FX, locale money) → 2,3,5,6.
- §6 tokens/components/screens/theming/PWA/a11y/motion → 7,8,9,10,12,14. §7 perf/security/QA → 12,13,14. §9 acceptance → 14.3.

**Gaps intentionally deferred (Phase 2, per spec §10):** auth, cloud sync, PDF import, trends/anomaly, budgets. No Phase-1 requirement is unassigned.

---

## Execution note

i18n provider setup is pulled earlier (Phase 7) than the prompt's "i18n after screens" ordering because screens can't render `useTranslations` without it; the full string-extraction *sweep* still happens at Phase 11 as the prompt intends.
