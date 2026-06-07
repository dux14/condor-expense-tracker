# F9 — Aesthetic Fixes (picker nativo, icon pool, safe-areas) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship three independent mobile-first aesthetic fixes for Cóndor: (A) the native date/time picker that does not open on tap, (B) a curated ~55-icon Lucide pool with a grouped scrollable `IconPicker`, and (C) PWA safe-areas (iOS standalone header notch overlap + bottom-nav overflow) that the previous fix `556d422` did not fully resolve.

**Architecture:** Next.js 16 App Router (`app/`), client components only for these fixes. Five screens: `app/page.tsx` (Inicio), `app/anadir/page.tsx` (Añadir), `app/historico/page.tsx` (Histórico), `app/categorias/page.tsx` (Categorías), `app/ajustes/page.tsx` (Ajustes). Global chrome in `app/layout.tsx` (`<body>`) + `components/nav/BottomNav.tsx`. The grep invariant (components never import `localStorage`/`fetch`/`supabase-js`) is unaffected — all three fixes are pure presentation. i18n via `next-intl` with `messages/es.json` + `messages/en.json` (keys must stay at parity — there is an `i18n-parity` test).

**Tech Stack:** Next 16.2.7, React 19.2.4, Tailwind, lucide-react ^1.17.0, date-fns ^4.4.0 + locales, next-intl ^4.13.0, vitest + @testing-library/react + userEvent (component), Playwright (e2e). Package manager: **pnpm** (never npm/yarn).

**Test/verify commands (used throughout):**
- `pnpm test` — vitest run (full unit + component suite; must stay green)
- `pnpm e2e` — Playwright
- `pnpm typecheck` — `tsc --noEmit`
- `pnpm lint` — eslint
- `pnpm dev` — local server for Playwright diagnosis (default `http://localhost:3000`)

**Ordering:** FIX B (icon pool) first — it is the pure quick win with zero diagnosis and no dependencies. Then FIX A (picker), then FIX C (safe-areas). Each FIX is independently shippable with its own commit. Every FIX starts with a reproduction/diagnosis task per systematic-debugging.

---

## Preliminary diagnosis of FIX A (read before starting)

Current code (`components/expense/DatePickerRow.tsx`, `TimePickerRow.tsx`, `lib/utils.ts::openNativePicker`):

- The visible `<button>` calls `openNativePicker(inputRef.current)` on click, which calls `input.showPicker()` when available, else `input.click()`.
- The native `<input type="date|time">` overlay is styled `pointer-events-none absolute inset-0 h-full w-full text-base opacity-0`, plus `tabIndex={-1}` and `aria-hidden="true"`.

**Probable root causes:**
1. **`showPicker()` requires a transient user gesture *on a path the browser trusts*.** The click handler runs inside a gesture, so that part is usually fine — but **iOS Safari does not implement `HTMLInputElement.showPicker()` at all** (no support as of 2026; verify via MDN/context7 in task A1). On iOS the code falls through to `input.click()`. Programmatic `.click()` on a date/time input does **not** reliably open the native picker on iOS Safari — iOS only opens the wheel when the user physically taps the input itself.
2. **`pointer-events-none` on the overlay input** means taps never reach the input directly — the only path to the picker is the JS `showPicker()/click()` call. That defeats the most robust pattern (let the tap land on a real, hit-testable native input).
3. **`tabIndex={-1}` + `aria-hidden`** further signal the input is non-interactive; combined with `opacity-0` this is the classic "hidden input → picker won't open on iOS" trap the spec calls out.
4. Desktop Safari has only partial `showPicker()` support historically — another reason not to depend on it.

**Recommended direction (decide after A1 diagnosis, default = Path 1):**
- **Path 1 (preferred — zero JS, works everywhere):** make the native input the actual tap target. Keep the styled button purely as the *visual* layer (`pointer-events-none`, `aria-hidden`), and lay the real `<input type=date|time>` on top at `opacity-0` with `pointer-events-auto`, full-size absolute, **no `tabIndex={-1}`, no `aria-hidden`**, with an `aria-label`. The tap lands directly on the input → the OS opens its native picker on every browser including iOS. `text-base` (≥16px) stays to avoid iOS zoom. `date-fns` formatting + i18n label render in the visual layer underneath, unchanged.
- **Path 2 (fallback if A1 shows Path 1 regresses desktop UX):** keep the button but improve `openNativePicker` to try `showPicker()` inside try/catch (catches `NotAllowedError`/`InvalidStateError`), then `focus()` + `click()` as fallback, and remove `pointer-events-none`/`tabIndex`/`aria-hidden` from the input so iOS direct-tap still works as a safety net.

The plan implements **Path 1** unless A1 diagnosis contradicts it; A2 records the decision.

---

# FIX B — Expanded icon pool (quick win, do first)

**Independent. Commit:** `feat(categories): expand icon pool to ~55 themed Lucide icons + grouped scrollable picker`

Constraints honored:
- The **11 existing keys keep their exact key string AND their current icon component** (`comida→Utensils`, `transporte→Bus`, `ocio→Sparkles`, `entretenimiento→Clapperboard`, `turismo→Plane`, `videojuegos→Gamepad2`, `mercado→ShoppingCart`, `salud→HeartPulse`, `servicios→Receipt`, `otros→CircleDot`, `mascotas→PawPrint`). Existing category data references these keys — do not rename.
- New keys are namespaced so they never collide with the 11 (theme-prefixed, e.g. `food-coffee`).
- All icon names below were verified to exist in the installed `lucide-react@1.17` (`node -e` import check passed; named imports for tree-shaking).
- Touch targets ≥44px, sticky section headers, scrollable grid, mobile-first.

### Task B1 — Rewrite `lib/domain/icons.ts` with the themed pool
- [ ] Replace the file with the content below. `ICON_KEYS` order = the 11 originals first (for back-compat + presets), then themed groups. `ICONS` maps every key. Add `ICON_GROUPS` (ordered, for the picker) — each group lists keys; group labels come from i18n (see B4), so groups carry an `id` not a label string.

```ts
import type { LucideIcon } from 'lucide-react';
import {
  // existing 11 (do not change keys or components)
  Utensils, Bus, Sparkles, Clapperboard, Plane, Gamepad2,
  ShoppingCart, HeartPulse, Receipt, CircleDot, PawPrint,
  // comida / bebida
  Coffee, Pizza, Beer, Wine, Apple, Soup, Salad, Drumstick, IceCream, CupSoda,
  // transporte
  Car, CarTaxiFront, TramFront, Train, Bike, Fuel, Plane as PlaneTravel,
  // hogar
  House, Lightbulb, Wrench, Sofa, WashingMachine,
  // compras
  ShoppingBag, Shirt, Gift, Store, Tag,
  // salud
  Pill, Stethoscope, Dumbbell, Syringe,
  // ocio
  Music, Film, Ticket, PartyPopper, Trophy,
  // finanzas
  Wallet, CreditCard, Landmark, PiggyBank, Banknote, Coins,
  // viajes
  MapPin, Luggage, Hotel, Mountain, Globe,
  // educacion
  GraduationCap, BookOpen, Pencil,
  // tech
  Laptop, Smartphone, Wifi, Monitor,
  // otros
  Star, Heart, Briefcase, MoreHorizontal,
} from 'lucide-react';

export const ICON_KEYS = [
  // ── existing 11 (back-compat — DO NOT rename) ──
  'comida', 'transporte', 'ocio', 'entretenimiento', 'turismo',
  'videojuegos', 'mercado', 'salud', 'servicios', 'otros', 'mascotas',
  // ── food/drink ──
  'food-coffee', 'food-pizza', 'food-beer', 'food-wine', 'food-apple',
  'food-soup', 'food-salad', 'food-meat', 'food-icecream', 'food-soda',
  // ── transport ──
  'trans-car', 'trans-taxi', 'trans-tram', 'trans-train', 'trans-bike', 'trans-fuel', 'trans-plane',
  // ── home ──
  'home-house', 'home-light', 'home-tools', 'home-sofa', 'home-laundry',
  // ── shopping ──
  'shop-bag', 'shop-clothes', 'shop-gift', 'shop-store', 'shop-tag',
  // ── health ──
  'health-pill', 'health-doctor', 'health-gym', 'health-shot',
  // ── leisure ──
  'fun-music', 'fun-film', 'fun-ticket', 'fun-party', 'fun-trophy',
  // ── finance ──
  'fin-wallet', 'fin-card', 'fin-bank', 'fin-piggy', 'fin-cash', 'fin-coins',
  // ── travel ──
  'travel-pin', 'travel-luggage', 'travel-hotel', 'travel-mountain', 'travel-globe',
  // ── education ──
  'edu-cap', 'edu-book', 'edu-pencil',
  // ── tech ──
  'tech-laptop', 'tech-phone', 'tech-wifi', 'tech-monitor',
  // ── other ──
  'other-star', 'other-heart', 'other-work', 'other-more',
] as const;

export type IconKey = (typeof ICON_KEYS)[number];

/** Type guard: returns true if `k` is a valid IconKey. */
export const isIconKey = (k: string): k is IconKey =>
  (ICON_KEYS as readonly string[]).includes(k);

export const ICONS: Record<string, LucideIcon> = {
  // existing 11 — unchanged components
  comida: Utensils,
  transporte: Bus,
  ocio: Sparkles,
  entretenimiento: Clapperboard,
  turismo: Plane,
  videojuegos: Gamepad2,
  mercado: ShoppingCart,
  salud: HeartPulse,
  servicios: Receipt,
  otros: CircleDot,
  mascotas: PawPrint,
  // food/drink
  'food-coffee': Coffee,
  'food-pizza': Pizza,
  'food-beer': Beer,
  'food-wine': Wine,
  'food-apple': Apple,
  'food-soup': Soup,
  'food-salad': Salad,
  'food-meat': Drumstick,
  'food-icecream': IceCream,
  'food-soda': CupSoda,
  // transport
  'trans-car': Car,
  'trans-taxi': CarTaxiFront,
  'trans-tram': TramFront,
  'trans-train': Train,
  'trans-bike': Bike,
  'trans-fuel': Fuel,
  'trans-plane': PlaneTravel,
  // home
  'home-house': House,
  'home-light': Lightbulb,
  'home-tools': Wrench,
  'home-sofa': Sofa,
  'home-laundry': WashingMachine,
  // shopping
  'shop-bag': ShoppingBag,
  'shop-clothes': Shirt,
  'shop-gift': Gift,
  'shop-store': Store,
  'shop-tag': Tag,
  // health
  'health-pill': Pill,
  'health-doctor': Stethoscope,
  'health-gym': Dumbbell,
  'health-shot': Syringe,
  // leisure
  'fun-music': Music,
  'fun-film': Film,
  'fun-ticket': Ticket,
  'fun-party': PartyPopper,
  'fun-trophy': Trophy,
  // finance
  'fin-wallet': Wallet,
  'fin-card': CreditCard,
  'fin-bank': Landmark,
  'fin-piggy': PiggyBank,
  'fin-cash': Banknote,
  'fin-coins': Coins,
  // travel
  'travel-pin': MapPin,
  'travel-luggage': Luggage,
  'travel-hotel': Hotel,
  'travel-mountain': Mountain,
  'travel-globe': Globe,
  // education
  'edu-cap': GraduationCap,
  'edu-book': BookOpen,
  'edu-pencil': Pencil,
  // tech
  'tech-laptop': Laptop,
  'tech-phone': Smartphone,
  'tech-wifi': Wifi,
  'tech-monitor': Monitor,
  // other
  'other-star': Star,
  'other-heart': Heart,
  'other-work': Briefcase,
  'other-more': MoreHorizontal,
};

/** Ordered theme groups for the picker. `id` resolves to an i18n label. */
export interface IconGroup {
  id: string;
  keys: IconKey[];
}

export const ICON_GROUPS: IconGroup[] = [
  { id: 'food', keys: ['comida', 'food-coffee', 'food-pizza', 'food-beer', 'food-wine', 'food-apple', 'food-soup', 'food-salad', 'food-meat', 'food-icecream', 'food-soda'] },
  { id: 'transport', keys: ['transporte', 'trans-car', 'trans-taxi', 'trans-tram', 'trans-train', 'trans-bike', 'trans-fuel', 'trans-plane'] },
  { id: 'home', keys: ['servicios', 'home-house', 'home-light', 'home-tools', 'home-sofa', 'home-laundry'] },
  { id: 'shopping', keys: ['mercado', 'shop-bag', 'shop-clothes', 'shop-gift', 'shop-store', 'shop-tag'] },
  { id: 'health', keys: ['salud', 'health-pill', 'health-doctor', 'health-gym', 'health-shot'] },
  { id: 'leisure', keys: ['ocio', 'entretenimiento', 'videojuegos', 'fun-music', 'fun-film', 'fun-ticket', 'fun-party', 'fun-trophy'] },
  { id: 'finance', keys: ['fin-wallet', 'fin-card', 'fin-bank', 'fin-piggy', 'fin-cash', 'fin-coins'] },
  { id: 'travel', keys: ['turismo', 'travel-pin', 'travel-luggage', 'travel-hotel', 'travel-mountain', 'travel-globe'] },
  { id: 'pets', keys: ['mascotas'] },
  { id: 'education', keys: ['edu-cap', 'edu-book', 'edu-pencil'] },
  { id: 'tech', keys: ['tech-laptop', 'tech-phone', 'tech-wifi', 'tech-monitor'] },
  { id: 'other', keys: ['otros', 'other-star', 'other-heart', 'other-work', 'other-more'] },
];
```

- [ ] Sanity check: every key in `ICON_GROUPS` appears in `ICON_KEYS` and vice-versa (B3 test enforces this).
- [ ] `pnpm typecheck` → expect no errors (the `as const` keys must all be valid `IconKey`s referenced in groups).

### Task B2 — Grouped, scrollable `IconPicker`
- [ ] Rewrite `components/category/IconPicker.tsx` to iterate `ICON_GROUPS`. For each group: a **sticky** section header (`sticky top-0 z-10 bg-surface`) showing the i18n group label, then a grid of buttons. Container is scrollable with a max height (e.g. `max-h-[40vh] overflow-y-auto overscroll-contain`). Keep button styling/selected state from the current implementation; ensure touch targets ≥44px (current is `size-10 min-h-[40px]` → bump to `min-h-[44px] min-w-[44px]`, e.g. `size-11`).
- [ ] Keep the `value`/`onChange`/`className` prop contract unchanged (callers in `NewCategorySheet`/category edit pass it through). Selected button keeps `aria-pressed` + ring.
- [ ] Group label via `t(\`iconGroup.${group.id}\`)` from the `Categorias` namespace.

Reference shape:
```tsx
'use client'
import * as React from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { ICONS, ICON_GROUPS } from '@/lib/domain/icons'

export interface IconPickerProps {
  value: string
  onChange: (key: string) => void
  className?: string
}

export function IconPicker({ value, onChange, className }: IconPickerProps) {
  const t = useTranslations('Categorias')
  return (
    <div
      className={cn('max-h-[40vh] overflow-y-auto overscroll-contain', className)}
      role="group"
      aria-label={t('selectIcon')}
    >
      {ICON_GROUPS.map((group) => (
        <section key={group.id}>
          <h3 className="sticky top-0 z-10 bg-surface px-1 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-txt">
            {t(`iconGroup.${group.id}`)}
          </h3>
          <div className="flex flex-wrap gap-2 pb-2">
            {group.keys.map((key) => {
              const IconComponent = ICONS[key]
              const isSelected = key === value
              return (
                <button
                  key={key}
                  type="button"
                  aria-label={key}
                  aria-pressed={isSelected}
                  onClick={() => onChange(key)}
                  className={cn(
                    'flex size-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-[10px] transition-all duration-150',
                    'bg-surface-2 text-text',
                    isSelected
                      ? 'ring-2 ring-condor-primary bg-surface-3 text-condor-primary'
                      : 'ring-0 hover:bg-surface-3',
                  )}
                >
                  <IconComponent size={20} strokeWidth={2} />
                </button>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
```

### Task B3 — Tests (TDD: write first, then make green)
- [ ] Add `tests/unit/domain/icons.test.ts`:
  - every key in `ICON_KEYS` resolves to a defined component in `ICONS` (`expect(typeof ICONS[k]).not.toBe('undefined')`).
  - the 11 original keys still map to their original components (assert `ICONS['comida'] === Utensils`, etc. — import the components to compare).
  - `ICON_GROUPS` keys are a permutation of `ICON_KEYS` (no missing, no extra, no duplicates across groups).
  - `ICON_KEYS.length` is in the 50–60 range (assert `>= 50 && <= 60`).
- [ ] Extend `tests/component/category-kit.test.tsx` (or new `icon-picker.test.tsx`): render `IconPicker`, assert a button for at least one original key (`comida`) and one new key (`food-coffee`) exists, that clicking calls `onChange` with the key, and that group headers render (provide `iconGroup.*` messages in the test's intl `messages`).
- [ ] `pnpm test` → all green. `pnpm test tests/unit/domain/icons.test.ts` shows the resolve-all-keys test passing.

### Task B4 — i18n group labels + parity
- [ ] Add to `messages/es.json` under `Categorias` an `iconGroup` object: `{ food: 'Comida y bebida', transport: 'Transporte', home: 'Hogar', shopping: 'Compras', health: 'Salud', leisure: 'Ocio', finance: 'Finanzas', travel: 'Viajes', pets: 'Mascotas', education: 'Educación', tech: 'Tecnología', other: 'Otros' }`.
- [ ] Add the same keys to `messages/en.json` under `Categorias.iconGroup`: `{ food: 'Food & drink', transport: 'Transport', home: 'Home', shopping: 'Shopping', health: 'Health', leisure: 'Leisure', finance: 'Finance', travel: 'Travel', pets: 'Pets', education: 'Education', tech: 'Tech', other: 'Other' }`.
- [ ] `pnpm test tests/unit/i18n-parity.test.ts` → green (keys at parity).

### Task B5 — Verify + commit FIX B
- [ ] `pnpm typecheck && pnpm lint && pnpm test` → all green.
- [ ] Manual: `pnpm dev`, open Categorías → Nueva categoría, confirm the icon picker scrolls, headers are sticky, ~55 icons grouped, existing presets still show their icon.
- [ ] Commit: `feat(categories): expand icon pool to ~55 themed Lucide icons + grouped scrollable picker`.

---

# FIX A — Native date/time picker does not open

**Independent. Commit:** `fix(anadir): native date/time picker opens reliably on iOS/desktop`

### Task A1 — Reproduce + diagnose (systematic-debugging, BEFORE any fix)
- [ ] `pnpm dev`. With Playwright, navigate to `http://localhost:3000/anadir`.
- [ ] **Mobile viewport:** resize to iPhone (e.g. 390×844). Snapshot the date row; click it; capture whether a native picker/overlay appears (`browser_take_screenshot` before/after, save to `docs/superpowers/diagnostics/f9-picker-mobile-before.png`). Inspect via `browser_evaluate`: does the overlay input have `pointer-events:none`? Is `showPicker` a function in this engine?
- [ ] **Desktop viewport:** repeat at 1280×800; screenshot `...-picker-desktop-before.png`.
- [ ] Confirm current support facts via context7 (`/mdn/content` → `HTMLInputElement.showPicker`): record iOS Safari support status and desktop Safari status in a short note at top of the commit/PR. Expected finding: iOS Safari has no `showPicker`; the `.click()` fallback does not open the wheel; `pointer-events-none` on the overlay blocks direct taps. Note in `docs/superpowers/diagnostics/f9-picker-findings.md`.
- [ ] **Decision (A2):** record Path 1 vs Path 2. Default Path 1 unless diagnosis shows it breaks a desktop interaction.

### Task A2 — Write failing component tests first (TDD)
- [ ] Add `tests/component/picker-rows.test.tsx`:
  - Render `DatePickerRow` with a fixed `value`/`locale`; assert the native input (`input[type=date]`) is present, is **not** `aria-hidden`, has `pointer-events` enabled (no `pointer-events-none` class), and has a non-negative or absent `tabIndex`.
  - Fire `change` on the input with a new date → `onChange` called with the new `yyyy-MM-dd`.
  - Assert the formatted label still renders via date-fns/i18n (provide `Anadir` messages incl. `todayPrefix`, `dateTapToChange`).
  - Same for `TimePickerRow` (`input[type=time]`, `HH:mm`, `timeTapToChange`).
- [ ] These fail against current code (input is `aria-hidden`, `pointer-events-none`). Confirm red: `pnpm test tests/component/picker-rows.test.tsx`.

### Task A3 — Implement Path 1 (input is the tap target)
- [ ] `DatePickerRow.tsx`: restructure so the real `<input type="date">` is the interactive top layer:
  - Wrapper stays `relative`.
  - The visual button content (icon + formatted label + chevron) becomes a **non-interactive presentational layer**: render it as a `<div aria-hidden="true" className="pointer-events-none ...">` keeping the exact current styling classes (surface/border/radius/min-h-[52px]/text). Remove the `<button>`/`onClick`/`handleRowClick`.
  - The `<input>` overlays it: `absolute inset-0 h-full w-full cursor-pointer opacity-0 text-base` with `pointer-events-auto` (i.e. NOT `pointer-events-none`), **remove `tabIndex={-1}` and `aria-hidden`**, add `aria-label={t('dateTapToChange', { label })}`. Keep `value`, `onChange={handleDateChange}`. `text-base` (≥16px) stays to prevent iOS zoom.
  - Drop the now-unused `openNativePicker` import.
- [ ] `TimePickerRow.tsx`: mirror the same restructure (`type="time"`, `timeTapToChange` label, `font-money` on the visual value).
- [ ] If A1 chose **Path 2** instead: keep the button, harden `lib/utils.ts::openNativePicker` (try `showPicker()` in try/catch for `NotAllowedError`/`InvalidStateError`, fallback `focus()` then `click()`), and still remove `pointer-events-none`/`tabIndex`/`aria-hidden` from the input so iOS direct-tap works. Document which path in the commit body.
- [ ] `lib/utils.ts`: if Path 1 and `openNativePicker` is no longer referenced anywhere (`grep -rn openNativePicker`), remove it; otherwise leave/keep hardened.

### Task A4 — Make tests green + e2e
- [ ] `pnpm test tests/component/picker-rows.test.tsx` → green.
- [ ] Add/extend e2e in `tests/e2e/core-flow.spec.ts` (or new `picker.spec.ts`) at mobile viewport: go to `/anadir`, locate the date input by role/label, `fill` it with a date, assert the visible label updates; same for time. (Playwright can set value on native inputs without opening the OS chrome — assert the binding + that the input is hittable/visible, i.e. `toBeVisible` is false by design due opacity, so assert `toBeEnabled` and that a `fill` propagates to the label.)
- [ ] `pnpm e2e` (picker spec) → green.

### Task A5 — Visual verification + commit FIX A
- [ ] Playwright re-capture mobile + desktop AFTER: `docs/superpowers/diagnostics/f9-picker-{mobile,desktop}-after.png`. On a real engine the tap now opens the native picker; in headless, confirm the input is the hit target (no `pointer-events:none`, not `aria-hidden`).
- [ ] `pnpm typecheck && pnpm lint && pnpm test` → green.
- [ ] Commit: `fix(anadir): native date/time picker opens reliably on iOS/desktop`.

---

# FIX C — PWA safe-areas (header notch overlap + bottom nav)

**Independent. Commit:** `fix(mobile): consistent iOS safe-area insets across all 5 screens`

Context — why `556d422` was insufficient: it added `pt-[env(safe-area-inset-top)]` on `<body>` AND per-page headers still use their own top padding (`pt-5`/`pt-4`). On iOS standalone the body inset pushes content down, but per-page sticky/fixed headers and the larger device notch can still overlap or double-pad. Also `BottomNav` already has `pb-[env(safe-area-inset-bottom)]` — verify it is not double-counted against per-page `pb-[calc(env(safe-area-inset-bottom)+...)]` (it is additive on purpose: page padding clears the nav, nav padding clears the home indicator — confirm in C1).

### Task C1 — Reproduce + diagnose with simulated safe-area
- [ ] `pnpm dev`. Playwright at iPhone viewport (390×844). Since headless Chromium reports `env(safe-area-inset-*) = 0`, **simulate** insets by injecting a style override before snapshot: `browser_evaluate` to add `<style>:root{--sat:47px;--sab:34px} body{padding-top:env(safe-area-inset-top,47px)}` OR (cleaner) inject a `<meta>`-independent test by setting CSS custom props and temporarily mapping `env()` fallbacks. Practical approach: inject a global style that sets a visible top band (`#0E131F` 47px) and bottom band (34px) to emulate the notch + home indicator, then screenshot each screen to see overlap.
- [ ] Capture BEFORE screenshots for all 5 screens to `docs/superpowers/diagnostics/f9-safearea-<screen>-before.png`: `/`, `/anadir`, `/historico`, `/categorias`, `/ajustes`.
- [ ] Inspect computed padding: `browser_evaluate` reading `getComputedStyle(document.body).paddingTop` and each page header's `paddingTop`; check whether body inset + header `pt` visually stack too far OR whether a fixed/sticky header ignores the inset. Record findings in `docs/superpowers/diagnostics/f9-safearea-findings.md`.
- [ ] Note: confirm whether any header is `position: sticky`/`fixed` (it currently is not — headers scroll with content; the only fixed chrome is `BottomNav`). This determines whether the fix belongs on `<body>` (current, correct for non-fixed headers) or must move to each header.

### Task C2 — Fix: single source of truth for the top inset
- [ ] Based on C1, standardize: keep the top inset on **`<body>` only** (`app/layout.tsx`, already `pt-[env(safe-area-inset-top)]`) and ensure no per-page header adds a *second* safe-area inset (they should use plain `pt-4`/`pt-5` design padding, which they do — confirm none use `env(safe-area-inset-top)`). If C1 shows the header visually crowds the notch, increase the body comment-documented inset is fine; do NOT add a second `env()` on headers (that is the double-padding trap).
- [ ] If C1 instead reveals a header that should be fixed/pinned to the top (none today), that header must carry `pt-[env(safe-area-inset-top)]` AND `<body>` must drop it — never both. Document the chosen single owner in `app/layout.tsx` comment.
- [ ] Bottom: confirm `BottomNav` keeps `pb-[env(safe-area-inset-bottom)]` (clears home indicator) and each page keeps `pb-[calc(env(safe-area-inset-bottom)+5.5rem)]` (clears the nav rail; `anadir` uses `+2rem` since it has no nav — verify `anadir` does not render `BottomNav`; if it does, bump to `+5.5rem`). Adjust the `5.5rem`/`2rem` clearance only if C1 screenshots show content hidden behind the nav.

### Task C3 — Verify across all 5 screens + commit
- [ ] Re-run the C1 simulated-inset Playwright pass; capture AFTER screenshots for all 5 screens (`...-<screen>-after.png`). Assert: header content sits fully below the simulated notch band; last list item / save button clears the simulated home-indicator band; `BottomNav` sits above the home indicator.
- [ ] `browser_evaluate` assertion: body `paddingTop` equals the simulated top inset; no header has a computed `paddingTop` larger than its design value + inset (no doubling).
- [ ] `pnpm test` (full suite, incl. existing `theme`/`smoke`/component) → green; no regression to existing layout tests.
- [ ] `pnpm e2e tests/e2e/a11y.spec.ts` → green (touch targets/contrast unaffected).
- [ ] Commit: `fix(mobile): consistent iOS safe-area insets across all 5 screens`.

---

# (g) i18n + final verification

### Task G1 — i18n audit for new strings
- [ ] Only FIX B introduces new strings (`Categorias.iconGroup.*`). FIX A reuses existing `Anadir` keys; FIX C adds none. Confirm `pnpm test tests/unit/i18n-parity.test.ts` and `tests/component/i18n-messages.test.tsx` pass.

### Task G2 — Full green gate
- [ ] `pnpm typecheck` → 0 errors.
- [ ] `pnpm lint` → clean.
- [ ] `pnpm test` → entire vitest suite green (existing ~3.4k-line suite must remain green).
- [ ] `pnpm e2e` → green.
- [ ] Grep invariant intact: `grep -rn "from 'localStorage'\|supabase-js\|\\bfetch(" components/` shows no new violations introduced by these components.
- [ ] Before/after screenshots present under `docs/superpowers/diagnostics/` for picker (A) and safe-areas (C).

### Task G3 — Finish branch
- [ ] Use superpowers:finishing-a-development-branch. Three commits land (B, A, C order is fine). Do NOT auto-merge; present PR/merge options.

---

## Assumptions
- `messages/es.json` + `messages/en.json` are the only locale files and `i18n-parity` enforces key parity (verified). New `iconGroup.*` keys go under the existing `Categorias` namespace used by `IconPicker`.
- The 11 existing icon keys are persisted in user/category data (presets in `lib/domain/presets.ts` reference them) and must keep both key string and component — new keys are theme-prefixed to avoid collision.
- Headless Playwright/Chromium reports `env(safe-area-inset-*)` as 0, so FIX C diagnosis must simulate insets via injected CSS (true device verification by Samu on iPhone is the final acceptance for C).
- iOS Safari has no `HTMLInputElement.showPicker()` (to be reconfirmed via context7/MDN in A1); Path 1 (input as tap target) is therefore the default and is the only approach that needs zero JS and works on iOS — A1 may override only with evidence.
- `IconPicker`'s public props (`value`/`onChange`/`className`) and callers (`NewCategorySheet`, category edit) stay unchanged — the grouping/scroll is internal.
- `pnpm` is the package manager for every command (no npm/yarn), per global prefs.
- `app/anadir/page.tsx` has no `BottomNav`, hence its `+2rem` bottom clearance vs `+5.5rem` elsewhere — C2 verifies this rather than assuming.
