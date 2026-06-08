/**
 * supabase-mappers.ts
 *
 * Pure functions that convert between the camelCase domain types and the
 * snake_case DB rows stored in Supabase Postgres.  This is the single place
 * where every column name lives — no other file should hard-code column names.
 *
 * No Supabase client, no network, no side-effects.
 */

import type { Expense, Category, Settings } from '@/lib/domain/types';

// ── Row Types ─────────────────────────────────────────────────────────────────
// user_id is server-injected (auth.uid() default) and never appears in client
// row objects.

export interface ExpenseRow {
  id: string;
  amount: number;
  currency: string;
  base_amount: number | null;
  fx_rate: number | null;
  date: string;
  time: string | null;
  category_id: string;
  merchant: string | null;
  note: string | null;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface CategoryRow {
  id: string;
  name: string;
  color: string;
  icon: string;
  is_preset: boolean;
  hidden: boolean;
}

export interface SettingsRow {
  base_currency: string;
  locale: string;
  theme: string;
  dashboard_view: string;
  schema_version: number;
}

// ── Expense mappers ───────────────────────────────────────────────────────────

export function expenseToRow(expense: Expense): ExpenseRow {
  return {
    id: expense.id,
    amount: expense.amount,
    currency: expense.currency,
    base_amount: expense.baseAmount,
    fx_rate: expense.fxRate,
    date: expense.date,
    time: expense.time ?? null,
    category_id: expense.categoryId,
    merchant: expense.merchant ?? null,
    note: expense.note ?? null,
    source: expense.source,
    created_at: expense.createdAt,
    updated_at: expense.updatedAt,
  };
}

/** Normalise a Postgres timestamptz string (e.g. "…+00:00") to the `.000Z`
 *  format used throughout the domain layer. */
function normTs(ts: string): string {
  return new Date(ts).toISOString();
}

export function rowToExpense(row: ExpenseRow): Expense {
  const expense: Expense = {
    id: row.id,
    amount: row.amount,
    currency: row.currency,
    baseAmount: row.base_amount,
    fxRate: row.fx_rate,
    date: row.date,
    categoryId: row.category_id,
    source: row.source as Expense['source'],
    createdAt: normTs(row.created_at),
    updatedAt: normTs(row.updated_at),
  };

  // Only add optional keys when the value is present — toEqual deep-equality
  // requires the keys to be absent rather than holding `undefined`.
  if (row.time !== null) expense.time = row.time;
  if (row.merchant !== null) expense.merchant = row.merchant;
  if (row.note !== null) expense.note = row.note;

  return expense;
}

// ── Category mappers ──────────────────────────────────────────────────────────

export function categoryToRow(category: Category): CategoryRow {
  return {
    id: category.id,
    name: category.name,
    color: category.color,
    icon: category.icon,
    is_preset: category.isPreset,
    hidden: category.hidden ?? false,
  };
}

export function rowToCategory(row: CategoryRow): Category {
  const category: Category = {
    id: row.id,
    name: row.name,
    color: row.color,
    icon: row.icon,
    isPreset: row.is_preset,
  };

  // hidden: false means "not hidden" — omit the key so round-trip is deep-equal
  // to a domain Category that never had `hidden` set.
  if (row.hidden === true) category.hidden = true;

  return category;
}

// ── Settings mappers ──────────────────────────────────────────────────────────

export function settingsToRow(settings: Settings): SettingsRow {
  return {
    base_currency: settings.baseCurrency,
    locale: settings.locale,
    theme: settings.theme,
    dashboard_view: settings.dashboardView,
    schema_version: settings.schemaVersion,
  };
}

export function rowToSettings(row: SettingsRow): Settings {
  return {
    baseCurrency: row.base_currency as Settings['baseCurrency'],
    locale: row.locale as Settings['locale'],
    theme: row.theme as Settings['theme'],
    dashboardView: row.dashboard_view as Settings['dashboardView'],
    schemaVersion: row.schema_version,
  };
}
