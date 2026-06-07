# F6 — PDF Import (client-side, sin LLM) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Cóndor user opens **Ajustes → Importar extracto**, picks a bank-statement **PDF on their device**, the file is parsed **100% in the browser** (the bytes never leave the device — no upload, no Supabase Storage, no `/api/import`, no LLM), reviews/edits an auto-categorized table of transactions, and bulk-inserts the selected rows as expenses with `source: 'import'`. Categorization comes from a deterministic **merchant→category rules engine** seeded from the user's `category_rules`; corrections made in the review table **persist as new rules** (the engine learns). Per-institution extraction **templates** turn raw PDF text into `RawTransaction[]`, with a **generic fallback** template so an unknown bank still imports something. Adding a bank later = one template + one fixture + one test, nothing else.

**Architecture:** Phase-1 invariant preserved — components never import `unpdf`/`fetch`/`localStorage`/`supabase-js` directly; the page calls a lazy-loaded parsing facade and the existing store. Pipeline: `file → pdf-text.extractStatementText(file)` (magic-byte + size + page caps, **lazy `import('unpdf')`** so PDF.js never weighs on the core bundle — D9) `→ templates.parseStatement(text)` (registry: pick first template whose `detect()` matches, else the generic fallback) `→ RawTransaction[] → rules-engine.categorize(raw, rules)` (normalize merchant, substring/prefix match against `category_rules`) `→ review table (editable, reuse CategoryChip) → on import: for each selected row store.addImportedExpense({...source:'import'})` (FX runs in the store exactly like manual add) `→ on category correction: repo.upsertCategoryRule(normalized merchant → category)`. `category_rules` already exists as a table (F3, `supabase/migrations/0001_core.sql`) with RLS; F6 adds the **Repository methods** `listCategoryRules` / `upsertCategoryRule` to all three repos (Local, Supabase, and the F4 Syncing decorator). The `Expense.source` union is widened from `'manual'` to `'manual' | 'import'` (type + Zod + the existing F3 SQL already allows it). This is F6 of the revised Phase-2 design (depends on F3 for the table + Supabase repo; coexists with F4's syncing repo). Order in the spec: …F9 → **F6** → F7…

**Tech Stack:** `unpdf` (bundled serverless PDF.js build — runs in the browser with no Node-only deps; `getDocumentProxy(Uint8Array)` + `extractText`, verified via context7 `/unjs/unpdf`) lazy-loaded via dynamic `import()` · Next.js 16 App Router (`'use client'` page, `next/dynamic` boundary) · Zustand store (existing) · Zod (existing) · `next-intl` (es/en) · `lucide-react` · existing `CategoryChip` / `CategoryBadge` · Vitest + Testing Library (existing patterns in `tests/`) · Playwright (existing `tests/e2e/`). pnpm throughout.

> **Credentials / external services:** None. F6 adds **zero** server endpoints, zero env vars, zero network calls. Everything is on-device. (FX during bulk insert reuses the existing store FX path; no new FX work here.)

---

## Conventions

- Tests-first (TDD): RED → GREEN → commit, per task. Run the **entire existing suite** (`pnpm test`) after structural changes — the Phase-1 + F0–F5 suite must stay green throughout.
- Every commit message is given verbatim. Commit after each task that ends green. Do **not** `git commit` until a task says so, and never push.
- Pure logic first (rules-engine, templates) — fast unit tests, no DOM, no PDF binaries. PDF extraction is tested against the *parser*, not unpdf, by feeding pre-extracted `.txt` fixtures (deterministic).
- New i18n keys go in **both** `messages/es.json` and `messages/en.json` under a new `Importar` namespace, plus one `Nav`/`Ajustes` entry for the entry point.
- All column names for `category_rules` live only in `lib/data/supabase-mappers.ts` (extend the F3 file).

---

## Task 1 — Quick win: widen `Expense.source` to `'manual' | 'import'` (type + Zod)

**Files:** `lib/domain/types.ts`, `lib/domain/schemas.ts`, `tests/unit/domain/schemas.test.ts` (existing or new)

The DB column already allows `'import'` (F3 `0001_core.sql:77` `source text not null default 'manual'`), so **no new migration** is needed. Only the TS type + Zod literal must widen. The store's `addExpense` hardcodes `source: 'manual'`; that stays for manual adds — imports use a new action (Task 6).

- [ ] **RED** — in `tests/unit/domain/schemas.test.ts` add:
  - `parseExpense({...valid, source: 'import'})` returns an expense with `source: 'import'` (does not throw).
  - `parseExpense({...valid, source: 'bogus'})` throws (ZodError).
  - Run: `pnpm test schemas` (expect the `'import'` case to fail — current literal is `'manual'` only).
- [ ] **GREEN** — edit `lib/domain/types.ts:19`:
  ```ts
  source: 'manual' | 'import'; // 'import' = parsed from a bank-statement PDF (F6)
  ```
  and edit `lib/domain/schemas.ts:38`:
  ```ts
  source: z.enum(['manual', 'import']),
  ```
- [ ] Run: `pnpm test schemas` (green), then `pnpm typecheck` (expect no errors; the store's `source: 'manual'` literal still satisfies the wider union).
- [ ] Commit: `feat(domain): widen Expense.source to 'manual' | 'import' (F6)`

---

## Task 2 — Quick win: `CategoryRule` type + Zod + repository interface

**Files:** `lib/domain/types.ts`, `lib/domain/schemas.ts`, `lib/data/repository.ts`, `tests/unit/domain/schemas.test.ts`

Define the domain object that mirrors the F3 `category_rules` table (client-visible columns only — `user_id` / `created_at` / `updated_at` stay DB-side per F3 convention).

- [ ] **RED** — in `tests/unit/domain/schemas.test.ts` add a `categoryRuleSchema` block:
  - parses `{ id, pattern: 'UBER', categoryId: 'preset-transporte' }` ok.
  - rejects empty `pattern` (`''`) and missing `categoryId`.
  - Run: `pnpm test schemas` (expect fail — schema not exported).
- [ ] **GREEN** — add to `lib/domain/types.ts`:
  ```ts
  export interface CategoryRule {
    id: string;            // crypto.randomUUID()
    pattern: string;       // normalized merchant key (uppercase, no accents, single spaces)
    categoryId: string;    // target category id
  }
  ```
  add to `lib/domain/schemas.ts`:
  ```ts
  export const categoryRuleSchema = z.object({
    id: z.string(),
    pattern: z.string().min(1),
    categoryId: z.string().min(1),
  });

  export function parseCategoryRule(input: unknown): import('./types').CategoryRule {
    return categoryRuleSchema.parse(input);
  }
  ```
- [ ] Extend the `Repository` interface (`lib/data/repository.ts`) with two methods (and the type import):
  ```ts
  import type { Expense, Category, Settings, ExportBundle, CategoryRule } from '@/lib/domain/types';
  // …inside interface Repository:
  listCategoryRules(): Promise<CategoryRule[]>;
  upsertCategoryRule(r: CategoryRule): Promise<CategoryRule>;
  ```
- [ ] `pnpm typecheck` (expect **errors**: `LocalStorageRepository` / `SupabaseRepository` / `SyncingRepository` no longer satisfy `Repository`). That is intended — Tasks 4–5 implement them. Do not fix by `// @ts-ignore`.
- [ ] Run: `pnpm test schemas` (green).
- [ ] Commit: `feat(domain): CategoryRule type + zod + Repository.list/upsertCategoryRule (F6)`

---

## Task 3 — TDD: rules-engine (pure) — normalization, matching, learning

**Files:** `lib/import/rules-engine.ts`, `tests/unit/import/rules-engine.test.ts`

Pure functions, no I/O — the highest-leverage quick win. This is the categorization brain. The "learning" step is a pure rule-builder; persistence is wired in Task 6.

- [ ] **RED** — `tests/unit/import/rules-engine.test.ts`:
  - `normalizeMerchant('  Café   Tpostres  S.A.S ')` → `'CAFE TOSTRES SAS'`? No — keep it simple and deterministic: assert `normalizeMerchant('  Café   Súper-Éxito  ')` → `'CAFE SUPER-EXITO'` (uppercase, strip diacritics via NFD, collapse runs of whitespace to one space, trim; punctuation other than internal `-`/`&` is removed; verify `'UBER* TRIP 0612'` → `'UBER TRIP 0612'`).
  - `matchRule('UBER TRIP 0612', rules)` where `rules = [{id:'r1', pattern:'UBER', categoryId:'preset-transporte'}]` → returns `'preset-transporte'` (substring/prefix match on the **normalized** merchant; the rule pattern is assumed already normalized).
  - Longest-pattern-wins: with rules `UBER` → transporte and `UBER EATS` → comida, `matchRule('UBER EATS 99', rules)` → `'preset-comida'` (most specific pattern wins).
  - No match → `matchRule('UNKNOWN SHOP', [])` → `null`.
  - `buildRule('  Súper Éxito  ', 'preset-mercado')` → `{ id: <uuid>, pattern: 'SUPER EXITO', categoryId: 'preset-mercado' }` (pattern is normalized; id from `newId()`).
  - `categorize(raws, rules, fallbackCategoryId)` maps each `RawTransaction` to a suggested `categoryId` = `matchRule(normalized desc, rules) ?? fallbackCategoryId`. Assert two raws categorize correctly and the unmatched one gets the fallback.
  - Run: `pnpm test rules-engine` (expect fail — module missing).
- [ ] **GREEN** — `lib/import/rules-engine.ts`:
  ```ts
  import { newId } from '@/lib/domain/ids';
  import type { CategoryRule } from '@/lib/domain/types';
  import type { RawTransaction } from './templates/types';

  /** Uppercase, strip accents (NFD), drop punctuation except internal - and &, collapse spaces. */
  export function normalizeMerchant(raw: string): string {
    return raw
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')   // strip diacritics
      .toUpperCase()
      .replace(/[^A-Z0-9\s&-]/g, ' ')    // keep alnum, space, & and -
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Find the best rule for a merchant string.
   * Match = the normalized merchant starts with, or contains, the rule's (already
   * normalized) pattern. The most specific (longest) matching pattern wins.
   */
  export function matchRule(merchant: string, rules: CategoryRule[]): string | null {
    const m = normalizeMerchant(merchant);
    let best: CategoryRule | null = null;
    for (const r of rules) {
      if (!r.pattern) continue;
      if (m === r.pattern || m.startsWith(r.pattern) || m.includes(r.pattern)) {
        if (best === null || r.pattern.length > best.pattern.length) best = r;
      }
    }
    return best ? best.categoryId : null;
  }

  /** Build a learnable rule from a raw merchant + the category the user chose. */
  export function buildRule(merchant: string, categoryId: string): CategoryRule {
    return { id: newId(), pattern: normalizeMerchant(merchant), categoryId };
  }

  export interface CategorizedTransaction extends RawTransaction {
    categoryId: string;          // suggested
    matched: boolean;            // true if a rule produced it (not the fallback)
  }

  /** Suggest a category for every raw transaction. */
  export function categorize(
    raws: RawTransaction[],
    rules: CategoryRule[],
    fallbackCategoryId: string,
  ): CategorizedTransaction[] {
    return raws.map((r) => {
      const hit = matchRule(r.description, rules);
      return { ...r, categoryId: hit ?? fallbackCategoryId, matched: hit !== null };
    });
  }
  ```
  > `RawTransaction` is defined in Task 4 (`templates/types.ts`). Implement Task 4's `types.ts` first if the import fails to resolve, or stub the type inline temporarily — but prefer doing Task 4's tiny `types.ts` now (it is type-only).
- [ ] Run: `pnpm test rules-engine` (green).
- [ ] Commit: `feat(import): rules-engine (normalize, match, learn) — pure (F6)`

---

## Task 4 — TDD: template registry + generic fallback + first bank fixture

**Files:** `lib/import/templates/types.ts`, `lib/import/templates/generic.ts`, `lib/import/templates/index.ts`, `tests/fixtures/statements/generic-sample.txt`, `tests/unit/import/templates.test.ts`

Templates turn **already-extracted plain text** (string[] of pages or one string) into `RawTransaction[]`. Fixtures are **extracted text**, not PDFs, so tests are deterministic and no binary lives in the repo. Adding a bank later = drop a `templates/<bank>.ts`, a `tests/fixtures/statements/<bank>.txt`, and a test case — no other file changes.

- [ ] Create `lib/import/templates/types.ts`:
  ```ts
  export interface RawTransaction {
    date: string;        // 'yyyy-MM-dd'
    description: string; // raw merchant / description line
    amount: number;      // positive magnitude in `currency`
    currency: string;    // ISO 4217 (template's best guess; user can edit)
  }

  export interface StatementTemplate {
    id: string;                       // 'generic' | 'bancolombia' | …
    institution: string;             // human label, e.g. 'Genérico', 'Bancolombia'
    detect(text: string): boolean;   // true if this template recognizes the statement
    parse(text: string): RawTransaction[];
  }
  ```
- [ ] Create the fixture `tests/fixtures/statements/generic-sample.txt` (hand-written, realistic — lines with a date + merchant + amount, plus noise lines that must be ignored):
  ```
  ESTADO DE CUENTA
  Periodo: 2026-05-01 a 2026-05-31
  Saldo anterior 0,00
  2026-05-03   UBER TRIP 0612 BOGOTA            18.500,00
  2026-05-04   EXITO SUPER CALLE 80             132.400,50
  05/05/2026   NETFLIX.COM                       38.900,00
  2026-05-09   PAGO RECIBIDO -GRACIAS           -50.000,00
  Total cargos 189.800,50
  ```
- [ ] **RED** — `tests/unit/import/templates.test.ts`:
  - Load the fixture text via `readFileSync` (node fs in the vitest jsdom env is available through `node:fs`).
  - `genericTemplate.detect(text)` → `true` (it always detects — it is the fallback).
  - `genericTemplate.parse(text)` → 3 transactions (the two ISO-date lines + the `dd/mm/yyyy` Netflix line), **excluding** header/total/"Saldo anterior" lines and the **negative** "PAGO RECIBIDO" credit (imports are expenses → positive charges only).
  - Assert the first row equals `{ date: '2026-05-03', description: 'UBER TRIP 0612 BOGOTA', amount: 18500, currency: 'COP' }` (amount parsed from Colombian `18.500,00` → `18500`; currency defaults to `'COP'`).
  - Assert the `05/05/2026` line is normalized to `date: '2026-05-05'`.
  - `pickTemplate(text)` (from `index.ts`) returns the `generic` template when nothing more specific matches.
  - Run: `pnpm test templates` (expect fail — modules missing).
- [ ] **GREEN** — `lib/import/templates/generic.ts`:
  ```ts
  import type { RawTransaction, StatementTemplate } from './types';

  // Matches a leading date in either yyyy-mm-dd or dd/mm/yyyy form.
  const DATE_ISO = /^(\d{4})-(\d{2})-(\d{2})/;
  const DATE_DMY = /^(\d{2})\/(\d{2})\/(\d{4})/;
  // Trailing money token: Colombian/European grouping (1.234,56) or plain (1234.56),
  // optional leading minus.
  const MONEY = /(-?\d{1,3}(?:[.\s]\d{3})*(?:,\d{2})?|-?\d+(?:\.\d{2})?)\s*$/;

  function toIso(line: string): string | null {
    let m = DATE_ISO.exec(line);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = DATE_DMY.exec(line);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    return null;
  }

  /** Parse a Colombian/European-grouped amount string to a Number. */
  export function parseAmount(token: string): number {
    let s = token.trim();
    const neg = s.startsWith('-');
    s = s.replace(/[^\d.,]/g, '');
    if (s.includes(',')) {
      // comma = decimal separator → drop thousand dots/spaces, comma → dot
      s = s.replace(/[.\s]/g, '').replace(',', '.');
    } else {
      // no comma → dots are thousands unless they look like 2-decimal (handled by regex)
      const parts = s.split('.');
      if (parts.length > 1 && parts[parts.length - 1].length === 3) s = s.replace(/\./g, '');
    }
    const n = Number(s);
    return neg ? -n : n;
  }

  function parseLine(line: string): RawTransaction | null {
    const date = toIso(line);
    if (!date) return null;
    const money = MONEY.exec(line);
    if (!money) return null;
    const amount = parseAmount(money[1]);
    if (!Number.isFinite(amount) || amount <= 0) return null; // expenses only, skip credits
    // description = everything between the date token and the money token
    const afterDate = line.replace(DATE_ISO, '').replace(DATE_DMY, '');
    const description = afterDate.slice(0, afterDate.lastIndexOf(money[1])).trim() || afterDate.trim();
    if (!description) return null;
    return { date, description, amount, currency: 'COP' };
  }

  export const genericTemplate: StatementTemplate = {
    id: 'generic',
    institution: 'Genérico',
    detect: () => true,            // always the last-resort fallback
    parse(text: string): RawTransaction[] {
      return text
        .split(/\r?\n/)
        .map(parseLine)
        .filter((t): t is RawTransaction => t !== null);
    },
  };
  ```
  `lib/import/templates/index.ts`:
  ```ts
  import type { StatementTemplate, RawTransaction } from './types';
  import { genericTemplate } from './generic';

  // Order matters: specific banks first, generic LAST (its detect() always returns true).
  // Add a bank = push its template here (above genericTemplate) + a fixture + a test.
  export const TEMPLATES: StatementTemplate[] = [
    // bancolombiaTemplate,  ← future banks go here
    genericTemplate,
  ];

  export function pickTemplate(text: string): StatementTemplate {
    return TEMPLATES.find((t) => t.detect(text)) ?? genericTemplate;
  }

  export function parseStatement(text: string): { template: StatementTemplate; transactions: RawTransaction[] } {
    const template = pickTemplate(text);
    return { template, transactions: template.parse(text) };
  }

  export type { StatementTemplate, RawTransaction };
  ```
- [ ] Run: `pnpm test templates` (green).
- [ ] Commit: `feat(import): template registry + generic fallback + fixture (F6)`

> **Adding a real bank later (documented pattern, no code now):** create `lib/import/templates/bancolombia.ts` exporting a `StatementTemplate` whose `detect()` looks for a stable header string (e.g. `text.includes('Bancolombia')`), drop the **extracted text** of a real statement in `tests/fixtures/statements/bancolombia.txt`, add a case to `templates.test.ts`, and unshift the template into `TEMPLATES` above `genericTemplate`. Nothing else changes.

---

## Task 5 — Repository: `category_rules` in Local, Supabase, Syncing repos + mapper

**Files:** `lib/data/local-storage-repository.ts`, `lib/data/supabase-repository.ts`, `lib/data/supabase-mappers.ts`, `lib/data/syncing-repository.ts` (if present from F4), `tests/unit/data/local-storage-repository.test.ts`, `tests/unit/data/supabase-mappers.test.ts`

Satisfy the interface widened in Task 2. The F3 table + RLS already exist — only client code is added.

- [ ] **RED (local)** — in `tests/unit/data/local-storage-repository.test.ts` add:
  - `upsertCategoryRule({id:'r1', pattern:'UBER', categoryId:'preset-transporte'})` then `listCategoryRules()` → `[that rule]`.
  - upserting same `id` again replaces it (no dup); upserting a different id appends.
  - `listCategoryRules()` on empty storage → `[]`.
  - `wipeAll()` clears rules too (the `condor:` prefix sweep already covers a new key).
  - Run: `pnpm test local-storage-repository` (expect fail).
- [ ] **GREEN (local)** — `lib/data/local-storage-repository.ts`:
  - add to `KEYS`: `rules: 'condor:rules',`
  - add methods:
    ```ts
    async listCategoryRules(): Promise<CategoryRule[]> {
      return read<CategoryRule[]>(KEYS.rules, []);
    }
    async upsertCategoryRule(r: CategoryRule): Promise<CategoryRule> {
      if (isUnavailable()) return r;
      const list = await this.listCategoryRules();
      const idx = list.findIndex((x) => x.id === r.id);
      if (idx >= 0) list[idx] = r; else list.push(r);
      write(KEYS.rules, list);
      return r;
    }
    ```
  - import `CategoryRule` in the type import at the top.
- [ ] **RED (supabase mapper)** — in `tests/unit/data/supabase-mappers.test.ts` add:
  - `categoryRuleToRow({id:'r1', pattern:'UBER', categoryId:'preset-transporte'})` → `{ id:'r1', pattern:'UBER', category_id:'preset-transporte' }` (omits `user_id`).
  - `rowToCategoryRule` is the exact inverse and drops `created_at`/`updated_at`.
  - Run: `pnpm test supabase-mappers` (expect fail).
- [ ] **GREEN (supabase mapper)** — add to `lib/data/supabase-mappers.ts`:
  ```ts
  export interface CategoryRuleRow {
    id: string;
    pattern: string;
    category_id: string;
    created_at?: string;
    updated_at?: string;
  }
  export const categoryRuleToRow = (r: CategoryRule): Omit<CategoryRuleRow, 'created_at' | 'updated_at'> => ({
    id: r.id, pattern: r.pattern, category_id: r.categoryId,
  });
  export const rowToCategoryRule = (row: CategoryRuleRow): CategoryRule => ({
    id: row.id, pattern: row.pattern, categoryId: row.category_id,
  });
  ```
  (import `CategoryRule`).
- [ ] **GREEN (supabase repo)** — add to `lib/data/supabase-repository.ts`:
  ```ts
  async listCategoryRules(): Promise<CategoryRule[]> {
    const { data, error } = await this.sb.from('category_rules').select('*');
    if (error) throw error;
    return (data ?? []).map(rowToCategoryRule);
  }
  async upsertCategoryRule(r: CategoryRule): Promise<CategoryRule> {
    const { error } = await this.sb
      .from('category_rules')
      .upsert(categoryRuleToRow(r), { onConflict: 'user_id,id' });
    if (error) throw error;
    return r;
  }
  ```
  (import `CategoryRule`, `categoryRuleToRow`, `rowToCategoryRule`). Note `wipeAll` in the F3 repo already deletes `category_rules` (`supabase-repository.ts:362`), so account wipe is covered.
- [ ] **GREEN (syncing repo, only if F4 shipped `lib/data/syncing-repository.ts`)** — mirror F4's pattern for `category_rules`: `listCategoryRules` reads through local cache then refreshes from remote; `upsertCategoryRule` writes local + enqueues a remote upsert in the outbox (LWW). If F4 keyed the outbox by entity kind, add a `'categoryRule'` kind that flushes via `remote.upsertCategoryRule`. **If `syncing-repository.ts` does not exist yet, skip this bullet** and leave a note in the PR; F4/F8 will fold rules into the same outbox machinery (the spec calls out "same pattern as budgets").
- [ ] Run: `pnpm test local-storage-repository supabase-mappers` (green), then `pnpm typecheck` (now green — all repos satisfy `Repository`), then `pnpm test` (full offline suite green).
- [ ] (If a local Supabase is up) `pnpm test:int` — extend `tests/integration/supabase-repository.int.test.ts` with a `category_rules` round-trip + RLS-isolation case mirroring the expense ones. If no DB available in this session, note it for F10.
- [ ] Commit: `feat(data): category_rules in Local/Supabase/Syncing repos + mapper (F6)`

---

## Task 6 — Store: `addImportedExpense` + `learnCategoryRule` + rules in state

**Files:** `lib/store/store.ts`, `tests/unit/store/store.test.ts` (existing pattern)

The bulk insert must go **through the store** so FX runs exactly like a manual add (per the task brief). Add a thin action that mirrors `addExpense` but stamps `source: 'import'`, plus an action to persist a learned rule and an action to load rules on hydrate.

- [ ] **RED** — in `tests/unit/store/store.test.ts` (using the existing fake-repo + stub-fx harness):
  - `addImportedExpense({ amount: 100, currency: 'USD', date:'2026-05-03', categoryId:'preset-comida', merchant:'X' })` → state has one expense with `source: 'import'`, `baseAmount`/`fxRate` computed by the stub fx (assert FX ran), and `repo.upsertExpense` was called.
  - `learnCategoryRule('  Súper Éxito ', 'preset-mercado')` → `repo.upsertCategoryRule` called with `{ pattern:'SUPER EXITO', categoryId:'preset-mercado' }` and `state.categoryRules` contains it.
  - `hydrate()` also loads `categoryRules` from the repo into state (add a fake rule to the repo, assert it lands in state).
  - Run: `pnpm test store` (expect fail).
- [ ] **GREEN** — edit `lib/store/store.ts`:
  - add `categoryRules: CategoryRule[]` to `CondorState` (import the type) and initialize `categoryRules: []`.
  - in `hydrate()`, add `repo.listCategoryRules()` to the `Promise.all` and `set({ ..., categoryRules })`.
  - add actions to the interface + implementation:
    ```ts
    addImportedExpense(input: {
      amount: number; currency: string; date: string; time?: string;
      categoryId: string; merchant?: string; note?: string;
    }): Promise<void>;
    learnCategoryRule(merchant: string, categoryId: string): Promise<void>;
    ```
    ```ts
    async addImportedExpense(input) {
      const { settings, expenses } = get();
      const amount = roundToMinorUnits(input.amount, input.currency);
      const { fxRate, baseAmount } = await computeFx(
        amount, input.currency, input.date, settings.baseCurrency, fx,
      );
      const now = nowISO();
      const expense: Expense = {
        id: newId(), amount, currency: input.currency, baseAmount, fxRate,
        date: input.date, time: input.time, categoryId: input.categoryId,
        merchant: input.merchant, note: input.note,
        source: 'import', createdAt: now, updatedAt: now,
      };
      parseExpense(expense);
      await repo.upsertExpense(expense);
      set({ expenses: [...expenses, expense] });
    },

    async learnCategoryRule(merchant, categoryId) {
      const { categoryRules } = get();
      const rule = buildRule(merchant, categoryId); // from rules-engine
      const next = [...categoryRules.filter((r) => r.pattern !== rule.pattern), rule];
      await repo.upsertCategoryRule(rule);
      set({ categoryRules: next });
    },
    ```
  - import `buildRule` from `@/lib/import/rules-engine` and `CategoryRule` from types.
- [ ] Run: `pnpm test store` (green), then `pnpm test` (full suite green).
- [ ] Commit: `feat(store): addImportedExpense + learnCategoryRule + rules in state (F6)`

---

## Task 7 — TDD: lazy PDF text extraction with magic-byte + size + page caps

**Files:** `lib/import/pdf-text.ts`, `tests/unit/import/pdf-text.test.ts`

`unpdf` is **lazy-loaded** (`await import('unpdf')`) so PDF.js never enters the core bundle (D9). The function validates **before** loading unpdf: magic bytes `%PDF-`, size ≤ 10 MB. After load it enforces ≤ 50 pages via `totalPages`. Tests stub `unpdf` (vitest `vi.mock`) so no real PDF binary is needed and the suite stays fast/deterministic.

- [ ] First, `pnpm add unpdf` (record the resolved version). unpdf's default export is the **bundled serverless PDF.js build** → runs in the browser, no Node-only deps (verified via context7 `/unjs/unpdf`).
- [ ] **RED** — `tests/unit/import/pdf-text.test.ts`:
  - `vi.mock('unpdf', () => ({ getDocumentProxy: vi.fn(async () => ({})), extractText: vi.fn(async () => ({ totalPages: 2, text: ['page one', 'page two'] })) }))`.
  - Helper `makeFile(bytes: number[], size?: number)` builds a `File`/`Blob` with given leading bytes; assert:
    - non-PDF magic (`[0x00,0x01]`) → rejects with an error whose `.code === 'NOT_PDF'`.
    - `%PDF-` magic but `size > 10 MB` → rejects `.code === 'TOO_LARGE'` (stub size without allocating 10 MB).
    - valid PDF, mocked `totalPages: 51` → rejects `.code === 'TOO_MANY_PAGES'`.
    - valid PDF, `totalPages: 2` → resolves to `'page one\npage two'` (pages joined by `\n`).
  - Run: `pnpm test pdf-text` (expect fail).
- [ ] **GREEN** — `lib/import/pdf-text.ts`:
  ```ts
  export const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
  export const MAX_PAGES = 50;
  const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"

  export type ImportErrorCode = 'NOT_PDF' | 'TOO_LARGE' | 'TOO_MANY_PAGES' | 'EXTRACT_FAILED';
  export class ImportError extends Error {
    constructor(public code: ImportErrorCode, message?: string) {
      super(message ?? code);
      this.name = 'ImportError';
    }
  }

  async function hasPdfMagic(file: Blob): Promise<boolean> {
    const head = new Uint8Array(await file.slice(0, PDF_MAGIC.length).arrayBuffer());
    return PDF_MAGIC.every((b, i) => head[i] === b);
  }

  /**
   * Extract plain text from a statement PDF, entirely on-device.
   * Validates magic bytes + size BEFORE loading the parser, then page count after.
   * unpdf is lazy-imported so PDF.js stays out of the core bundle (D9).
   */
  export async function extractStatementText(file: Blob): Promise<string> {
    if (file.size > MAX_BYTES) throw new ImportError('TOO_LARGE');
    if (!(await hasPdfMagic(file))) throw new ImportError('NOT_PDF');

    const { getDocumentProxy, extractText } = await import('unpdf'); // lazy — D9
    let pages: string[];
    let totalPages: number;
    try {
      const data = new Uint8Array(await file.arrayBuffer());
      const pdf = await getDocumentProxy(data);
      const res = await extractText(pdf); // default: per-page string[]
      totalPages = res.totalPages;
      pages = Array.isArray(res.text) ? res.text : [res.text];
    } catch (e) {
      throw new ImportError('EXTRACT_FAILED', (e as Error)?.message);
    }
    if (totalPages > MAX_PAGES) throw new ImportError('TOO_MANY_PAGES');
    return pages.join('\n');
  }
  ```
- [ ] Run: `pnpm test pdf-text` (green). Then `pnpm build` and confirm `unpdf`/`pdfjs` are **not** in the main/first-load chunks (look for a separate async chunk in the build output) — proves the lazy split (D9).
- [ ] Commit: `feat(import): lazy unpdf text extraction + magic-byte/size/page caps (F6)`

---

## Task 8 — i18n strings (es + en) + Ajustes entry point

**Files:** `messages/es.json`, `messages/en.json`, `app/ajustes/page.tsx`

- [ ] Add an `Importar` namespace to **both** message files (keys below), plus `Ajustes.importStatement` for the row label.
  - es: `{ "title": "Importar extracto", "subtitle": "Tu PDF se procesa en tu dispositivo. Nunca se sube a internet.", "pickFile": "Elegir PDF", "parsing": "Leyendo el extracto…", "reviewTitle": "Revisa los gastos", "selectAll": "Seleccionar todo", "deselectAll": "Quitar selección", "importN": "Importar {n} gastos", "imported": "{n} gastos importados", "empty": "No se encontraron transacciones en este PDF.", "colDate": "Fecha", "colMerchant": "Comercio", "colAmount": "Monto", "colCategory": "Categoría", "errNotPdf": "El archivo no es un PDF.", "errTooLarge": "El PDF supera 10 MB.", "errTooManyPages": "El PDF tiene más de 50 páginas.", "errExtract": "No se pudo leer el PDF." }`
  - en: `{ "title": "Import statement", "subtitle": "Your PDF is processed on your device. It is never uploaded.", "pickFile": "Choose PDF", "parsing": "Reading the statement…", "reviewTitle": "Review expenses", "selectAll": "Select all", "deselectAll": "Clear selection", "importN": "Import {n} expenses", "imported": "{n} expenses imported", "empty": "No transactions found in this PDF.", "colDate": "Date", "colMerchant": "Merchant", "colAmount": "Amount", "colCategory": "Category", "errNotPdf": "The file is not a PDF.", "errTooLarge": "The PDF exceeds 10 MB.", "errTooManyPages": "The PDF has more than 50 pages.", "errExtract": "Could not read the PDF." }`
  - Add `"importStatement": "Importar extracto"` (es) / `"Import statement"` (en) under the existing `Ajustes` namespace.
- [ ] In `app/ajustes/page.tsx`, add a row in the DATOS section (next to Export) that navigates to `/importar`:
  ```tsx
  import { FileUp } from 'lucide-react'
  // …in the DATOS section, before/after exportData row:
  <SettingRow icon={<FileUp />} label={t('importStatement')} onClick={() => router.push('/importar')} />
  ```
  (match the existing `SettingRow` API — read the export row above to copy its exact prop shape; adjust if `SettingRow` uses `onSelect`/`href` instead of `onClick`).
- [ ] Run: `pnpm test` (intl tests, if any, still green) and `pnpm typecheck`.
- [ ] Commit: `feat(i18n): Importar namespace (es/en) + Ajustes entry point (F6)`

---

## Task 9 — Review table component (editable, reuses CategoryChip)

**Files:** `components/import/ReviewTable.tsx`, `components/import/ReviewRow.tsx`, `tests/component/ReviewTable.test.tsx`

A pure, controlled component: receives categorized rows + categories, emits change/toggle callbacks. No store/PDF imports here (keeps it testable and respects the invariant). Mobile-first: each row is a card; category opens a chip grid; date/amount/merchant are inline-editable inputs; a header has select/deselect-all.

- [ ] **RED** — `tests/component/ReviewTable.test.tsx` (follow the existing `withIntl` harness):
  - renders N rows for N transactions; each shows merchant, amount, date, and the suggested category name.
  - clicking the row's select checkbox calls `onToggle(index)`; "select all" / "deselect all" call `onToggleAll(true|false)`.
  - editing the merchant input calls `onEdit(index, { merchant })`; editing amount calls `onEdit(index, { amount: <number> })`.
  - opening the category picker and choosing a different category calls `onChangeCategory(index, newCategoryId)`.
  - the footer button shows the selected count via `Importar {n} gastos` and calls `onImport` when clicked; it is disabled when 0 selected.
  - Run: `pnpm test ReviewTable` (expect fail).
- [ ] **GREEN** — implement `ReviewRow` (one editable card: checkbox, date `<input type="date">`, merchant `<input>`, amount `<input inputMode="decimal">`, and a category trigger that expands a `CategoryChip` grid) and `ReviewTable` (header with select-all, list of `ReviewRow`, sticky footer button). Props:
  ```ts
  export interface ReviewTableProps {
    rows: Array<CategorizedTransaction & { selected: boolean }>;
    categories: Category[];
    onToggle(index: number): void;
    onToggleAll(selected: boolean): void;
    onEdit(index: number, patch: Partial<Pick<RawTransaction, 'date' | 'merchant' | 'amount' | 'currency'>> & { merchant?: string }): void;
    onChangeCategory(index: number, categoryId: string): void;
    onImport(): void;
  }
  ```
  Reuse `CategoryChip` for category selection (it already exposes `selected`/`onSelect`). Use min-h-[44px] touch targets, `active:scale-95`, safe-area-aware sticky footer (`pb-[env(safe-area-inset-bottom)]`) per D9.
- [ ] Run: `pnpm test ReviewTable` (green).
- [ ] Commit: `feat(import): review table + row (editable, reuses CategoryChip) (F6)`

---

## Task 10 — Import page wiring (`app/importar/page.tsx`) + lazy boundary

**Files:** `app/importar/page.tsx`, `components/import/ImportFlow.tsx`

The page is a thin `'use client'` shell; the heavy flow (which dynamically imports `pdf-text`) is loaded via `next/dynamic` so the parser stays off the first load.

- [ ] Create `components/import/ImportFlow.tsx` (`'use client'`): owns the state machine `idle → parsing → review → done | error`.
  - file input (`<input type="file" accept="application/pdf">`); on change:
    ```ts
    const text = await extractStatementText(file);                  // from pdf-text (already lazy inside)
    const { transactions } = parseStatement(text);                  // templates/index
    const categorized = categorize(transactions, categoryRules, OTROS_ID); // rules-engine + presets.OTROS_ID
    setRows(categorized.map((t) => ({ ...t, selected: true })));
    ```
    wrap in try/catch; on `ImportError` map `err.code` → the matching `Importar.err*` toast (sonner, already used in Ajustes).
  - read `categories` + `categoryRules` + actions from `useCondorStore`.
  - render `ReviewTable`; on `onChangeCategory(i, catId)`: update local row **and** call `learnCategoryRule(rows[i].description, catId)` (the engine learns from the correction).
  - on `onImport`: for each selected row `await addImportedExpense({ amount, currency, date, categoryId, merchant: description })`; then `toast(t('imported', { n }))` and `router.push('/historico')`.
- [ ] Create `app/importar/page.tsx`:
  ```tsx
  'use client'
  import dynamic from 'next/dynamic'
  const ImportFlow = dynamic(() => import('@/components/import/ImportFlow').then((m) => m.ImportFlow), {
    ssr: false,
    loading: () => <div className="p-6 text-center text-text-muted">…</div>,
  })
  export default function ImportarPage() {
    return <ImportFlow />
  }
  ```
  (header with back chevron + `BottomNav`, mirroring `app/ajustes/page.tsx` chrome; use `Importar` namespace strings.)
- [ ] Run: `pnpm typecheck && pnpm lint && pnpm test` (all green). `pnpm build` and confirm `/importar` does not pull `unpdf` into the shared chunk.
- [ ] Commit: `feat(import): /importar page + lazy ImportFlow wiring (F6)`

---

## Task 11 — E2E (Playwright) review→import flow with a fixture

**Files:** `tests/e2e/import.spec.ts`, (optional) `tests/fixtures/statements/sample.pdf`

If generating/committing a tiny real PDF is viable, drive the full flow; otherwise stub `extractStatementText` via route/init script and assert the review→import path. Keep it resilient.

- [ ] Preferred: add a **small** real `tests/fixtures/statements/sample.pdf` (a few transaction lines). Test: navigate to `/importar`, `setInputFiles(sample.pdf)`, wait for the review table, assert ≥1 row, click "Importar N gastos", assert redirect to `/historico` and that the imported expense appears.
- [ ] Fallback (no binary): `page.addInitScript` to stub `window`-level extraction, or intercept the dynamic module — assert the review table renders from a known text fixture and import persists (localStorage path is fine for e2e since no login is stubbed here).
- [ ] Run: `pnpm e2e --grep import` (green). If the e2e harness needs auth (F1) and it is not stubbed in this environment, mark the test `test.fixme` with a note and rely on the component test (Task 9) for coverage — do not block the feature.
- [ ] Commit: `test(import): e2e review→import flow (F6)`

---

## Task 12 — Final verification gate

- [ ] `pnpm typecheck` — no errors.
- [ ] `pnpm lint` — clean.
- [ ] `pnpm test` — full offline suite green (schemas, rules-engine, templates, pdf-text, repos, mappers, store, ReviewTable).
- [ ] `pnpm build` — succeeds; `unpdf`/PDF.js confined to an async chunk (not first-load JS). Note the first-load JS delta for `/importar` (should be ~unchanged vs core; the parser is lazy).
- [ ] (If local Supabase up) `pnpm test:int` — `category_rules` round-trip + RLS isolation green.
- [ ] Manual smoke (optional, `pnpm dev`): Ajustes → Importar extracto → pick a real bank PDF → see parsed rows → recategorize one (confirm next import of the same merchant auto-categorizes — rule learned) → import → appears in Histórico with `source: 'import'`.
- [ ] Commit (only if anything changed in this pass): `chore(import): F6 final verification pass`

---

## Done criteria

- [ ] `Expense.source` is `'manual' | 'import'` (type + Zod); imported expenses carry `source: 'import'`.
- [ ] PDF text extraction is **100% client-side** (no upload, no server endpoint, no env var), with magic-byte (`%PDF-`), 10 MB, and 50-page rejections, and `unpdf` is **lazy-loaded** (proven by the build chunking).
- [ ] Template registry with a generic fallback parses the fixture deterministically; adding a bank = template + fixture + test only.
- [ ] Rules-engine normalizes (uppercase / no accents / collapsed spaces), matches by substring/prefix (longest wins), and **learns** from review corrections (`upsertCategoryRule`).
- [ ] `listCategoryRules` / `upsertCategoryRule` implemented in Local + Supabase (+ Syncing if F4 present); F3 table/RLS reused, no new migration.
- [ ] Review table is mobile-first, reuses `CategoryChip`, supports edit + select/deselect-all; bulk insert goes **through the store** so FX runs.
- [ ] i18n complete in es + en; entry point in Ajustes; `/importar` route loads the flow via `next/dynamic`.
- [ ] `pnpm typecheck && pnpm lint && pnpm test` green; `pnpm build` green with the parser in an async chunk.

---

## Assumptions (read before coding)

1. **No new migration.** F3's `0001_core.sql` already created `category_rules` (lines 106–116) and `expenses.source text default 'manual'` already permits `'import'` (line 77). F6 is pure client code — verify these lines still exist before assuming.
2. **`output: 'export'` in `next.config.ts`.** It is still set in the current tree (a fully static export). F0 was scheduled to drop it; `next/dynamic` with `ssr:false` works under static export too, so `/importar` is fine either way. If F0 already removed it, no change needed.
3. **`SyncingRepository` may not exist yet** in this session's tree (it is F4). Task 5's syncing bullet is conditional: implement it if the file is present, otherwise leave `category_rules` to ride the same outbox machinery when F4/F8 generalize it (the spec explicitly says budgets follow "the same pattern").
4. **`SettingRow` prop shape** (`onClick` vs `href`/`onSelect`) is assumed from the Ajustes export row; the implementer must read the existing export/wipe rows and match the real API.
5. **Generic template currency = `'COP'`.** The user's home market is Colombian and the base currency default is COP; the user can edit currency per row in the review table. Bank-specific templates can detect other currencies.
6. **Amount parsing targets Colombian/European grouping (`18.500,00`)** as the common case, with a plain-decimal fallback. Real bank fixtures collected later may need template-specific `parseAmount`.
7. **E2E may be auth-gated by F1.** If the test harness can't reach `/importar` without a stubbed session, the component test (Task 9) is the binding coverage and the e2e is marked `fixme` — the feature is not blocked.
8. **`unpdf` browser build** uses its bundled serverless PDF.js (no `pdfjs-dist` install, no `definePDFJSModule` needed) — confirmed via context7 `/unjs/unpdf`. If a future PDF triggers worker/font issues, `standardFontDataUrl` can be passed to `getDocumentProxy`, but that is not needed for text extraction.
