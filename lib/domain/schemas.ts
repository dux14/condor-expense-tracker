import { z } from 'zod';
import type { Expense, Category, Settings, ExportBundle } from './types';

export const KNOWN_CURRENCIES: string[] = [
  'COP',
  'USD',
  'EUR',
  'MXN',
  'GBP',
  'BRL',
  'ARS',
  'CLP',
  'PEN',
  'CAD',
  'JPY',
];

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const expenseSchema = z.object({
  id: z.string(),
  amount: z.number().gt(0),
  currency: z.string(),
  baseAmount: z.number().nullable(),
  fxRate: z.number().nullable(),
  date: z.string().regex(DATE_REGEX),
  categoryId: z.string(),
  merchant: z.string().optional(),
  note: z.string().optional(),
  source: z.literal('manual'),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const categorySchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  icon: z.string(),
  isPreset: z.boolean(),
  hidden: z.boolean().optional(),
});

export const settingsSchema = z.object({
  baseCurrency: z.string(),
  locale: z.enum(['es', 'en']),
  theme: z.enum(['dark', 'light', 'auto']),
  dashboardView: z.enum(['bars', 'donut', 'treemap']),
  schemaVersion: z.number(),
});

export const exportBundleSchema = z.object({
  schemaVersion: z.number(),
  exportedAt: z.string(),
  expenses: z.array(expenseSchema),
  categories: z.array(categorySchema),
  settings: settingsSchema,
});

/**
 * Validates and parses an Expense input.
 * Unknown currencies (not in KNOWN_CURRENCIES) are allowed — a console.warn is emitted.
 * Throws ZodError for invalid data (amount <= 0, bad date, etc.).
 */
export function parseExpense(input: unknown): Expense {
  const result = expenseSchema.parse(input);
  if (!KNOWN_CURRENCIES.includes(result.currency)) {
    console.warn(
      `[parseExpense] Unknown currency "${result.currency}" — not in KNOWN_CURRENCIES. Proceeding anyway.`,
    );
  }
  return result as Expense;
}
