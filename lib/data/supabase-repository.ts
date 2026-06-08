import type { SupabaseClient } from '@supabase/supabase-js';
import type { Expense, Category, Settings, ExportBundle, CategoryRule } from '@/lib/domain/types';
import { SCHEMA_VERSION } from '@/lib/domain/types';
import { PRESET_CATEGORIES } from '@/lib/domain/presets';
import { DEFAULT_SETTINGS } from './local-storage-repository';
import type { Repository } from './repository';
import {
  expenseToRow, rowToExpense,
  categoryToRow, rowToCategory,
  settingsToRow, rowToSettings,
  categoryRuleToRow, rowToCategoryRule,
} from './supabase-mappers';
import type { CategoryRuleRow } from './supabase-mappers';

// Seeding: preset categories are inserted app-side on the first listCategories()
// when the user has zero rows. See plan Task 4 for the rationale (testability,
// single source of preset truth, RLS simplicity). NOT a DB trigger.

// Sentinel that never equals a real user_id; `neq(user_id, ZERO_UUID)` selects
// every row, which under RLS means "all of the current user's rows".
const ZERO_UUID = '00000000-0000-0000-0000-000000000000';

export class SupabaseRepository implements Repository {
  constructor(private readonly sb: SupabaseClient) {}

  // ---- Expenses ----------------------------------------------------------
  async listExpenses(): Promise<Expense[]> {
    const { data, error } = await this.sb
      .from('expenses')
      .select('*')
      .order('date', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(rowToExpense);
  }

  async upsertExpense(e: Expense): Promise<Expense> {
    const { error } = await this.sb
      .from('expenses')
      .upsert(expenseToRow(e), { onConflict: 'user_id,id' });
    if (error) throw error;
    return e;
  }

  async deleteExpense(id: string): Promise<void> {
    const { error } = await this.sb.from('expenses').delete().eq('id', id);
    if (error) throw error;
  }

  // ---- Categories --------------------------------------------------------
  async listCategories(): Promise<Category[]> {
    const { data, error } = await this.sb.from('categories').select('*');
    if (error) throw error;
    if ((data ?? []).length === 0) {
      // First use — seed presets for this user.
      const rows = PRESET_CATEGORIES.map(categoryToRow);
      const { error: seedErr } = await this.sb
        .from('categories')
        .upsert(rows, { onConflict: 'user_id,id' });
      if (seedErr) throw seedErr;
      return [...PRESET_CATEGORIES];
    }
    return data.map(rowToCategory);
  }

  async upsertCategory(c: Category): Promise<Category> {
    const { error } = await this.sb
      .from('categories')
      .upsert(categoryToRow(c), { onConflict: 'user_id,id' });
    if (error) throw error;
    return c;
  }

  async deleteCategory(id: string, reassignTo?: string): Promise<void> {
    const { error } = await this.sb.rpc('delete_category', {
      p_id: id,
      p_reassign_to: reassignTo ?? null,
    });
    if (error) throw error; // RPC raises on preset / not-found — surfaces as error
  }

  // ---- CategoryRules -----------------------------------------------------
  async listCategoryRules(): Promise<CategoryRule[]> {
    const { data, error } = await this.sb.from('category_rules').select('*');
    if (error) throw error;
    return (data as CategoryRuleRow[] ?? []).map(rowToCategoryRule);
  }

  async upsertCategoryRule(r: CategoryRule): Promise<CategoryRule> {
    const { error } = await this.sb
      .from('category_rules')
      .upsert(categoryRuleToRow(r), { onConflict: 'user_id,id' });
    if (error) throw error;
    return r;
  }

  // ---- Settings ----------------------------------------------------------
  async getSettings(): Promise<Settings> {
    const { data, error } = await this.sb
      .from('settings')
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (!data) return { ...DEFAULT_SETTINGS };
    // Merge over defaults so a row written before a future settings field exists
    // forward-fills that field, matching LocalStorageRepository.getSettings.
    return { ...DEFAULT_SETTINGS, ...rowToSettings(data) };
  }

  async putSettings(s: Settings): Promise<Settings> {
    const { error } = await this.sb
      .from('settings')
      .upsert(settingsToRow(s), { onConflict: 'user_id' });
    if (error) throw error;
    return s;
  }

  // ---- Export ------------------------------------------------------------
  async exportAll(): Promise<ExportBundle> {
    const [expenses, categories, settings] = await Promise.all([
      this.listExpenses(),
      this.listCategories(),
      this.getSettings(),
    ]);
    return {
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      expenses,
      categories,
      settings,
    };
  }

  // ---- Wipe --------------------------------------------------------------
  async wipeAll(): Promise<void> {
    // RLS scopes every delete to auth.uid(); neq(user_id, ZERO_UUID) matches all
    // of the user's own rows. No FKs between these tables, so order is irrelevant.
    for (const table of ['expenses', 'budgets', 'category_rules', 'categories', 'settings'] as const) {
      const { error } = await this.sb.from(table).delete().neq('user_id', ZERO_UUID);
      if (error) throw error;
    }
  }
}
