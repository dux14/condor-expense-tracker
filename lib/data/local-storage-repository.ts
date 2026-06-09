import type { Expense, Category, Settings, ExportBundle, CategoryRule, Budget } from '@/lib/domain/types';
import { SCHEMA_VERSION } from '@/lib/domain/types';
import { PRESET_CATEGORIES } from '@/lib/domain/presets';
import type { Repository } from './repository';

// ---- Keys ----------------------------------------------------------------

const KEYS = {
  expenses: 'condor:expenses',
  categories: 'condor:categories',
  settings: 'condor:settings',
  rules: 'condor:rules',
  budgets: 'condor:budgets',
} as const;

// ---- Defaults ------------------------------------------------------------

export const DEFAULT_SETTINGS: Settings = {
  baseCurrency: 'COP',
  locale: 'es',
  theme: 'auto',
  dashboardView: 'bars',
  schemaVersion: SCHEMA_VERSION,
};

// ---- Helpers -------------------------------------------------------------

/** Returns true when localStorage is unavailable (SSR / static prerender). */
function isUnavailable(): boolean {
  return typeof window === 'undefined' || !window.localStorage;
}

function read<T>(key: string, fallback: T): T {
  if (isUnavailable()) return fallback;
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  if (isUnavailable()) return;
  localStorage.setItem(key, JSON.stringify(value));
}

// ---- Implementation ------------------------------------------------------

export class LocalStorageRepository implements Repository {
  // ---- Expenses ----------------------------------------------------------

  async listExpenses(): Promise<Expense[]> {
    return read<Expense[]>(KEYS.expenses, []);
  }

  async upsertExpense(e: Expense): Promise<Expense> {
    if (isUnavailable()) return e;
    const list = await this.listExpenses();
    const idx = list.findIndex(x => x.id === e.id);
    if (idx >= 0) {
      list[idx] = e;
    } else {
      list.push(e);
    }
    write(KEYS.expenses, list);
    return e;
  }

  async deleteExpense(id: string): Promise<void> {
    if (isUnavailable()) return;
    const list = await this.listExpenses();
    write(KEYS.expenses, list.filter(x => x.id !== id));
  }

  // ---- Categories --------------------------------------------------------

  async listCategories(): Promise<Category[]> {
    if (isUnavailable()) return [...PRESET_CATEGORIES];
    const raw = localStorage.getItem(KEYS.categories);
    if (raw === null) {
      // First run — seed with presets
      write(KEYS.categories, PRESET_CATEGORIES);
      return [...PRESET_CATEGORIES];
    }
    try {
      return JSON.parse(raw) as Category[];
    } catch {
      return [...PRESET_CATEGORIES];
    }
  }

  async upsertCategory(c: Category): Promise<Category> {
    if (isUnavailable()) return c;
    const list = await this.listCategories();
    const idx = list.findIndex(x => x.id === c.id);
    if (idx >= 0) {
      list[idx] = c;
    } else {
      list.push(c);
    }
    write(KEYS.categories, list);
    return c;
  }

  async deleteCategory(id: string, reassignTo?: string): Promise<void> {
    if (isUnavailable()) return;
    const list = await this.listCategories();
    const category = list.find(x => x.id === id);

    if (category?.isPreset) {
      throw new Error(`Cannot delete preset category "${id}"`);
    }

    if (reassignTo !== undefined) {
      // Move all expenses belonging to this category to reassignTo
      const expenses = await this.listExpenses();
      const updated = expenses.map(e =>
        e.categoryId === id ? { ...e, categoryId: reassignTo } : e,
      );
      write(KEYS.expenses, updated);
    }

    write(KEYS.categories, list.filter(x => x.id !== id));
  }

  // ---- Budgets -----------------------------------------------------------

  async listBudgets(): Promise<Budget[]> {
    return read<Budget[]>(KEYS.budgets, []);
  }

  async upsertBudget(b: Budget): Promise<Budget> {
    if (isUnavailable()) return b;
    const list = await this.listBudgets();
    const idx = list.findIndex((x) => x.id === b.id);
    if (idx >= 0) list[idx] = b; else list.push(b);
    write(KEYS.budgets, list);
    return b;
  }

  async deleteBudget(id: string): Promise<void> {
    if (isUnavailable()) return;
    const list = await this.listBudgets();
    write(KEYS.budgets, list.filter((x) => x.id !== id));
  }

  // ---- CategoryRules -----------------------------------------------------

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

  // ---- Settings ----------------------------------------------------------

  async getSettings(): Promise<Settings> {
    if (isUnavailable()) return { ...DEFAULT_SETTINGS };
    const raw = localStorage.getItem(KEYS.settings);
    if (raw === null) return { ...DEFAULT_SETTINGS };
    try {
      const partial = JSON.parse(raw) as Partial<Settings>;
      return { ...DEFAULT_SETTINGS, ...partial };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  async putSettings(s: Settings): Promise<Settings> {
    if (!isUnavailable()) write(KEYS.settings, s);
    return s;
  }

  // ---- Export ------------------------------------------------------------

  async exportAll(): Promise<ExportBundle> {
    const [expenses, categories, budgets, categoryRules, settings] = await Promise.all([
      this.listExpenses(),
      this.listCategories(),
      this.listBudgets(),
      this.listCategoryRules(),
      this.getSettings(),
    ]);
    return {
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      expenses,
      categories,
      budgets,
      categoryRules,
      settings,
    };
  }

  // ---- Wipe --------------------------------------------------------------

  async wipeAll(): Promise<void> {
    if (isUnavailable()) return;
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key !== null && key.startsWith('condor:')) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
  }
}
