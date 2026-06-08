import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand/react';
import type { Expense, Category, Settings, ExportBundle } from '@/lib/domain/types';
import { parseExpense } from '@/lib/domain/schemas';
import { roundToMinorUnits } from '@/lib/format/money';
import { newId } from '@/lib/domain/ids';
import type { Repository } from '@/lib/data/repository';
import { LocalStorageRepository, DEFAULT_SETTINGS } from '@/lib/data/local-storage-repository';
import type { FxProvider } from '@/lib/fx/fx-provider';
import { ServerFxProvider } from '@/lib/fx/server-fx-provider';
import { todayMonthKey } from '@/lib/format/date';
import { migrate } from './migrations';

// ---------- Small helpers ----------------------------------------------------

function nowISO(): string {
  return new Date().toISOString();
}

async function computeFx(
  amount: number,
  currency: string,
  date: string,
  baseCurrency: string,
  fx: FxProvider,
): Promise<{ fxRate: number | null; baseAmount: number | null }> {
  if (currency === baseCurrency) {
    return { fxRate: 1, baseAmount: roundToMinorUnits(amount, baseCurrency) };
  }
  const rate = await fx.getRate(currency, baseCurrency, date);
  if (rate === null) {
    return { fxRate: null, baseAmount: null };
  }
  return { fxRate: rate, baseAmount: roundToMinorUnits(amount * rate, baseCurrency) };
}

// ---------- State shape ------------------------------------------------------

export interface CondorState {
  expenses: Expense[];
  categories: Category[];
  settings: Settings;
  hydrated: boolean;
  month: string;
  // actions
  hydrate(): Promise<void>;
  setMonth(month: string): void;
  addExpense(input: {
    amount: number;
    currency: string;
    date: string;
    time?: string;
    categoryId: string;
    merchant?: string;
    note?: string;
  }): Promise<void>;
  updateExpense(
    id: string,
    patch: Partial<Pick<Expense, 'amount' | 'currency' | 'date' | 'time' | 'categoryId' | 'merchant' | 'note'>>,
  ): Promise<void>;
  deleteExpense(id: string): Promise<void>;
  addCategory(input: { name: string; color: string; icon: string }): Promise<void>;
  updateCategory(
    id: string,
    patch: Partial<Pick<Category, 'name' | 'color' | 'icon' | 'hidden'>>,
  ): Promise<void>;
  deleteCategory(id: string, reassignTo?: string): Promise<void>;
  setSettings(patch: Partial<Settings>): Promise<void>;
  recomputeAllBaseAmounts(): Promise<void>;
  exportAll(): Promise<ExportBundle>;
  wipeAll(): Promise<void>;
  setRepo(repo: Repository): void;
}

// ---------- Factory ----------------------------------------------------------

export function createCondorStore(initialRepo: Repository, fx: FxProvider) {
  let repo = initialRepo;
  return createStore<CondorState>((set, get) => ({
    expenses: [],
    categories: [],
    settings: { ...DEFAULT_SETTINGS },
    hydrated: false,
    month: todayMonthKey(),

    async hydrate() {
      const [expenses, categories, rawSettings] = await Promise.all([
        repo.listExpenses(),
        repo.listCategories(),
        repo.getSettings(),
      ]);

      const migrated = migrate({
        schemaVersion: rawSettings.schemaVersion,
        expenses,
        categories,
        settings: rawSettings,
      });

      // Persist migrated data if schemaVersion changed
      if (migrated.schemaVersion !== rawSettings.schemaVersion) {
        await repo.putSettings(migrated.settings);
        // Re-persist all expenses/categories if the migration changed them
        for (const e of migrated.expenses) {
          await repo.upsertExpense(e);
        }
        for (const c of migrated.categories) {
          await repo.upsertCategory(c);
        }
      }

      set({
        expenses: migrated.expenses,
        categories: migrated.categories,
        settings: migrated.settings,
        hydrated: true,
      });
    },

    setMonth(month: string) {
      set({ month });
    },

    async addExpense(input) {
      const { settings, expenses } = get();
      const amount = roundToMinorUnits(input.amount, input.currency);
      const { fxRate, baseAmount } = await computeFx(
        amount,
        input.currency,
        input.date,
        settings.baseCurrency,
        fx,
      );
      const now = nowISO();
      const expense: Expense = {
        id: newId(),
        amount,
        currency: input.currency,
        baseAmount,
        fxRate,
        date: input.date,
        time: input.time,
        categoryId: input.categoryId,
        merchant: input.merchant,
        note: input.note,
        source: 'manual',
        createdAt: now,
        updatedAt: now,
      };
      parseExpense(expense); // throws on invalid
      await repo.upsertExpense(expense);
      set({ expenses: [...expenses, expense] });
    },

    async updateExpense(id, patch) {
      const { settings, expenses } = get();
      const existing = expenses.find(e => e.id === id);
      if (!existing) return;

      const needsFxRecompute =
        patch.amount !== undefined ||
        patch.currency !== undefined ||
        patch.date !== undefined;

      let merged: Expense = { ...existing, ...patch, updatedAt: nowISO() };

      if (needsFxRecompute) {
        const amount = patch.amount !== undefined
          ? roundToMinorUnits(patch.amount, merged.currency)
          : existing.amount;
        merged = { ...merged, amount };
        const { fxRate, baseAmount } = await computeFx(
          merged.amount,
          merged.currency,
          merged.date,
          settings.baseCurrency,
          fx,
        );
        merged = { ...merged, fxRate, baseAmount };
      }

      parseExpense(merged);
      await repo.upsertExpense(merged);
      set({ expenses: expenses.map(e => e.id === id ? merged : e) });
    },

    async deleteExpense(id) {
      const { expenses } = get();
      await repo.deleteExpense(id);
      set({ expenses: expenses.filter(e => e.id !== id) });
    },

    async addCategory(input) {
      const { categories } = get();
      const cat: Category = {
        id: newId(),
        name: input.name,
        color: input.color,
        icon: input.icon,
        isPreset: false,
      };
      await repo.upsertCategory(cat);
      set({ categories: [...categories, cat] });
    },

    async updateCategory(id, patch) {
      const { categories } = get();
      const existing = categories.find(c => c.id === id);
      if (!existing) return;
      const merged: Category = { ...existing, ...patch };
      await repo.upsertCategory(merged);
      set({ categories: categories.map(c => c.id === id ? merged : c) });
    },

    async deleteCategory(id, reassignTo) {
      const { categories, expenses } = get();
      // repo.deleteCategory throws for presets and handles expense reassignment in storage
      await repo.deleteCategory(id, reassignTo);

      const nextExpenses = reassignTo !== undefined
        ? expenses.map(e => e.categoryId === id ? { ...e, categoryId: reassignTo } : e)
        : expenses;

      set({
        categories: categories.filter(c => c.id !== id),
        expenses: nextExpenses,
      });
    },

    async setSettings(patch) {
      const { settings } = get();
      const changedBase = patch.baseCurrency !== undefined && patch.baseCurrency !== settings.baseCurrency;
      const next: Settings = { ...settings, ...patch };
      await repo.putSettings(next);
      set({ settings: next });
      if (changedBase) {
        await get().recomputeAllBaseAmounts();
      }
    },

    async recomputeAllBaseAmounts() {
      const { settings, expenses } = get();
      const recomputed: Expense[] = [];
      for (const expense of expenses) {
        const { fxRate, baseAmount } = await computeFx(
          expense.amount,
          expense.currency,
          expense.date,
          settings.baseCurrency,
          fx,
        );
        const updated: Expense = { ...expense, fxRate, baseAmount, updatedAt: nowISO() };
        await repo.upsertExpense(updated);
        recomputed.push(updated);
      }
      set((state) => ({ expenses: state.expenses.map((e) => recomputed.find((r) => r.id === e.id) ?? e) }));
    },

    async exportAll() {
      return repo.exportAll();
    },

    async wipeAll() {
      await repo.wipeAll();
      const [categories, settings] = await Promise.all([
        repo.listCategories(),
        repo.getSettings(),
      ]);
      set({ expenses: [], categories, settings, hydrated: true });
    },

    setRepo(next: Repository) { repo = next; },
  }));
}

// ---------- Default instance (React) -----------------------------------------

// NOTE (F4): when a Supabase session exists (F1/F3), construct the repo via
// makeRepository({ remote: new SupabaseRepository(...) }) — which returns a
// SyncingRepository — rebuild the store with it, then `new SyncController(repo).start()`
// and call `controller.notifyWrite()` after store mutations. Unauthenticated/SSR
// keeps the bare LocalStorageRepository below.
const defaultRepo = new LocalStorageRepository();
// FX now flows through our server proxy (cached + rate-limited). The proxy
// falls back to a direct Frankfurter call internally when it is unreachable
// but the network is up; the store still receives null gracefully when no
// rate can be resolved.
const defaultFx = new ServerFxProvider();
export const defaultStore = createCondorStore(defaultRepo, defaultFx);

export function useCondorStore(): CondorState;
export function useCondorStore<U>(selector: (state: CondorState) => U): U;
export function useCondorStore<U>(selector?: (state: CondorState) => U) {
  return useStore(defaultStore, selector as (state: CondorState) => U);
}
