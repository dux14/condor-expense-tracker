# Cóndor — Initial Build Prompt (paste into a fresh Claude Code session)

> Copy everything inside the fenced block below into a new Claude Code session, run from the repo root. It assumes the two spec docs and the `condor-mockups/` images are present in `docs/superpowers/specs/`.

---

```
Build Phase 1 of "Cóndor", a local-first personal expense tracker. Greenfield project.

PRODUCT
Cóndor answers one question: "¿A dónde se va mi plata cada mes?" — capture every expense, categorize it, and rank spending largest→smallest for the current month. Brand metaphor: a condor as "radar of the sky" (sees everything from above); mint-on-ink soft-tech pastel look.

SOURCES OF TRUTH — read these first, in order:
1. docs/superpowers/specs/2026-06-02-condor-full-spec.md   ← the spec; obey it
2. docs/superpowers/specs/2026-06-02-condor-expense-tracker-design.md   ← brand + locked decisions
3. docs/superpowers/specs/condor-mockups/*.png   ← the target UI (Inicio, Añadir, Categorías, Ajustes, logo). Match these.
If anything here conflicts with the full spec, the full spec wins. If the spec is silent, ask before inventing scope.

HARD CONSTRAINTS (do not violate)
- Phase 1 ONLY: local-first, NO backend, NO auth, NO PDF import. All data in localStorage, one device. Deployable to Vercel as a static/client PWA.
- Performance is a hard requirement: ranked BARS and TREEMAP must be zero-dependency hand-built SVG/CSS. A tiny/hand-rolled SVG is allowed only for the DONUT and the spend-by-day strip. No heavy charting library.
- Bilingual ES (default, es-CO) + EN via next-intl from the start.
- Dark-first + light theme; PWA installable + offline.
- Build behind the seams in the spec: UI talks only to the Zustand store + pure selectors; the store talks to a `Repository` interface and an `FxProvider` interface. Phase 1 implements them with localStorage + Frankfurter. Do NOT let components import localStorage or fetch directly — Phase 2 must be able to swap these implementations without touching UI.

STACK (verify the LATEST STABLE version of each with context7 BEFORE installing — my knowledge may be stale; pin what context7 reports)
Next.js App Router + TypeScript · Tailwind + shadcn/ui · Zustand (persist) · next-intl · Zod · date-fns · Frankfurter FX (keyless) · a lightweight PWA setup compatible with the current Next.js. Use pnpm for everything. Use crypto.randomUUID() for ids.

DESIGN TOKENS (from the spec §6.1; the mockups are authoritative for layout)
- Dark: bg #0E131F, surface #1A1F2B / #212736 / #252C3D, text #EAF0F2, muted #9AA6B2, primary mint #7EE8C9, on-primary ink #0C2A22.
- Category palette (cycle; custom categories store own hex): lavender #C9B6FF, pink #FF9EB1, amber #FFD98A, sky #9EC1FF, mint #7EE8C9. Danger #FFB4AB.
- Light: bg #FAFAF7, surface #FFFFFF, text #1A1F2B.
- Type: Space Grotesk for headings + money (tabular figures, tight tracking); Inter for body/labels. Radius 12px (pills full). Soft diffused shadows, no hairlines. 20px side margins, single column, mobile-first; desktop centers ~480px.
- Navigation: bottom nav = 3 tabs + center raised mint FAB → Inicio · ＋ Añadir · Histórico. Categorías + Ajustes reachable from the Inicio header.

SCREENS TO BUILD (match the mockups)
- Inicio: logo+wordmark+month switcher; big mint month total + delta chip; ViewSwitcher (Barras default / Dona / Treemap), choice persisted; SpendingView; "¿Cuándo gastaste?" spend-by-day strip; bottom nav + FAB. Keep composition (bars/donut/treemap) and timing (per-day strip) as SEPARATE controls.
- Añadir: large amount + currency pill + "≈ se convierte a tu moneda base" hint; date; horizontal category chips (preset + custom, + "＋ Nueva"); merchant + note (optional); "Guardar gasto".
- Categorías: presets list (colored badge + icon + month total) + custom list (edit/delete) + "＋ Nueva categoría" with color-swatch + icon picker. Deleting a category with expenses prompts reassign to "Otros".
- Ajustes: Preferencias (moneda base, idioma ES/EN, tema Oscuro/Claro/Auto, vista de inicio) · Datos (Exportar JSON, Borrar todo with confirm) · Acerca de (logo, "v1.0 · Fase 1", tagline "Lo ve todo desde arriba.", "Tus datos se guardan solo en este dispositivo.").
- Histórico: month-scoped transactions grouped by day (no mockup — use the tokens + TransactionRow).

DATA MODEL, FX, SELECTORS — implement exactly as in the spec §4–§5 (Expense/Category/Settings/ExportBundle types, Zod schemas, schemaVersion migrations; FX with per-date cache + offline fallback to null baseAmount; pure selectors for monthTotal, ranked-by-category with %, per-day series; locale-aware money parse/format with Intl).

HOW TO WORK
- Use the brainstorming/decisions already locked — do NOT re-brainstorm; this is execution. If a genuine ambiguity blocks you, ask one crisp question, otherwise proceed.
- Apply the ui-ux-pro-max and frontend-design skills for component design and polish (avoid generic AI aesthetics; hit the soft-tech pastel target in the mockups).
- Apply karpathy-guidelines throughout: surgical changes, no overengineering, no speculative abstractions beyond the Repository/FxProvider seams the spec mandates, and define verifiable success criteria per step.
- Use context7 to confirm APIs/versions for every library before writing against it.
- TDD where it pays: write unit tests for selectors, FX, Zod, formatting, and migrations as you build them. Add Playwright e2e for the core flow (add → Home → drill-in → edit → delete → switch view + reload → change base currency → offline add → export/wipe → ES/EN → dark/light).

PLAN FIRST
Before coding, produce a short phased implementation plan (scaffold → domain/store/selectors + tests → data/fx layers + tests → design system/tokens + base components → screens in mockup order → i18n → PWA → e2e → Lighthouse pass). Show me the plan, then execute it, checking in at the end of each phase.

DONE = the Phase 1 acceptance criteria in the full spec §9 are all green, and the built screens match condor-mockups/.
```

---

### Notes for the operator (not part of the prompt)
- The Stitch project (`projects/14302665795858308517`, design system `assets/2798232050575735360`) can export HTML/React per screen if you want a head start on markup — but the spec's zero-dep-charts and Repository/FxProvider seams matter more than reusing Stitch's generated DOM. Treat Stitch output as visual reference, not code to paste wholesale.
- Logo: the condor-in-radar-ping-ring mark in `00-logo.png` is the basis for the PWA icons (192/512 + maskable) and the animated app-open ping.
- When Phase 1 ships, Phase 2 starts by reimplementing `Repository` (Neon/Supabase via Vercel Marketplace) + `FxProvider` and adding Google auth — no UI rewrite.
