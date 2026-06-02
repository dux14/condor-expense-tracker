# Cóndor — Design Decisions (living doc)

> Personal expense tracker that answers one question: **"¿A dónde se va mi plata cada mes?"**
> Status: brainstorming in progress. This doc is the source of truth across session restarts.
> Date started: 2026-06-02.

## The pain
The user doesn't know where their money goes monthly. Cóndor surfaces it: every expense captured, categorized, ranked largest→smallest, and (later) compared month-over-month to flag whether a spend was normal or a one-off emergency.

## Brand
- **Name:** Cóndor.
- **Concept:** a bird of prey = "the radar of the sky." Sees the whole landscape, misses nothing — like tracking every expense. Hooks: *"Lo ve todo desde arriba." / "Ojo de águila sobre tus gastos."*
- **Mark:** soaring condor silhouette inside a subtle radar **ping ring** (merges the earlier "radar/sonar — detect every expense" concept). Designed to **animate** on app open (wings + ping pulse) — on-trend for 2026.
- **Logo generation:** to be done with **Stitch MCP** (user will restart Claude Code to load Stitch tools). Higgsfield/Canva are fallbacks.

## Visual system (research-backed: 2026 "soft-tech pastel" trend)
- **Dark-first**, light mode adapts. Both required.
- Primary / brand: **Mint `#7EE8C9`** (ties to the ping).
- Category accents: Lavender `#C9B6FF`, Washed pink `#FF9EB1`, Soft amber `#FFD98A`, Sky `#9EC1FF` (+ extend as needed).
- Backgrounds: Ink `#1A1F2B` (dark) / warm off-white `#FAFAF7` (light).
- Style: intentional minimalism, soft gradients, minimal borders, smooth shadows, bold-but-clean type, glanceable.
- Mobile-first (one-handed, short sessions), responsive to desktop, **performance priority**. Bottom nav on mobile.

## Locked product decisions
- **Multi-currency**, original currency stored per expense.
- **Aggregate views** use a **base currency + conversion** (totals/charts in one currency); FX from a **free no-key API** (e.g. Frankfurter/ECB), cached locally. Research current best option via context7 at build.
- **Bilingual i18n** ES + EN from day one (es-CO default).
- **Categories:** curated **preset list + custom** categories (each with color + icon). Presets: comida, transporte, videojuegos, ocio, entretenimiento, turismo, etc.
- **Month-over-month historical comparison → deferred to Phase 2** (needs accumulated data).

## Phasing (Vercel deploy; backend deferred)
**Phase 1 — local-first, NO backend, NO auth, NO PDF.** (User constraint: "no backend yet.")
- Data in **localStorage**, this device only.
- Manual expense **CRUD**; categorize (preset + custom); multi-currency w/ base-currency conversion; **home ranked chart** (centerpiece); current-month focus; ES/EN; dark/light.
- Ships fast on Vercel as a static/edge frontend.

**Phase 2+ — cloud.**
- **Google auth** + cloud DB (Neon/Supabase via Vercel Marketplace) for **cross-device sync**.
- **PDF bank-statement import** (bank account + credit cards) → server-side parsing + LLM auto-categorization.
- **API rate limiting**.
- **Historical trends** + anomaly detection ("normal vs emergencia espontánea").

## Engineering principles
- Investigate libraries/tech with **context7** before implementing.
- Frontend built using **ui-ux-pro-max** + **frontend-design** skills.
- All work aligned with **karpathy-guidelines** (surgical changes, no overengineering, verifiable success criteria).
- Likely stack: Next.js App Router on Vercel (confirm via context7). Charts lib, local storage lib, state mgmt = TBD via research.

## Home screen + navigation (LOCKED)
- **Navigation:** mobile bottom nav = **3 tabs + center Add** → *Inicio · ＋ Añadir · Histórico*. Categories/settings live inside.
- **Dashboard = swappable view behind one interface** (`<SpendingView mode … />`). Phase 1 ships a **3-view switcher** (choice saved to localStorage):
  - **Horizontal ranked bars (default)** — largest→smallest composition, taps through to transactions.
  - **Donut + list** — proportion.
  - **Treemap** — area = spend.
  - Architecture allows adding vertical-bars / bubble / heatmap later without touching home.
- **Secondary "spend over time" strip** on home (vertical bars per day / line) — answers *when* money went, distinct from the category ranking.
- Distinction kept clear: **composition** (bars/donut/treemap, rank categories) vs **timing** (per-day strip). Don't merge into one picker.

## Open decisions (next session)
1. **Expense data model** fields (proposed below — confirm).
2. **Tech stack** confirmation via context7 (framework, charts, storage, state, i18n lib).
3. **Logo + key UI screens** via Stitch (after restart).
4. **Final deliverables:** the detailed spec (architecture + frontend + security/QA/perf/functional) AND the **initial English prompt** for Claude Code.

## Tech stack (LOCKED — versions to be verified via context7 at build)
- **Framework:** **Next.js App Router** + TypeScript (phase 1 static/client; phase 2 adds API routes/server in the same repo).
- **PWA:** **Yes** — installable + offline (fits local-first daily use).
- **Charts:** **Lean** — zero-dep custom SVG/CSS for ranked bars + treemap (fastest paint); a small lib only for donut/line. Performance-first is a hard constraint.
- **Styling:** Tailwind + shadcn/ui, dark/light pastel design tokens.
- **State + persistence:** Zustand `persist` over localStorage (store interface swappable to DB-backed in phase 2).
- **i18n:** next-intl (ES default, EN). **Validation:** Zod. **Dates:** date-fns. **FX:** Frankfurter/ECB (no key), cached.
- **Data model:**
  - `Expense { id, amount, currency, baseAmount(derived), fxRate, date, categoryId, note?, merchant?, source:'manual', createdAt, updatedAt }`
  - `Category { id, name, color, icon, isPreset }`
  - `Settings { baseCurrency, locale, theme, dashboardView }`

## Stitch brief (fire after restart)
Generate with Stitch MCP, in this order:
1. **Logo / app icon — Cóndor.** Soaring Andean condor silhouette (wide fingered wings) inside a subtle radar **ping ring**; minimal, geometric, soft curves; **mint `#7EE8C9`** glyph on **ink `#1A1F2B`** rounded-squircle tile; also a light-mode variant on `#FAFAF7`. Must read at 32px and animate (wings + ping). Deliver: app icon, horizontal lockup (mark + "Cóndor" wordmark), monochrome.
2. **Key mobile screens (375px, dark-first, soft-tech pastel):**
   - **Home / Inicio** — month total, **ranked horizontal bars** (largest→smallest, category colors), view-switcher chip (bars/donut/treemap), secondary spend-by-day strip, bottom nav (Inicio · ＋ · Histórico).
   - **Add expense / Añadir** — amount + currency, date, category picker (preset + custom w/ color+icon), note.
   - **Categories** — preset + custom management.
   - **Settings** — base currency, language (ES/EN), theme.
   - Optionally desktop responsive of Home.
Use Stitch output to refine the frontend spec, then proceed to deliverables.

## How to resume after restart
1. Read this doc (and project memory auto-recall for "Cóndor").
2. Visual companion mockups persist in `.superpowers/brainstorm/` (restart server via brainstorming `scripts/start-server.sh` if needed).
3. Run the **Stitch brief** above (logo + screens).
4. Write the **full spec** (architecture + frontend + security/QA/performance/functional, phased) and produce the **initial English prompt** for Claude Code (wired to ui-ux-pro-max + frontend-design + karpathy-guidelines + context7). These are the deliverables.

## Stitch visuals — DONE (2026-06-02)
Generated with Stitch MCP. Design system applied; mint/ink soft-tech pastel confirmed visually.
- **Project:** `projects/14302665795858308517`
- **Design system:** `assets/2798232050575735360` (Space Grotesk headings / Inter body, ROUND_12, mint `#7EE8C9` primary, ink `#1A1F2B` neutral, lavender/sky category overrides). Note: Stitch darkened the canvas background to `#0E131F` and surface to `#1A1F2B` — keep that as the real dark-mode token mapping.
- **Screens (mockups saved in `condor-mockups/`):**
  - Logo mark `167119270de546f2a532aa8c76a1177f` → `00-logo.png` (condor silhouette in dashed radar ping ring, mint).
  - Home / Inicio `84ec4fe2aaed4b1098a67d8e8e05bf0f` → `01-inicio.png` (big mint total, ranked bars, Barras/Dona/Treemap switcher, spend-by-day strip, bottom nav + center FAB).
  - Añadir gasto `a08291097e1a480d9724add52d472697` → `02-anadir.png` (large mint amount, COP pill, base-currency hint, date, category chips, merchant/note, Guardar).
  - Categorías `9790172a7b394aff9806f8fe0a7924da` → `03-categorias.png` (preset list w/ colored badges + totals, custom Mascotas row, Nueva categoría + palette swatches).
  - Ajustes `125fb3dbc9e5478ebe71e9e2c6c00a47` → `04-ajustes.png` (Preferencias: moneda base/idioma/tema/vista; Datos: exportar/borrar; Acerca de: logo + v1.0 Fase 1 + local-data note).
- Deliverables built from these: `2026-06-02-condor-full-spec.md` + `2026-06-02-condor-initial-prompt.md`.

## Status: visuals DONE. Deliverables = full spec + initial prompt (this session).
