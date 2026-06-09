import type { Expense, Category, Settings, ExportBundle, CategoryRule, Budget } from '@/lib/domain/types';

export interface Repository {
  listExpenses(): Promise<Expense[]>;
  upsertExpense(e: Expense): Promise<Expense>;
  deleteExpense(id: string): Promise<void>;
  listCategories(): Promise<Category[]>;
  upsertCategory(c: Category): Promise<Category>;
  deleteCategory(id: string, reassignTo?: string): Promise<void>;
  listBudgets(): Promise<Budget[]>;
  upsertBudget(b: Budget): Promise<Budget>;
  deleteBudget(id: string): Promise<void>;
  getSettings(): Promise<Settings>;
  putSettings(s: Settings): Promise<Settings>;
  exportAll(): Promise<ExportBundle>;
  wipeAll(): Promise<void>;
  listCategoryRules(): Promise<CategoryRule[]>;
  upsertCategoryRule(r: CategoryRule): Promise<CategoryRule>;
}
