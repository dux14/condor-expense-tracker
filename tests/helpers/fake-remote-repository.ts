import type { Repository } from '@/lib/data/repository';
import type { Expense, Category, Settings, ExportBundle, CategoryRule, Budget } from '@/lib/domain/types';
import { SCHEMA_VERSION } from '@/lib/domain/types';
import { PRESET_CATEGORIES } from '@/lib/domain/presets';
import { DEFAULT_SETTINGS } from '@/lib/data/local-storage-repository';

/**
 * In-memory Repository acting as the "remote" (stand-in for SupabaseRepository).
 * Pure object graph — no localStorage, no network. Two SyncingRepository
 * clients can share ONE instance to simulate two devices converging.
 */
export class FakeRemoteRepository implements Repository {
  expenses: Expense[] = [];
  categories: Category[] = [...PRESET_CATEGORIES];
  rules: CategoryRule[] = [];
  budgets: Budget[] = [];
  settings: Settings = { ...DEFAULT_SETTINGS };

  async listExpenses(): Promise<Expense[]> { return this.expenses.map(e => ({ ...e })); }
  async upsertExpense(e: Expense): Promise<Expense> {
    const i = this.expenses.findIndex(x => x.id === e.id);
    if (i >= 0) this.expenses[i] = { ...e }; else this.expenses.push({ ...e });
    return { ...e };
  }
  async deleteExpense(id: string): Promise<void> {
    this.expenses = this.expenses.filter(x => x.id !== id);
  }
  async listCategories(): Promise<Category[]> { return this.categories.map(c => ({ ...c })); }
  async upsertCategory(c: Category): Promise<Category> {
    const i = this.categories.findIndex(x => x.id === c.id);
    if (i >= 0) this.categories[i] = { ...c }; else this.categories.push({ ...c });
    return { ...c };
  }
  async deleteCategory(id: string, reassignTo?: string): Promise<void> {
    const cat = this.categories.find(x => x.id === id);
    if (cat?.isPreset) throw new Error(`Cannot delete preset category "${id}"`);
    if (reassignTo !== undefined) {
      this.expenses = this.expenses.map(e => e.categoryId === id ? { ...e, categoryId: reassignTo } : e);
    }
    this.categories = this.categories.filter(x => x.id !== id);
  }
  async listCategoryRules(): Promise<CategoryRule[]> { return this.rules.map(r => ({ ...r })); }
  async upsertCategoryRule(r: CategoryRule): Promise<CategoryRule> {
    const i = this.rules.findIndex(x => x.id === r.id);
    if (i >= 0) this.rules[i] = { ...r }; else this.rules.push({ ...r });
    return { ...r };
  }
  async listBudgets(): Promise<Budget[]> { return this.budgets.map(b => ({ ...b })); }
  async upsertBudget(b: Budget): Promise<Budget> {
    const i = this.budgets.findIndex(x => x.id === b.id);
    if (i >= 0) this.budgets[i] = { ...b }; else this.budgets.push({ ...b });
    return { ...b };
  }
  async deleteBudget(id: string): Promise<void> {
    this.budgets = this.budgets.filter(x => x.id !== id);
  }
  async getSettings(): Promise<Settings> { return { ...this.settings }; }
  async putSettings(s: Settings): Promise<Settings> { this.settings = { ...s }; return { ...s }; }
  async exportAll(): Promise<ExportBundle> {
    return {
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      expenses: this.expenses.map(e => ({ ...e })),
      categories: this.categories.map(c => ({ ...c })),
      settings: { ...this.settings },
    };
  }
  async wipeAll(): Promise<void> {
    this.expenses = [];
    this.categories = [...PRESET_CATEGORIES];
    this.rules = [];
    this.budgets = [];
    this.settings = { ...DEFAULT_SETTINGS };
  }
}

/** Wrap a Repository so every method can be made to reject (simulate offline). */
export function offlineGate(remote: Repository): {
  repo: Repository;
  online: boolean;
  setOnline(v: boolean): void;
} {
  const state = { online: true };
  const guard = <T>(fn: () => Promise<T>): Promise<T> =>
    state.online ? fn() : Promise.reject(new Error('offline'));
  const repo: Repository = {
    listExpenses: () => guard(() => remote.listExpenses()),
    upsertExpense: (e) => guard(() => remote.upsertExpense(e)),
    deleteExpense: (id) => guard(() => remote.deleteExpense(id)),
    listCategories: () => guard(() => remote.listCategories()),
    upsertCategory: (c) => guard(() => remote.upsertCategory(c)),
    deleteCategory: (id, r) => guard(() => remote.deleteCategory(id, r)),
    listBudgets: () => guard(() => remote.listBudgets()),
    upsertBudget: (b) => guard(() => remote.upsertBudget(b)),
    deleteBudget: (id) => guard(() => remote.deleteBudget(id)),
    listCategoryRules: () => guard(() => remote.listCategoryRules()),
    upsertCategoryRule: (r) => guard(() => remote.upsertCategoryRule(r)),
    getSettings: () => guard(() => remote.getSettings()),
    putSettings: (s) => guard(() => remote.putSettings(s)),
    exportAll: () => guard(() => remote.exportAll()),
    wipeAll: () => guard(() => remote.wipeAll()),
  };
  return {
    repo,
    get online() { return state.online; },
    setOnline(v: boolean) { state.online = v; },
  };
}
