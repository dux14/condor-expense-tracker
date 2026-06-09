# Pendientes inter-sesión — Cóndor (Mark-VI-Mny)

> Registro acumulativo de trabajo pendiente que se difiere entre sesiones.
> Revisar al cerrar cada fase o al retomar trabajo. Solo contiene lo que FALTA.

---

## Estado de ramas (actualizado 2026-06-08, sesión cierre F6)

**Se mergeó TODO a `main` y se pushea directo a main** (decisión del usuario en la sesión F3).
- `main` está **26 commits adelante de `origin/main`** (F4 sync + F4-wiring + F5 server-fx + **F6 PDF import**, todo **mergeado localmente, NO pusheado**).
- `feat/f6-pdf-import` — **CERRADA**: merge `--no-ff` a main (`5a50f4f`), rama borrada.
- `stash@{0}` ("F1 pending…") sigue intacto pero es **100% redundante** (ver F1). Recomendado: `git stash drop stash@{0}`.

---

## F6 — PDF Import (cliente, sin LLM) — ✅ CERRADO

Mergeado a main vía `--no-ff` (`5a50f4f`), rama borrada. Gate final verde:
typecheck · lint 0 err · **469 unit** · build OK con `unpdf` lazy en 3 chunks async (confirmado).
- Task 11 (e2e `import.spec.ts`): **commiteado** (`f51a893`). NO corrido localmente — este entorno no pudo instalar el binario `headless_shell` de Playwright (ver sección Entorno). Cobertura vinculante = component test de ReviewTable (T9). Corre en CI.
- Task 12 (gate): verde.

### Follow-ups NO bloqueantes (endurecer luego, no eran de F6)
- `generic.ts`: regex MONEY da falso positivo con enteros sin decimales; fallback de descripción cuando no hay texto entre fecha y monto. (Mitigado por formato bancario colombiano.)
- `rules-engine`: `includes` con patrones muy cortos → match espurio; hyphens líderes/trailing no se quitan.
- `ReviewRow`: buffers `useState` con `key={index}` pueden quedar stale si el padre reordena (hoy `ImportFlow` muta in-place, seguro).
- F5 (heredados): Cache-Control `public` en `/api/fx` autenticado; sin coalescing en 429; clientes Supabase recreados por request; sin validación de env vars en startup.
- F4 (heredados): LWW de Category/Settings/CategoryRule es device-local; `category_rules` int test diferido a F10.

---

## F2 — App-lock (en main) — e2e spec commiteado, corrida pendiente

- `tests/e2e/app-lock.spec.ts` — **commiteado** en main (`a0beb30`). Typecheck verde (`isUserVerified` ya correcto). I1 (PIN) + I2 (biométrico CDP virtual-authenticator).
- ⏳ **BLOQUEADO este entorno:** correr `pnpm e2e` (suite completa, no-regresión) — falta el binario `headless_shell` de Playwright (no se pudo instalar en el sandbox; ver Entorno).
- ⏳ **Requiere hardware:** check manual PWA en iPhone real (Face ID cold open / tras background; touch targets ≥44px; safe-areas).

---

## F1 — Auth (en main) — ✅ OBSOLETO (sin acción)

Investigado esta sesión:
- **`tests/e2e/auth.spec.ts` NO existe** en ninguna parte (ni en main, ni untracked, ni en el stash). La premisa anterior estaba desactualizada.
- El `stash@{0}` NO contiene auth.spec.ts. Su contenido real (plumbing `e2e-auth` de `middleware-session.ts` + wiring `stubSession` en a11y/core-flow/visual-upgrade specs) **ya está 100% en main** — diffs por-archivo vacíos. El stash es redundante.
- **Recomendado:** `git stash drop stash@{0}` (no lo dropeé yo porque el contenido contradecía la descripción del pendiente; decisión del usuario).

---

## Setup / entorno — pendiente

- **gh-wrapper / login personal:** `/Users/samu/code/personal/.gh` VACÍO → `git push` cae a la cuenta equivocada. Arreglar de raíz (interactivo, requiere al usuario): `GH_CONFIG_DIR=/Users/samu/code/personal/.gh gh auth login` con la cuenta dux14. **Esto bloquea el push de los 26 commits locales de main a origin.**
- **Playwright `headless_shell` no instalable en el sandbox (2026-06-08):** `pnpm exec playwright install chromium-headless-shell` descarga el zip (77.5 MiB, llega a 100%) pero la extracción no popula `~/Library/Caches/ms-playwright/chromium_headless_shell-1148/chrome-mac/`. Múltiples intentos paralelos dejaron locks `__dirlock` stale. El `chromium` headed (1148) sí está. Sin headless_shell, ningún e2e corre localmente. Retomar fuera del sandbox / en CI.
