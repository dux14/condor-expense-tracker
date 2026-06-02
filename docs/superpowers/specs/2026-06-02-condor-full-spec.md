# Cóndor — Full Specification (Phase 1 buildable, Phase 2 ready)

> **Product question Cóndor answers:** *"¿A dónde se va mi plata cada mes?"*
> Capture every expense, categorize it, rank it largest→smallest, and (Phase 2) compare month-over-month to tell *normal* spend from *one-off emergencia*.
>
> Companion docs: `2026-06-02-condor-expense-tracker-design.md` (decisions + brand), `condor-mockups/` (Stitch screens), `2026-06-02-condor-initial-prompt.md` (the build prompt). Date: 2026-06-02. Locale default: **es-CO**.

---

## 0. Reading order & non-negotiables

- **Phase 1 = local-first, NO backend, NO auth, NO PDF.** Data lives in `localStorage` on one device. Ships to Vercel as a static/client PWA.
- **Performance is a hard constraint.** Primary charts (ranked bars, treemap) are **zero-dependency SVG/CSS**. A small lib is allowed only for donut/line.
- **Bilingual from day one:** ES (default) + EN, via next-intl.
- **Build behind interfaces so Phase 2 swaps in cloud without touching UI.** The store talks to a `Repository` interface and an `FxProvider` interface; Phase 1 implements them with localStorage + Frankfurter, Phase 2 reimplements them against a DB + server FX.
- **Verify all library versions with context7 at build time** (knowledge cutoff predates build). Pin to latest stable.

---

## 1. Scope

### Phase 1 (this build)
| In | Out (deferred to Phase 2+) |
|----|----|
| Manual expense CRUD | Auth / accounts |
| Preset + custom categories (name, color, icon) | Cloud sync / cross-device |
| Multi-currency entry, base-currency conversion for aggregates | PDF bank-statement import + LLM auto-categorization |
| Home dashboard: ranked bars (default) / donut / treemap, switchable | Month-over-month trends & anomaly detection |
| Secondary "spend-by-day" timing strip | Server-side rate limiting |
| Current-month focus + month switcher | Budgets per category |
| ES/EN, dark/light, PWA install + offline | Notifications |
| Export / wipe local data | |

### Out of scope, permanently (Phase 1 design assumption)
- No analytics/telemetry that sends data off-device in Phase 1 (privacy: local-first).

---

## 2. Functional requirements (Phase 1)

### 2.1 Expenses
- **Create:** amount (>0), currency (default = base currency), date (default today, not future-blocked but warn), category (required), merchant (optional), note (optional). On save: compute `baseAmount` via `fxRate` for the expense's `date` (see §5.4), persist, return to Home.
- **Read:** list by month; filter by category (tapping a bar/row drills into that category's transactions for the month).
- **Update:** edit any field; recompute `baseAmount` if amount/currency/date changed.
- **Delete:** with confirm; soft UX (undo toast preferred, hard-delete acceptable for Phase 1).
- **Validation:** Zod schema (§4). Amount parsed locale-aware (es-CO uses `.` thousands / `,` decimals; en uses `,`/`.`).

### 2.2 Categories
- **Presets** (seeded, `isPreset: true`, not deletable but hideable): comida, transporte, ocio, entretenimiento, turismo, videojuegos, mercado, salud, servicios, otros. Each has a default pastel color + icon.
- **Custom:** create/edit/delete with name + color (from pastel palette or custom hex) + icon (from a curated icon set). Deleting a category with expenses → prompt to reassign to "Otros" or block.
- Category color drives its bar/segment/treemap color and its icon badge everywhere.

### 2.3 Dashboard (Home / Inicio) — the centerpiece
- Big **month total** in base currency (Space Grotesk, mint), with month switcher and a small delta chip vs previous month (Phase 1 may show delta only when prior-month data exists; otherwise hide).
- **Composition view** behind one `<SpendingView mode>` interface, switchable via a segmented pill, choice persisted to Settings:
  - **Barras (default):** horizontal ranked bars largest→smallest, category color, label + amount + %. Tap → category transactions.
  - **Dona:** donut + legend list with proportions.
  - **Treemap:** area = spend.
- **Timing strip ("¿Cuándo gastaste?"):** thin per-day vertical bars for the month; today highlighted mint. This is **distinct** from composition — never merge the two pickers.
- Empty state: friendly prompt to add first expense.

### 2.4 Histórico
- Phase 1: month-scoped transaction list (all categories), grouped by day, each row = category badge + merchant/note + amount (original currency, base-currency subtext). Search/filter optional.
- Month switcher shared with Home.
- (Phase 2 expands this into trends.)

### 2.5 Settings (Ajustes)
- **Moneda base** (base currency for all aggregates).
- **Idioma** (ES/EN).
- **Tema** (Oscuro / Claro / Auto).
- **Vista de inicio** (default dashboard mode).
- **Datos:** Exportar (JSON download of all data) · Borrar todo (confirm, wipes localStorage).
- **Acerca de:** logo, "v1.0 · Fase 1", tagline "Lo ve todo desde arriba.", note "Tus datos se guardan solo en este dispositivo."

### 2.6 Navigation
- Mobile bottom nav: **3 tabs + center Add** → *Inicio · ＋ Añadir · Histórico*. Categorías & Ajustes reached from a header affordance on Inicio (and/or inside settings). Center **＋** is a raised mint FAB.
- Añadir opens as a full screen (or sheet) per `02-anadir.png`.

---

## 3. Architecture

### 3.1 Stack (confirm latest stable via context7 at build)
- **Next.js (App Router) + TypeScript**, React. Phase 1 is client-rendered/static export-friendly; Phase 2 adds API routes/server in the same repo.
- **Tailwind CSS + shadcn/ui** for primitives; design tokens from §6.1.
- **State + persistence:** **Zustand** with `persist` middleware over `localStorage`.
- **i18n:** **next-intl** (ES default, EN).
- **Validation:** **Zod**. **Dates:** **date-fns** (+ `date-fns-tz` only if needed). **FX:** **Frankfurter** (ECB, no key).
- **PWA:** installable + offline (Serwist/next-pwa or hand-rolled service worker — pick the lightest that works with current Next.js; confirm via context7).
- **Charts:** zero-dep SVG/CSS for **bars** + **treemap**; small lib (e.g. a tiny donut or hand-rolled SVG arc) for **donut/line**. Prefer hand-rolled SVG to avoid a dependency unless context7 shows a <5kb option.
- **IDs:** `crypto.randomUUID()`.

### 3.2 Layered design (the Phase-2 seam)
```
UI (React components, screens)
        │  calls hooks/selectors only
        ▼
Domain store (Zustand)  ──►  Repository interface   ──► Phase1: LocalStorageRepository
        │                                              Phase2: ApiRepository (DB-backed)
        ├──► FxProvider interface ──► Phase1: FrankfurterFxProvider (+ local cache)
        │                              Phase2: ServerFxProvider
        └──► Selectors (pure): monthTotal, byCategory ranked, byDay, fx-converted aggregates
```
- **UI never imports localStorage or fetch directly.** It uses store actions + selectors. Swapping `Repository`/`FxProvider` implementations in Phase 2 leaves screens untouched.
- **Selectors are pure functions** of state → derived view models (ranked categories, per-day series, totals). They are unit-testable without React.

### 3.3 Repository interface (Phase 1 ↔ Phase 2 contract)
```ts
interface Repository {
  listExpenses(): Promise<Expense[]>;          // Phase1: sync localStorage wrapped in Promise
  upsertExpense(e: Expense): Promise<Expense>;
  deleteExpense(id: string): Promise<void>;
  listCategories(): Promise<Category[]>;
  upsertCategory(c: Category): Promise<Category>;
  deleteCategory(id: string, reassignTo?: string): Promise<void>;
  getSettings(): Promise<Settings>;
  putSettings(s: Settings): Promise<Settings>;
  exportAll(): Promise<ExportBundle>;
  wipeAll(): Promise<void>;
}
```
Async-by-default even in Phase 1 so Phase 2's network calls don't change call sites.

### 3.4 FX provider interface
```ts
interface FxProvider {
  // rate to convert `from` → `base` on a given date (yyyy-mm-dd). 1 if equal.
  getRate(from: Currency, base: Currency, date: string): Promise<number>;
}
```
- Phase 1 `FrankfurterFxProvider`: `GET https://api.frankfurter.app/{date}?from={from}&to={base}`, cache `{from,base,date}→rate` in localStorage (immutable for past dates). Offline/failure fallback: last cached rate for the pair, else store `fxRate: null` and show "sin conversión" until reconnect, then backfill.
- `baseAmount` is stored **derived and persisted** (so totals work offline) but recomputable.

---

## 4. Data model

```ts
type Currency = string;        // ISO 4217, e.g. "COP", "USD", "EUR"
type DashboardView = 'bars' | 'donut' | 'treemap';
type ThemePref = 'dark' | 'light' | 'auto';
type Locale = 'es' | 'en';

interface Expense {
  id: string;                  // crypto.randomUUID()
  amount: number;              // in `currency`, > 0
  currency: Currency;
  baseAmount: number | null;   // derived: amount * fxRate; null if FX unavailable
  fxRate: number | null;       // rate currency→baseCurrency on `date`; 1 if equal; null if unknown
  date: string;                // 'yyyy-MM-dd' (local calendar day)
  categoryId: string;
  merchant?: string;
  note?: string;
  source: 'manual';            // Phase 2 adds 'import'
  createdAt: string;           // ISO timestamp
  updatedAt: string;           // ISO timestamp
}

interface Category {
  id: string;
  name: string;
  color: string;               // hex, from pastel palette or custom
  icon: string;                // icon key from curated set
  isPreset: boolean;
  hidden?: boolean;            // presets can be hidden, not deleted
}

interface Settings {
  baseCurrency: Currency;      // default 'COP'
  locale: Locale;              // default 'es'
  theme: ThemePref;            // default 'auto'
  dashboardView: DashboardView;// default 'bars'
  schemaVersion: number;       // for migrations
}

interface ExportBundle {
  schemaVersion: number;
  exportedAt: string;
  expenses: Expense[];
  categories: Category[];
  settings: Settings;
}
```
- **Zod schemas** mirror each type; parse on import and on every form submit. Reject unknown currencies not in a known ISO list (warn, allow override).
- **Migrations:** keyed on `schemaVersion`; a `migrate(persistedState)` runs in Zustand `persist` `migrate` callback.

---

## 5. Key behaviors / algorithms

### 5.1 Month scoping
- "Current month" derived from a selected `YYYY-MM` (defaults to today's month). All Home/Histórico aggregates filter `expense.date` within that month (local calendar).

### 5.2 Ranked composition (selector)
- Group month expenses by `categoryId`, sum `baseAmount` (skip nulls but surface a "sin convertir" count), sort desc, compute % of month total. Collapse the long tail into "Otros" beyond N (e.g. top 6 + Otros) for bars/donut; treemap can show more.

### 5.3 Timing strip (selector)
- Sum `baseAmount` per calendar day of the month → spar_ array length = days in month; mark `today`.

### 5.4 FX conversion
- On expense create/edit: if `currency === baseCurrency` → `fxRate=1, baseAmount=amount`. Else call `FxProvider.getRate(currency, baseCurrency, date)`; store both. If base currency changes in Settings → recompute all `baseAmount` lazily (background pass with cached/fetched rates; show progress, tolerate offline).

### 5.5 Number/locale formatting
- Use `Intl.NumberFormat` with the active locale and currency. Input parsing must accept es-CO grouping. Never use floats for money math beyond display rounding issues — store integer minor units **or** numbers with disciplined rounding; **decision: store `amount` as a number but round to currency minor units on entry**, and do all sums on stored values. (If precision bugs appear, migrate to integer minor units — `schemaVersion` covers this.)

---

## 6. Frontend specification

### 6.1 Design tokens (from Stitch `assets/2798232050575735360`, verified visually)
**Dark (default):**
- `--bg`: `#0E131F` (canvas) · `--surface`: `#1A1F2B` · `--surface-2`: `#212736` · `--surface-3`: `#252C3D`
- `--text`: `#EAF0F2` / `#DEE2F3` · `--text-muted`: `#9AA6B2` · `--outline`: `#333B4D`
- `--primary` (mint): `#7EE8C9` · `--on-primary` (ink): `#0C2A22`
- Category palette: lavender `#C9B6FF`, pink `#FF9EB1`, amber `#FFD98A`, sky `#9EC1FF`, mint `#7EE8C9` (cycle; custom categories store own hex)
- `--danger`: `#FFB4AB`

**Light:** bg `#FAFAF7`, surface `#FFFFFF`, text `#1A1F2B`, same mint/category accents (tune for contrast).

**Type:** headings/numbers **Space Grotesk** (700/600, tight tracking, tabular figures for money); body/labels **Inter** (400/500). Scale: display total ~40–48px, headline 24–32, body 16, label 14, caption 12.

**Shape/elevation:** radius 12px cards/inputs/chips; pills `full`; soft diffused shadows (low-opacity, wide blur), no hairlines; tonal layering for depth. Side margins 20px, single column, mobile-first; desktop centers a ~480px column.

### 6.2 Component inventory
- `BottomNav` (3 tabs + center FAB notch), `AddFab` (mint, ink ＋, subtle glow)
- `MonthSwitcher` (pill, ▾)
- `MonthTotal` (big mint number + currency + delta chip)
- `ViewSwitcher` (segmented pill: Barras/Dona/Treemap, mint active)
- `SpendingView` (mode dispatcher) → `RankedBars`, `DonutChart`, `Treemap` (bars/treemap = pure SVG/CSS; donut = SVG arcs)
- `SpendByDayStrip` (thin vertical bars, today=mint)
- `CategoryBadge` (colored circle + icon), `CategoryChip` (selectable, mint ring)
- `TransactionRow` (badge + merchant/note + amount original + base subtext)
- `AmountInput` (large, locale-aware), `CurrencyPill`, `DatePickerRow`, `TextFieldRow`
- `CategoryListItem`, `ColorSwatchPicker`, `IconPicker`, `NewCategorySheet`
- `SettingRow` (label + trailing value/control), `SegmentedControl`, `ConfirmDialog`, `UndoToast`, `EmptyState`

### 6.3 Screens (match mockups in `condor-mockups/`)
1. **Inicio** (`01-inicio.png`): header (logo + wordmark + month switcher), MonthTotal + delta, ViewSwitcher, SpendingView (default RankedBars), SpendByDayStrip, BottomNav + FAB.
2. **Añadir** (`02-anadir.png`): top bar (back, title, Guardar), big AmountInput + CurrencyPill + base-conversion hint, DatePickerRow, horizontal CategoryChips (+ "＋ Nueva"), merchant + note fields, primary "Guardar gasto".
3. **Categorías** (`03-categorias.png`): Predeterminadas list, Personalizadas list (edit affordance), "＋ Nueva categoría" + palette swatch preview.
4. **Ajustes** (`04-ajustes.png`): Preferencias (moneda base, idioma, tema segmented, vista de inicio), Datos (exportar, borrar todo), Acerca de.
5. **Histórico:** month-scoped grouped transaction list (not yet mocked — follow tokens + TransactionRow).

### 6.4 Theming, PWA, a11y
- Theme via CSS variables + `class="dark"` toggle; `auto` follows `prefers-color-scheme`. Persist to Settings.
- PWA: manifest (name "Cóndor", mint theme color, condor icon at 192/512 + maskable), offline shell, installable. App fully usable offline (FX degrades gracefully).
- **Accessibility:** WCAG AA contrast (verify mint-on-ink for text vs decorative use — mint is for large numbers/accents; body text uses `--text`). All interactive targets ≥44px. Charts have text alternatives (the ranked list *is* the accessible representation; donut/treemap get aria summaries). Full keyboard nav on desktop. Respect `prefers-reduced-motion` (logo ping + bar grow animations gated).

### 6.5 Motion
- Logo: wings + radar ping pulse on app open (reduced-motion: static). Bars: grow-in on mount (gated). Keep cheap (transform/opacity only).

---

## 7. Non-functional

### 7.1 Performance budget
- First load JS (Phase 1) target < ~120kb gzip; no charting lib for bars/treemap. Lighthouse mobile ≥ 90 perf/a11y/best-practices. LCP < 2.0s on mid-tier mobile. Charts render without layout thrash (precompute geometry in selectors).

### 7.2 Security & privacy (Phase 1)
- **All data local;** nothing leaves the device except FX rate requests to Frankfurter (sends only currency codes + date — no expense data). Document this in Acerca de.
- No secrets in the client. FX endpoint is keyless.
- Sanitize/escape any user free-text (merchant/note) on render (React handles, but avoid `dangerouslySetInnerHTML`).
- Export = explicit user action; import (if added) validates with Zod before merge.
- **Phase 2 security (design-ahead):** Google auth, per-user row-level isolation, API rate limiting, server-side PDF parsing in an isolated/sandboxed path, secrets in env (never client). The `Repository`/`FxProvider` seam keeps these server-only.

### 7.3 QA / testing strategy
- **Unit (Vitest):** selectors (ranking, per-day, totals, % math), FX conversion + cache, Zod schemas, locale number parse/format, migrations.
- **Component (Testing Library):** AmountInput parsing, ViewSwitcher persistence, category CRUD flows, delete-with-reassign.
- **E2E (Playwright):** add→see on Home→drill into category→edit→delete; switch view + reload (persisted); change base currency → totals recompute; offline add (graceful FX); export/wipe; ES↔EN; dark/light.
- **Visual check:** compare built screens to `condor-mockups/`.
- Test IDs stable; selectors pure for fast unit coverage.

---

## 8. Project structure (suggested)
```
app/                      # Next.js App Router
  (tabs)/inicio/page.tsx
  (tabs)/historico/page.tsx
  anadir/page.tsx
  categorias/page.tsx
  ajustes/page.tsx
  layout.tsx              # providers: theme, i18n, store hydration
components/               # inventory §6.2
  charts/                 # RankedBars, DonutChart, Treemap, SpendByDayStrip (SVG)
lib/
  domain/                 # types, zod schemas, selectors (pure)
  store/                  # zustand store + persist + migrations
  data/                   # Repository iface + LocalStorageRepository
  fx/                     # FxProvider iface + FrankfurterFxProvider + cache
  i18n/                   # next-intl config, messages/es.json, messages/en.json
  format/                 # locale number/date helpers
messages/es.json, en.json
public/                   # manifest, icons (from condor logo), sw
tests/                    # unit, component, e2e
```

## 9. Acceptance criteria (Phase 1 "done")
- [ ] Add/edit/delete expenses with multi-currency; base-currency conversion correct and offline-tolerant.
- [ ] Preset + custom categories with color + icon; delete-with-reassign works.
- [ ] Home shows correct month total, ranked bars (default), donut, treemap — switchable + persisted; spend-by-day strip correct; month switcher works.
- [ ] Histórico lists month transactions grouped by day.
- [ ] Settings: base currency, ES/EN, theme, default view, export JSON, wipe.
- [ ] PWA installs + works offline; dark/light; matches mockups.
- [ ] UI never touches localStorage/fetch directly (only store + selectors); `Repository`/`FxProvider` swappable.
- [ ] Unit + component + e2e suites green; Lighthouse targets met.
- [ ] No expense data leaves device; only currency/date hit Frankfurter.

## 10. Phase 2+ (design-ahead, not built now)
Google auth + cloud DB (Neon/Supabase via Vercel Marketplace) reimplementing `Repository`; server `FxProvider`; PDF bank/credit-card import → server parse + LLM categorization; API rate limiting; month-over-month trends + anomaly detection ("normal vs emergencia"); budgets. None require UI rewrites thanks to §3.2.
