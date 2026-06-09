import { describe, it, expect } from 'vitest';
import {
  expenseToRow,
  rowToExpense,
  categoryToRow,
  rowToCategory,
  settingsToRow,
  rowToSettings,
  categoryRuleToRow,
  rowToCategoryRule,
  budgetToRow,
  rowToBudget,
} from '@/lib/data/supabase-mappers';
import type { ExpenseRow, CategoryRow, SettingsRow, CategoryRuleRow } from '@/lib/data/supabase-mappers';
import type { Expense, Category, Settings, CategoryRule, Budget } from '@/lib/domain/types';
import { PRESET_CATEGORIES } from '@/lib/domain/presets';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 'exp-1',
    amount: 10000,
    currency: 'COP',
    baseAmount: 10000,
    fxRate: 1,
    date: '2026-01-01',
    categoryId: 'preset-comida',
    source: 'manual',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const DEFAULT_SETTINGS: Settings = {
  baseCurrency: 'COP',
  locale: 'es',
  theme: 'auto',
  dashboardView: 'bars',
  schemaVersion: 1,
};

// ── round-trip edge cases (regression guards) ───────────────────────────────

describe('round-trip edge cases', () => {
  it('preserves 0-valued baseAmount and fxRate (guards ?? against ||)', () => {
    const expense = makeExpense({ baseAmount: 0, fxRate: 0 });
    expect(rowToExpense(expenseToRow(expense))).toEqual(expense);
  });

  it('preserves empty-string merchant/note/time as present keys', () => {
    const expense = makeExpense({ merchant: '', note: '', time: '' });
    const round = rowToExpense(expenseToRow(expense));
    expect(round).toEqual(expense);
    expect(round.merchant).toBe('');
    expect(round.note).toBe('');
    expect(round.time).toBe('');
  });

  it('rowToExpense normalises Postgres "+00:00" timestamps to ".000Z"', () => {
    // Postgres returns timestamptz as e.g. "2026-01-01T00:00:00+00:00";
    // the domain layer uses the ".000Z" form everywhere.
    const row: ExpenseRow = {
      ...expenseToRow(makeExpense()),
      created_at: '2026-01-01T00:00:00+00:00',
      updated_at: '2026-03-15T08:30:00+00:00',
    };
    const expense = rowToExpense(row);
    expect(expense.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(expense.updatedAt).toBe('2026-03-15T08:30:00.000Z');
  });
});

// ── expenseToRow ──────────────────────────────────────────────────────────────

describe('expenseToRow', () => {
  it('maps camelCase keys to snake_case DB columns', () => {
    const expense = makeExpense();
    const row = expenseToRow(expense);

    expect(row.category_id).toBe('preset-comida');
    expect(row.base_amount).toBe(10000);
    expect(row.fx_rate).toBe(1);
    expect(row.created_at).toBe('2026-01-01T00:00:00.000Z');
    expect(row.updated_at).toBe('2026-01-01T00:00:00.000Z');
  });

  it('keeps id, amount, currency, date, source unchanged', () => {
    const expense = makeExpense();
    const row = expenseToRow(expense);

    expect(row.id).toBe('exp-1');
    expect(row.amount).toBe(10000);
    expect(row.currency).toBe('COP');
    expect(row.date).toBe('2026-01-01');
    expect(row.source).toBe('manual');
  });

  it('maps undefined time to null', () => {
    const expense = makeExpense(); // no time field
    const row = expenseToRow(expense);
    expect(row.time).toBeNull();
  });

  it('maps present time through', () => {
    const expense = makeExpense({ time: '14:30' });
    const row = expenseToRow(expense);
    expect(row.time).toBe('14:30');
  });

  it('maps undefined merchant to null', () => {
    const expense = makeExpense();
    const row = expenseToRow(expense);
    expect(row.merchant).toBeNull();
  });

  it('maps present merchant through', () => {
    const expense = makeExpense({ merchant: 'Tienda Local' });
    const row = expenseToRow(expense);
    expect(row.merchant).toBe('Tienda Local');
  });

  it('maps undefined note to null', () => {
    const expense = makeExpense();
    const row = expenseToRow(expense);
    expect(row.note).toBeNull();
  });

  it('maps present note through', () => {
    const expense = makeExpense({ note: 'Some note' });
    const row = expenseToRow(expense);
    expect(row.note).toBe('Some note');
  });

  it('maps baseAmount null straight through to base_amount', () => {
    const expense = makeExpense({ baseAmount: null, fxRate: null });
    const row = expenseToRow(expense);
    expect(row.base_amount).toBeNull();
    expect(row.fx_rate).toBeNull();
  });

  it('does NOT include user_id', () => {
    const expense = makeExpense();
    const row = expenseToRow(expense);
    expect('user_id' in row).toBe(false);
  });

  it('does NOT include camelCase keys (categoryId etc.)', () => {
    const expense = makeExpense();
    const row = expenseToRow(expense);
    expect('categoryId' in row).toBe(false);
    expect('baseAmount' in row).toBe(false);
    expect('fxRate' in row).toBe(false);
    expect('createdAt' in row).toBe(false);
    expect('updatedAt' in row).toBe(false);
  });
});

// ── rowToExpense ──────────────────────────────────────────────────────────────

describe('rowToExpense', () => {
  it('round-trips a full expense through toRow → toExpense', () => {
    const original = makeExpense({ time: '14:30', merchant: 'Shop', note: 'birthday' });
    const row = expenseToRow(original);
    const recovered = rowToExpense(row);
    expect(recovered).toEqual(original);
  });

  it('round-trips a minimal expense (no optional fields)', () => {
    const original = makeExpense(); // no time, merchant, note
    const row = expenseToRow(original);
    const recovered = rowToExpense(row);
    expect(recovered).toEqual(original);
  });

  it('maps null time in row to undefined (key absent) in expense', () => {
    const row = expenseToRow(makeExpense());
    expect(row.time).toBeNull();
    const recovered = rowToExpense(row);
    expect(recovered.time).toBeUndefined();
  });

  it('maps null merchant in row to undefined in expense', () => {
    const row = expenseToRow(makeExpense());
    const recovered = rowToExpense(row);
    expect(recovered.merchant).toBeUndefined();
  });

  it('maps null note in row to undefined in expense', () => {
    const row = expenseToRow(makeExpense());
    const recovered = rowToExpense(row);
    expect(recovered.note).toBeUndefined();
  });

  it('casts source to Expense["source"]', () => {
    const row = expenseToRow(makeExpense());
    const recovered = rowToExpense(row);
    expect(recovered.source).toBe('manual');
  });

  it('maps snake_case columns back to camelCase domain fields', () => {
    const row = expenseToRow(makeExpense());
    const recovered = rowToExpense(row);
    expect(recovered.categoryId).toBe('preset-comida');
    expect(recovered.baseAmount).toBe(10000);
    expect(recovered.fxRate).toBe(1);
    expect(recovered.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(recovered.updatedAt).toBe('2026-01-01T00:00:00.000Z');
  });
});

// ── categoryToRow ─────────────────────────────────────────────────────────────

describe('categoryToRow', () => {
  it('maps isPreset → is_preset', () => {
    const cat: Category = { id: 'c1', name: 'Food', color: '#f00', icon: 'comida', isPreset: true };
    const row = categoryToRow(cat);
    expect(row.is_preset).toBe(true);
    expect('isPreset' in row).toBe(false);
  });

  it('maps hidden: undefined to false in the row', () => {
    const cat: Category = { id: 'c1', name: 'Food', color: '#f00', icon: 'comida', isPreset: false };
    const row = categoryToRow(cat);
    expect(row.hidden).toBe(false);
  });

  it('maps hidden: true through as true', () => {
    const cat: Category = { id: 'c1', name: 'Food', color: '#f00', icon: 'comida', isPreset: true, hidden: true };
    const row = categoryToRow(cat);
    expect(row.hidden).toBe(true);
  });

  it('does NOT emit user_id', () => {
    const cat: Category = { id: 'c1', name: 'Food', color: '#f00', icon: 'comida', isPreset: false };
    const row = categoryToRow(cat);
    expect('user_id' in row).toBe(false);
  });

  it('includes id, name, color, icon', () => {
    const cat: Category = { id: 'c1', name: 'Food', color: '#f00', icon: 'comida', isPreset: false };
    const row = categoryToRow(cat);
    expect(row.id).toBe('c1');
    expect(row.name).toBe('Food');
    expect(row.color).toBe('#f00');
    expect(row.icon).toBe('comida');
  });
});

// ── rowToCategory ─────────────────────────────────────────────────────────────

describe('rowToCategory', () => {
  it('maps is_preset → isPreset', () => {
    const row: CategoryRow = { id: 'c1', name: 'Food', color: '#f00', icon: 'comida', is_preset: true, hidden: false };
    const cat = rowToCategory(row);
    expect(cat.isPreset).toBe(true);
    expect('is_preset' in cat).toBe(false);
  });

  it('maps hidden: false in row → hidden: undefined in Category', () => {
    const row: CategoryRow = { id: 'c1', name: 'Food', color: '#f00', icon: 'comida', is_preset: false, hidden: false };
    const cat = rowToCategory(row);
    expect(cat.hidden).toBeUndefined();
  });

  it('maps hidden: true in row → hidden: true in Category', () => {
    const row: CategoryRow = { id: 'c1', name: 'Food', color: '#f00', icon: 'comida', is_preset: true, hidden: true };
    const cat = rowToCategory(row);
    expect(cat.hidden).toBe(true);
  });

  it('drops created_at and updated_at from the row', () => {
    const row = {
      id: 'c1',
      name: 'Food',
      color: '#f00',
      icon: 'comida',
      is_preset: false,
      hidden: false,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    };
    const cat = rowToCategory(row as CategoryRow);
    expect('created_at' in cat).toBe(false);
    expect('updated_at' in cat).toBe(false);
  });

  it('round-trips a preset category (hidden absent → false in row → absent in domain)', () => {
    // A preset category from domain (no hidden key)
    const preset = PRESET_CATEGORIES[0]; // isPreset: true, no hidden
    const row = categoryToRow(preset);
    expect(row.hidden).toBe(false); // default
    const recovered = rowToCategory(row);
    expect(recovered).toEqual(preset);
  });

  it('round-trips a custom category with hidden: true', () => {
    const cat: Category = { id: 'cat-1', name: 'Hidden Cat', color: '#000', icon: 'otros', isPreset: true, hidden: true };
    const row = categoryToRow(cat);
    const recovered = rowToCategory(row);
    expect(recovered).toEqual(cat);
  });
});

// ── settingsToRow ─────────────────────────────────────────────────────────────

describe('settingsToRow', () => {
  it('maps baseCurrency → base_currency', () => {
    const row = settingsToRow(DEFAULT_SETTINGS);
    expect(row.base_currency).toBe('COP');
    expect('baseCurrency' in row).toBe(false);
  });

  it('maps dashboardView → dashboard_view', () => {
    const row = settingsToRow(DEFAULT_SETTINGS);
    expect(row.dashboard_view).toBe('bars');
    expect('dashboardView' in row).toBe(false);
  });

  it('maps schemaVersion → schema_version', () => {
    const row = settingsToRow(DEFAULT_SETTINGS);
    expect(row.schema_version).toBe(1);
    expect('schemaVersion' in row).toBe(false);
  });

  it('keeps locale and theme unchanged', () => {
    const row = settingsToRow(DEFAULT_SETTINGS);
    expect(row.locale).toBe('es');
    expect(row.theme).toBe('auto');
  });

  it('does NOT emit user_id', () => {
    const row = settingsToRow(DEFAULT_SETTINGS);
    expect('user_id' in row).toBe(false);
  });
});

// ── rowToSettings ─────────────────────────────────────────────────────────────

describe('rowToSettings', () => {
  it('maps base_currency → baseCurrency', () => {
    const row = settingsToRow(DEFAULT_SETTINGS);
    const settings = rowToSettings(row);
    expect(settings.baseCurrency).toBe('COP');
    expect('base_currency' in settings).toBe(false);
  });

  it('maps dashboard_view → dashboardView', () => {
    const row = settingsToRow(DEFAULT_SETTINGS);
    const settings = rowToSettings(row);
    expect(settings.dashboardView).toBe('bars');
    expect('dashboard_view' in settings).toBe(false);
  });

  it('maps schema_version → schemaVersion', () => {
    const row = settingsToRow(DEFAULT_SETTINGS);
    const settings = rowToSettings(row);
    expect(settings.schemaVersion).toBe(1);
    expect('schema_version' in settings).toBe(false);
  });

  it('round-trips settings through toRow → toSettings', () => {
    const settings: Settings = {
      baseCurrency: 'USD',
      locale: 'en',
      theme: 'dark',
      dashboardView: 'donut',
      schemaVersion: 1,
    };
    const row = settingsToRow(settings);
    const recovered = rowToSettings(row);
    expect(recovered).toEqual(settings);
  });
});

// ── ExpenseRow type check (structural) ───────────────────────────────────────

describe('ExpenseRow type', () => {
  it('has the expected snake_case shape', () => {
    const expense = makeExpense({ time: '10:00', merchant: 'M', note: 'N' });
    const row: ExpenseRow = expenseToRow(expense);
    // These assertions prove the type has these keys at runtime
    expect(typeof row.category_id).toBe('string');
    expect(typeof row.base_amount).toBe('number');
    expect(typeof row.fx_rate).toBe('number');
    expect(typeof row.created_at).toBe('string');
    expect(typeof row.updated_at).toBe('string');
  });
});

// ── categoryRuleToRow ─────────────────────────────────────────────────────────

describe('categoryRuleToRow', () => {
  it('maps categoryId → category_id and omits user_id', () => {
    const rule: CategoryRule = { id: 'r1', pattern: 'UBER', categoryId: 'preset-transporte' };
    const row = categoryRuleToRow(rule);
    expect(row).toEqual({ id: 'r1', pattern: 'UBER', category_id: 'preset-transporte' });
    expect('user_id' in row).toBe(false);
  });

  it('does NOT include created_at or updated_at', () => {
    const rule: CategoryRule = { id: 'r1', pattern: 'UBER', categoryId: 'preset-transporte' };
    const row = categoryRuleToRow(rule);
    expect('created_at' in row).toBe(false);
    expect('updated_at' in row).toBe(false);
  });
});

// ── rowToCategoryRule ─────────────────────────────────────────────────────────

describe('rowToCategoryRule', () => {
  it('maps category_id → categoryId (exact inverse of categoryRuleToRow)', () => {
    const rule: CategoryRule = { id: 'r1', pattern: 'UBER', categoryId: 'preset-transporte' };
    const row = categoryRuleToRow(rule);
    const recovered = rowToCategoryRule(row);
    expect(recovered).toEqual(rule);
  });

  it('drops created_at and updated_at from the row', () => {
    const row: CategoryRuleRow = {
      id: 'r1',
      pattern: 'UBER',
      category_id: 'preset-transporte',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    };
    const rule = rowToCategoryRule(row);
    expect('created_at' in rule).toBe(false);
    expect('updated_at' in rule).toBe(false);
  });
});

// ── Budget mappers ───────────────────────────────────────────────────────────

function makeBudget(over: Partial<Budget> = {}): Budget {
  return {
    id: 'b1',
    categoryId: 'preset-comida',
    amountBase: 500000,
    period: 'monthly',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...over,
  };
}

describe('budget mappers', () => {
  it('budgetToRow maps camelCase → snake_case and omits user_id', () => {
    const row = budgetToRow(makeBudget());
    expect(row).toEqual({
      id: 'b1',
      category_id: 'preset-comida',
      amount_base: 500000,
      period: 'monthly',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-02T00:00:00.000Z',
    });
    expect('user_id' in row).toBe(false);
  });

  it('rowToBudget is the exact inverse (round-trip)', () => {
    const b = makeBudget();
    expect(rowToBudget(budgetToRow(b))).toEqual(b);
  });

  it('rowToBudget normalizes timestamptz (+00:00) to canonical .000Z', () => {
    const b = rowToBudget({
      id: 'b9', category_id: 'preset-comida', amount_base: 100, period: 'monthly',
      created_at: '2026-03-01T05:00:00+00:00', updated_at: '2026-03-02T05:00:00+00:00',
    });
    expect(b.createdAt).toBe('2026-03-01T05:00:00.000Z');
    expect(b.updatedAt).toBe('2026-03-02T05:00:00.000Z');
  });
});
