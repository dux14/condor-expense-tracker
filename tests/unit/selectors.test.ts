import { describe, it, expect } from 'vitest';
import type { Expense, Category, Budget } from '@/lib/domain/types';
import { PRESET_CATEGORIES, OTROS_ID } from '@/lib/domain/presets';
import { todayKey, todayMonthKey } from '@/lib/format/date';
import {
  expensesInMonth,
  monthTotal,
  rankedByCategory,
  spendByDay,
  deltaVsPrevMonth,
  transactionsByDay,
  budgetProgress,
} from '@/lib/domain/selectors';

// ---------------------------------------------------------------------------
// Fixture helper
// ---------------------------------------------------------------------------
let _idCounter = 0;

function makeExpense(partial: Partial<Expense>): Expense {
  _idCounter += 1;
  const amount = partial.amount ?? 1000;
  return {
    id: `expense-${_idCounter}`,
    amount,
    currency: 'COP',
    baseAmount: amount,
    fxRate: 1,
    date: '2026-06-15',
    categoryId: 'preset-comida',
    source: 'manual',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...partial,
  };
}

// Deterministic category list for tests
const CATS: Category[] = PRESET_CATEGORIES;

// ---------------------------------------------------------------------------
// expensesInMonth
// ---------------------------------------------------------------------------
describe('expensesInMonth', () => {
  it('filters expenses that belong to the given month', () => {
    const expenses = [
      makeExpense({ date: '2026-06-01' }),
      makeExpense({ date: '2026-06-30' }),
      makeExpense({ date: '2026-07-01' }), // next month
      makeExpense({ date: '2026-05-31' }), // prev month
    ];
    const result = expensesInMonth(expenses, '2026-06');
    expect(result).toHaveLength(2);
    expect(result[0].date).toBe('2026-06-01');
    expect(result[1].date).toBe('2026-06-30');
  });

  it('preserves input order', () => {
    const expenses = [
      makeExpense({ date: '2026-06-20' }),
      makeExpense({ date: '2026-06-05' }),
      makeExpense({ date: '2026-06-15' }),
    ];
    const result = expensesInMonth(expenses, '2026-06');
    expect(result.map((e) => e.date)).toEqual(['2026-06-20', '2026-06-05', '2026-06-15']);
  });

  it('returns empty array when no expenses match', () => {
    const expenses = [makeExpense({ date: '2026-05-15' })];
    expect(expensesInMonth(expenses, '2026-06')).toHaveLength(0);
  });

  it('handles boundary correctly across month change', () => {
    const expenses = [
      makeExpense({ date: '2025-12-31' }),
      makeExpense({ date: '2026-01-01' }),
      makeExpense({ date: '2026-01-31' }),
      makeExpense({ date: '2026-02-01' }),
    ];
    const result = expensesInMonth(expenses, '2026-01');
    expect(result).toHaveLength(2);
    expect(result.map((e) => e.date)).toEqual(['2026-01-01', '2026-01-31']);
  });
});

// ---------------------------------------------------------------------------
// monthTotal
// ---------------------------------------------------------------------------
describe('monthTotal', () => {
  it('returns {0, 0} for empty expense list', () => {
    expect(monthTotal([], '2026-06')).toEqual({ totalBase: 0, unconvertedCount: 0 });
  });

  it('sums baseAmount for expenses in the given month', () => {
    const expenses = [
      makeExpense({ date: '2026-06-01', baseAmount: 1000 }),
      makeExpense({ date: '2026-06-15', baseAmount: 2500 }),
      makeExpense({ date: '2026-07-01', baseAmount: 500 }), // different month
    ];
    const { totalBase, unconvertedCount } = monthTotal(expenses, '2026-06');
    expect(totalBase).toBe(3500);
    expect(unconvertedCount).toBe(0);
  });

  it('skips null baseAmount and increments unconvertedCount', () => {
    const expenses = [
      makeExpense({ date: '2026-06-01', baseAmount: 1000 }),
      makeExpense({ date: '2026-06-10', baseAmount: null, fxRate: null }),
      makeExpense({ date: '2026-06-20', baseAmount: null, fxRate: null }),
    ];
    const { totalBase, unconvertedCount } = monthTotal(expenses, '2026-06');
    expect(totalBase).toBe(1000);
    expect(unconvertedCount).toBe(2);
  });

  it('all null baseAmounts → totalBase 0, unconvertedCount = all', () => {
    const expenses = [
      makeExpense({ date: '2026-06-01', baseAmount: null, fxRate: null }),
      makeExpense({ date: '2026-06-02', baseAmount: null, fxRate: null }),
    ];
    const { totalBase, unconvertedCount } = monthTotal(expenses, '2026-06');
    expect(totalBase).toBe(0);
    expect(unconvertedCount).toBe(2);
  });

  it('ignores expenses from other months when counting', () => {
    const expenses = [
      makeExpense({ date: '2026-05-01', baseAmount: null, fxRate: null }),
      makeExpense({ date: '2026-06-01', baseAmount: 500 }),
    ];
    const { totalBase, unconvertedCount } = monthTotal(expenses, '2026-06');
    expect(totalBase).toBe(500);
    expect(unconvertedCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// rankedByCategory
// ---------------------------------------------------------------------------
describe('rankedByCategory', () => {
  it('sorts categories descending by totalBase', () => {
    const expenses = [
      makeExpense({ date: '2026-06-01', categoryId: 'preset-comida', baseAmount: 5000 }),
      makeExpense({ date: '2026-06-01', categoryId: 'preset-transporte', baseAmount: 3000 }),
      makeExpense({ date: '2026-06-01', categoryId: 'preset-ocio', baseAmount: 8000 }),
    ];
    const result = rankedByCategory(expenses, CATS, '2026-06');
    expect(result[0].categoryId).toBe('preset-ocio');
    expect(result[1].categoryId).toBe('preset-comida');
    expect(result[2].categoryId).toBe('preset-transporte');
  });

  it('pct values sum to ~100', () => {
    const expenses = [
      makeExpense({ date: '2026-06-01', categoryId: 'preset-comida', baseAmount: 4000 }),
      makeExpense({ date: '2026-06-01', categoryId: 'preset-transporte', baseAmount: 6000 }),
    ];
    const result = rankedByCategory(expenses, CATS, '2026-06');
    const totalPct = result.reduce((s, r) => s + r.pct, 0);
    expect(totalPct).toBeCloseTo(100, 5);
  });

  it('folds tail into __rest__ when categories > topN (topN=2, 4 cats → 3 rows)', () => {
    const expenses = [
      makeExpense({ date: '2026-06-01', categoryId: 'preset-comida', baseAmount: 4000 }),
      makeExpense({ date: '2026-06-01', categoryId: 'preset-transporte', baseAmount: 3000 }),
      makeExpense({ date: '2026-06-01', categoryId: 'preset-ocio', baseAmount: 2000 }),
      makeExpense({ date: '2026-06-01', categoryId: 'preset-mercado', baseAmount: 1000 }),
    ];
    const result = rankedByCategory(expenses, CATS, '2026-06', 2);
    expect(result).toHaveLength(3);
    expect(result[0].categoryId).toBe('preset-comida');
    expect(result[1].categoryId).toBe('preset-transporte');
    expect(result[2].categoryId).toBe('__rest__');
    expect(result[2].totalBase).toBe(3000); // 2000 + 1000
  });

  it('__rest__ bucket pct is correct and total pct still sums to ~100', () => {
    const expenses = [
      makeExpense({ date: '2026-06-01', categoryId: 'preset-comida', baseAmount: 5000 }),
      makeExpense({ date: '2026-06-01', categoryId: 'preset-transporte', baseAmount: 3000 }),
      makeExpense({ date: '2026-06-01', categoryId: 'preset-ocio', baseAmount: 2000 }),
    ];
    const result = rankedByCategory(expenses, CATS, '2026-06', 2);
    expect(result).toHaveLength(3);
    expect(result[2].categoryId).toBe('__rest__');
    const totalPct = result.reduce((s, r) => s + r.pct, 0);
    expect(totalPct).toBeCloseTo(100, 5);
  });

  it('uses category name, color, and icon from the categories list', () => {
    const expenses = [
      makeExpense({ date: '2026-06-01', categoryId: 'preset-comida', baseAmount: 1000 }),
    ];
    const comidaCat = CATS.find((c) => c.id === 'preset-comida')!;
    const result = rankedByCategory(expenses, CATS, '2026-06');
    expect(result[0].name).toBe(comidaCat.name);
    expect(result[0].color).toBe(comidaCat.color);
    expect(result[0].icon).toBe(comidaCat.icon);
  });

  it('falls back to Otros preset for unknown categoryId', () => {
    const otrosPreset = PRESET_CATEGORIES.find((c) => c.id === OTROS_ID)!;
    const expenses = [
      makeExpense({ date: '2026-06-01', categoryId: 'custom-unknown', baseAmount: 1000 }),
    ];
    const result = rankedByCategory(expenses, CATS, '2026-06');
    expect(result[0].categoryId).toBe('custom-unknown');
    expect(result[0].color).toBe(otrosPreset.color);
    expect(result[0].icon).toBe(otrosPreset.icon);
    expect(result[0].name).toBe('Otros');
  });

  it('excludes categories with zero totalBase', () => {
    // Only one expense in this month; second cat has nothing
    const expenses = [
      makeExpense({ date: '2026-06-01', categoryId: 'preset-comida', baseAmount: 1000 }),
      makeExpense({ date: '2026-05-01', categoryId: 'preset-transporte', baseAmount: 500 }),
    ];
    const result = rankedByCategory(expenses, CATS, '2026-06');
    expect(result).toHaveLength(1);
    expect(result[0].categoryId).toBe('preset-comida');
  });

  it('tie-break is deterministic: same totalBase sorted by name asc', () => {
    const expenses = [
      makeExpense({ date: '2026-06-01', categoryId: 'preset-transporte', baseAmount: 1000 }),
      makeExpense({ date: '2026-06-01', categoryId: 'preset-comida', baseAmount: 1000 }),
    ];
    const result = rankedByCategory(expenses, CATS, '2026-06');
    // 'Comida' < 'Transporte' alphabetically
    expect(result[0].name).toBe('Comida');
    expect(result[1].name).toBe('Transporte');
  });

  it('returns empty array when there are no expenses in month', () => {
    expect(rankedByCategory([], CATS, '2026-06')).toEqual([]);
  });

  it('no folding when categories <= topN', () => {
    const expenses = [
      makeExpense({ date: '2026-06-01', categoryId: 'preset-comida', baseAmount: 1000 }),
      makeExpense({ date: '2026-06-01', categoryId: 'preset-transporte', baseAmount: 2000 }),
    ];
    const result = rankedByCategory(expenses, CATS, '2026-06', 6);
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.categoryId !== '__rest__')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// spendByDay
// ---------------------------------------------------------------------------
describe('spendByDay', () => {
  it('returns 30 entries for a 30-day month', () => {
    const result = spendByDay([], '2026-06');
    expect(result).toHaveLength(30);
    expect(result[0].day).toBe(1);
    expect(result[29].day).toBe(30);
  });

  it('returns 31 entries for a 31-day month', () => {
    const result = spendByDay([], '2026-01');
    expect(result).toHaveLength(31);
  });

  it('returns 28 entries for Feb 2026 (non-leap year)', () => {
    const result = spendByDay([], '2026-02');
    expect(result).toHaveLength(28);
  });

  it('returns 29 entries for Feb 2024 (leap year)', () => {
    const result = spendByDay([], '2024-02');
    expect(result).toHaveLength(29);
  });

  it('sums baseAmount per day, skips nulls', () => {
    const expenses = [
      makeExpense({ date: '2026-06-05', baseAmount: 1000 }),
      makeExpense({ date: '2026-06-05', baseAmount: 500 }),
      makeExpense({ date: '2026-06-05', baseAmount: null, fxRate: null }),
      makeExpense({ date: '2026-06-10', baseAmount: 2000 }),
    ];
    const result = spendByDay(expenses, '2026-06');
    expect(result[4].day).toBe(5);     // index 4 = day 5
    expect(result[4].totalBase).toBe(1500);
    expect(result[9].day).toBe(10);
    expect(result[9].totalBase).toBe(2000);
    // Other days are 0
    expect(result[0].totalBase).toBe(0);
  });

  it('isToday is false for a non-current month', () => {
    // Use a clearly historical month that is definitely not today
    const result = spendByDay([], '2020-01');
    expect(result.every((d) => d.isToday === false)).toBe(true);
  });

  it('isToday is true only at today index for current month', () => {
    const currentMonth = todayMonthKey();
    const todayStr = todayKey();
    const todayDayNum = parseInt(todayStr.slice(8, 10), 10);

    const result = spendByDay([], currentMonth);
    const todayEntry = result.find((d) => d.day === todayDayNum);
    expect(todayEntry?.isToday).toBe(true);

    const otherEntries = result.filter((d) => d.day !== todayDayNum);
    expect(otherEntries.every((d) => d.isToday === false)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// deltaVsPrevMonth
// ---------------------------------------------------------------------------
describe('deltaVsPrevMonth', () => {
  it('hasPrev false and pct 0 when no prior data', () => {
    const expenses = [makeExpense({ date: '2026-06-01', baseAmount: 1000 })];
    const result = deltaVsPrevMonth(expenses, '2026-06');
    expect(result.hasPrev).toBe(false);
    expect(result.pct).toBe(0);
  });

  it('computes positive delta correctly', () => {
    const expenses = [
      makeExpense({ date: '2026-05-01', baseAmount: 1000 }),
      makeExpense({ date: '2026-06-01', baseAmount: 1500 }),
    ];
    const result = deltaVsPrevMonth(expenses, '2026-06');
    expect(result.hasPrev).toBe(true);
    expect(result.pct).toBeCloseTo(50, 5); // (1500-1000)/1000 * 100
  });

  it('computes negative delta correctly', () => {
    const expenses = [
      makeExpense({ date: '2026-05-01', baseAmount: 2000 }),
      makeExpense({ date: '2026-06-01', baseAmount: 1000 }),
    ];
    const result = deltaVsPrevMonth(expenses, '2026-06');
    expect(result.hasPrev).toBe(true);
    expect(result.pct).toBeCloseTo(-50, 5); // (1000-2000)/2000 * 100
  });

  it('pct is 0 when prevTotal is 0 (but hasPrev is true)', () => {
    // prev month has an expense but all null baseAmounts → totalBase 0
    const expenses = [
      makeExpense({ date: '2026-05-01', baseAmount: null, fxRate: null }),
      makeExpense({ date: '2026-06-01', baseAmount: 1000 }),
    ];
    const result = deltaVsPrevMonth(expenses, '2026-06');
    expect(result.hasPrev).toBe(true);
    expect(result.pct).toBe(0);
  });

  it('handles year-boundary month transition (Jan → prev is Dec)', () => {
    const expenses = [
      makeExpense({ date: '2025-12-15', baseAmount: 2000 }),
      makeExpense({ date: '2026-01-15', baseAmount: 3000 }),
    ];
    const result = deltaVsPrevMonth(expenses, '2026-01');
    expect(result.hasPrev).toBe(true);
    expect(result.pct).toBeCloseTo(50, 5);
  });
});

// ---------------------------------------------------------------------------
// transactionsByDay
// ---------------------------------------------------------------------------
describe('transactionsByDay', () => {
  it('groups expenses by day string', () => {
    const expenses = [
      makeExpense({ date: '2026-06-10', createdAt: '2026-06-10T10:00:00.000Z' }),
      makeExpense({ date: '2026-06-10', createdAt: '2026-06-10T12:00:00.000Z' }),
      makeExpense({ date: '2026-06-05', createdAt: '2026-06-05T08:00:00.000Z' }),
    ];
    const result = transactionsByDay(expenses, CATS, '2026-06');
    expect(result).toHaveLength(2);
  });

  it('sorts groups by day DESC (most recent day first)', () => {
    const expenses = [
      makeExpense({ date: '2026-06-05', createdAt: '2026-06-05T08:00:00.000Z' }),
      makeExpense({ date: '2026-06-10', createdAt: '2026-06-10T10:00:00.000Z' }),
      makeExpense({ date: '2026-06-20', createdAt: '2026-06-20T09:00:00.000Z' }),
    ];
    const result = transactionsByDay(expenses, CATS, '2026-06');
    expect(result[0].day).toBe('2026-06-20');
    expect(result[1].day).toBe('2026-06-10');
    expect(result[2].day).toBe('2026-06-05');
  });

  it('sorts rows within a day by createdAt DESC', () => {
    const expenses = [
      makeExpense({ date: '2026-06-10', createdAt: '2026-06-10T08:00:00.000Z' }),
      makeExpense({ date: '2026-06-10', createdAt: '2026-06-10T20:00:00.000Z' }),
      makeExpense({ date: '2026-06-10', createdAt: '2026-06-10T14:00:00.000Z' }),
    ];
    const result = transactionsByDay(expenses, CATS, '2026-06');
    const times = result[0].rows.map((r) => r.expense.createdAt);
    expect(times[0]).toBe('2026-06-10T20:00:00.000Z');
    expect(times[1]).toBe('2026-06-10T14:00:00.000Z');
    expect(times[2]).toBe('2026-06-10T08:00:00.000Z');
  });

  it('resolves category from categories list', () => {
    const comidaCat = CATS.find((c) => c.id === 'preset-comida')!;
    const expenses = [
      makeExpense({ date: '2026-06-10', categoryId: 'preset-comida' }),
    ];
    const result = transactionsByDay(expenses, CATS, '2026-06');
    expect(result[0].rows[0].category.id).toBe('preset-comida');
    expect(result[0].rows[0].category.name).toBe(comidaCat.name);
  });

  it('falls back to synthetic Otros category when categoryId is unknown', () => {
    const otrosPreset = PRESET_CATEGORIES.find((c) => c.id === OTROS_ID)!;
    const expenses = [
      makeExpense({ date: '2026-06-10', categoryId: 'custom-mystery' }),
    ];
    const result = transactionsByDay(expenses, CATS, '2026-06');
    const cat = result[0].rows[0].category;
    // id should be the expense's original categoryId
    expect(cat.id).toBe('custom-mystery');
    expect(cat.color).toBe(otrosPreset.color);
    expect(cat.icon).toBe(otrosPreset.icon);
  });

  it('only includes expenses from the given month', () => {
    const expenses = [
      makeExpense({ date: '2026-05-31', createdAt: '2026-05-31T10:00:00.000Z' }),
      makeExpense({ date: '2026-06-01', createdAt: '2026-06-01T10:00:00.000Z' }),
    ];
    const result = transactionsByDay(expenses, CATS, '2026-06');
    expect(result).toHaveLength(1);
    expect(result[0].day).toBe('2026-06-01');
  });

  it('returns empty array when no expenses in month', () => {
    expect(transactionsByDay([], CATS, '2026-06')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// budgetProgress
// ---------------------------------------------------------------------------

function makeBudget(over: Partial<Budget> = {}): Budget {
  return {
    id: `budget-${Math.random().toString(36).slice(2)}`,
    categoryId: 'preset-comida',
    amountBase: 100000,
    period: 'monthly',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

describe('budgetProgress', () => {
  it('returns [] when there are no budgets', () => {
    const expenses = [makeExpense({ date: '2026-06-10', amount: 5000 })];
    expect(budgetProgress(expenses, [], '2026-06')).toEqual([]);
  });

  it('emits no row for a category that has no budget (quiet UI)', () => {
    const expenses = [makeExpense({ categoryId: 'preset-comida', date: '2026-06-10' })];
    const budgets = [makeBudget({ categoryId: 'preset-transporte' })];
    const rows = budgetProgress(expenses, budgets, '2026-06');
    expect(rows.map((r) => r.categoryId)).toEqual(['preset-transporte']);
    expect(rows[0].spentBase).toBe(0); // budgeted category with zero spend still shows
  });

  it('computes spent/budget/pct/over for a month WITH expenses', () => {
    const expenses = [
      makeExpense({ categoryId: 'preset-comida', date: '2026-06-05', baseAmount: 30000, amount: 30000 }),
      makeExpense({ categoryId: 'preset-comida', date: '2026-06-20', baseAmount: 20000, amount: 20000 }),
      makeExpense({ categoryId: 'preset-comida', date: '2026-05-31', baseAmount: 99999, amount: 99999 }), // prev month — excluded
    ];
    const budgets = [makeBudget({ categoryId: 'preset-comida', amountBase: 100000 })];
    const [row] = budgetProgress(expenses, budgets, '2026-06');
    expect(row).toEqual({ categoryId: 'preset-comida', spentBase: 50000, budgetBase: 100000, pct: 50, over: false });
  });

  it('a month with NO expenses yields spent=0, pct=0, not over', () => {
    const budgets = [makeBudget({ categoryId: 'preset-comida', amountBase: 100000 })];
    const [row] = budgetProgress([], budgets, '2026-06');
    expect(row).toEqual({ categoryId: 'preset-comida', spentBase: 0, budgetBase: 100000, pct: 0, over: false });
  });

  it('spend exactly equal to budget (100%) is NOT over', () => {
    const expenses = [makeExpense({ categoryId: 'preset-comida', date: '2026-06-10', baseAmount: 100000, amount: 100000 })];
    const budgets = [makeBudget({ categoryId: 'preset-comida', amountBase: 100000 })];
    const [row] = budgetProgress(expenses, budgets, '2026-06');
    expect(row.pct).toBe(100);
    expect(row.over).toBe(false);
  });

  it('spend above budget marks over and pct can exceed 100 (not clamped)', () => {
    const expenses = [makeExpense({ categoryId: 'preset-comida', date: '2026-06-10', baseAmount: 180000, amount: 180000 })];
    const budgets = [makeBudget({ categoryId: 'preset-comida', amountBase: 100000 })];
    const [row] = budgetProgress(expenses, budgets, '2026-06');
    expect(row.pct).toBe(180);
    expect(row.over).toBe(true);
  });

  it('budgetBase === 0: pct is 0, over only when something was spent', () => {
    const zeroBudget = [makeBudget({ categoryId: 'preset-comida', amountBase: 0 })];
    expect(budgetProgress([], zeroBudget, '2026-06')[0]).toMatchObject({ pct: 0, over: false });
    const spent = [makeExpense({ categoryId: 'preset-comida', date: '2026-06-10', baseAmount: 10, amount: 10 })];
    expect(budgetProgress(spent, zeroBudget, '2026-06')[0]).toMatchObject({ pct: 0, over: true });
  });

  it('skips expenses with null baseAmount when summing spent', () => {
    const expenses = [
      makeExpense({ categoryId: 'preset-comida', date: '2026-06-10', baseAmount: 40000, amount: 40000 }),
      makeExpense({ categoryId: 'preset-comida', date: '2026-06-11', baseAmount: null, amount: 5, currency: 'USD', fxRate: null }),
    ];
    const budgets = [makeBudget({ categoryId: 'preset-comida', amountBase: 100000 })];
    expect(budgetProgress(expenses, budgets, '2026-06')[0].spentBase).toBe(40000);
  });

  it('dedupes multiple budgets for the same category, keeping the newest updatedAt', () => {
    const budgets = [
      makeBudget({ categoryId: 'preset-comida', amountBase: 100000, updatedAt: '2026-01-01T00:00:00.000Z' }),
      makeBudget({ categoryId: 'preset-comida', amountBase: 200000, updatedAt: '2026-06-01T00:00:00.000Z' }),
    ];
    const rows = budgetProgress([], budgets, '2026-06');
    expect(rows).toHaveLength(1);
    expect(rows[0].budgetBase).toBe(200000);
  });

  it('output is sorted by categoryId asc', () => {
    const budgets = [
      makeBudget({ categoryId: 'preset-transporte' }),
      makeBudget({ categoryId: 'preset-comida' }),
    ];
    expect(budgetProgress([], budgets, '2026-06').map((r) => r.categoryId))
      .toEqual(['preset-comida', 'preset-transporte']);
  });
});
