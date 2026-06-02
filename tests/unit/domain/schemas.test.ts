import { expenseSchema, categorySchema, settingsSchema, exportBundleSchema, parseExpense } from '@/lib/domain/schemas';
import type { Expense, Category, Settings, ExportBundle } from '@/lib/domain/types';

const validExpense: Expense = {
  id: 'abc-123',
  amount: 15000,
  currency: 'COP',
  baseAmount: 15000,
  fxRate: 1,
  date: '2026-06-01',
  categoryId: 'preset-comida',
  merchant: 'Restaurante La Mesa',
  note: 'Almuerzo',
  source: 'manual',
  createdAt: '2026-06-01T12:00:00.000Z',
  updatedAt: '2026-06-01T12:00:00.000Z',
};

const validCategory: Category = {
  id: 'preset-comida',
  name: 'Comida',
  color: '#C9B6FF',
  icon: 'comida',
  isPreset: true,
};

const validSettings: Settings = {
  baseCurrency: 'COP',
  locale: 'es',
  theme: 'auto',
  dashboardView: 'bars',
  schemaVersion: 1,
};

describe('expenseSchema', () => {
  it('parses a valid expense', () => {
    const result = expenseSchema.safeParse(validExpense);
    expect(result.success).toBe(true);
  });

  it('rejects amount = 0', () => {
    const result = expenseSchema.safeParse({ ...validExpense, amount: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects amount = -5', () => {
    const result = expenseSchema.safeParse({ ...validExpense, amount: -5 });
    expect(result.success).toBe(false);
  });

  it('rejects bad date format "2026/06/01"', () => {
    const result = expenseSchema.safeParse({ ...validExpense, date: '2026/06/01' });
    expect(result.success).toBe(false);
  });

  it('accepts null baseAmount and fxRate', () => {
    const result = expenseSchema.safeParse({ ...validExpense, baseAmount: null, fxRate: null });
    expect(result.success).toBe(true);
  });
});

describe('parseExpense', () => {
  it('parses a valid expense and returns the Expense object', () => {
    const result = parseExpense(validExpense);
    expect(result).toMatchObject({ id: 'abc-123', amount: 15000 });
  });

  it('allows unknown currency "XYZ" (does not throw)', () => {
    const input = { ...validExpense, currency: 'XYZ' };
    expect(() => parseExpense(input)).not.toThrow();
    const result = parseExpense(input);
    expect(result.currency).toBe('XYZ');
  });

  it('throws for amount = 0', () => {
    expect(() => parseExpense({ ...validExpense, amount: 0 })).toThrow();
  });
});

describe('categorySchema', () => {
  it('parses a valid category', () => {
    const result = categorySchema.safeParse(validCategory);
    expect(result.success).toBe(true);
  });
});

describe('settingsSchema', () => {
  it('parses valid settings', () => {
    const result = settingsSchema.safeParse(validSettings);
    expect(result.success).toBe(true);
  });
});

describe('exportBundleSchema', () => {
  it('parses a valid export bundle', () => {
    const bundle: ExportBundle = {
      schemaVersion: 1,
      exportedAt: '2026-06-01T12:00:00.000Z',
      expenses: [validExpense],
      categories: [validCategory],
      settings: validSettings,
    };
    const result = exportBundleSchema.safeParse(bundle);
    expect(result.success).toBe(true);
  });
});
