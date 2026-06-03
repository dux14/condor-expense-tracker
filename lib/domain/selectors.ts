import type { Expense, Category } from './types';
import { PRESET_CATEGORIES, OTROS_ID } from './presets';
import {
  daysInMonth,
  prevMonthKey,
  isInMonth,
  todayKey,
  todayMonthKey,
} from '@/lib/format/date';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Look up the Otros preset (cached reference). */
function otrosPreset(): Category {
  return PRESET_CATEGORIES.find((c) => c.id === OTROS_ID)!;
}

/**
 * Resolve a category by id from the provided list.
 * Falls back to a synthetic Category derived from the Otros preset.
 * The synthetic category keeps the original categoryId so callers can
 * still identify which expense it came from.
 */
function resolveCategory(categoryId: string, categories: Category[]): Category {
  const found = categories.find((c) => c.id === categoryId);
  if (found) return found;
  const otros = otrosPreset();
  return {
    id: categoryId,
    name: 'Otros',
    color: otros.color,
    icon: otros.icon,
    isPreset: false,
  };
}

// ---------------------------------------------------------------------------
// expensesInMonth
// ---------------------------------------------------------------------------

/**
 * Returns expenses whose date falls within the given month key ('yyyy-MM').
 * Preserves input order.
 */
export function expensesInMonth(expenses: Expense[], month: string): Expense[] {
  return expenses.filter((e) => isInMonth(e.date, month));
}

// ---------------------------------------------------------------------------
// monthTotal
// ---------------------------------------------------------------------------

export interface MonthTotalResult {
  totalBase: number;
  unconvertedCount: number;
}

/**
 * Sums baseAmount for all expenses in the given month.
 * Expenses with baseAmount === null are skipped from the sum and counted
 * in unconvertedCount.
 */
export function monthTotal(expenses: Expense[], month: string): MonthTotalResult {
  const inMonth = expensesInMonth(expenses, month);
  let totalBase = 0;
  let unconvertedCount = 0;
  for (const e of inMonth) {
    if (e.baseAmount === null) {
      unconvertedCount += 1;
    } else {
      totalBase += e.baseAmount;
    }
  }
  return { totalBase, unconvertedCount };
}

// ---------------------------------------------------------------------------
// rankedByCategory
// ---------------------------------------------------------------------------

export interface RankedCategoryRow {
  categoryId: string;
  name: string;
  color: string;
  icon: string;
  totalBase: number;
  pct: number;
}

/**
 * Groups month expenses by category, sums converted amounts, resolves
 * display attributes, sorts descending (tie-break name asc), computes pct,
 * and optionally folds the tail into a '__rest__' bucket when there are more
 * than topN categories.
 */
export function rankedByCategory(
  expenses: Expense[],
  categories: Category[],
  month: string,
  topN = 6,
): RankedCategoryRow[] {
  const inMonth = expensesInMonth(expenses, month);

  // Accumulate totalBase per categoryId, skip null baseAmounts
  const totals = new Map<string, number>();
  for (const e of inMonth) {
    if (e.baseAmount === null) continue;
    totals.set(e.categoryId, (totals.get(e.categoryId) ?? 0) + e.baseAmount);
  }

  // Build rows, exclude zero-total categories
  const rows: RankedCategoryRow[] = [];
  for (const [categoryId, totalBase] of totals) {
    if (totalBase <= 0) continue;
    const cat = resolveCategory(categoryId, categories);
    rows.push({
      categoryId,
      name: cat.name,
      color: cat.color,
      icon: cat.icon,
      totalBase,
      pct: 0, // computed below
    });
  }

  if (rows.length === 0) return [];

  // Sort: desc by totalBase; tie-break by name asc (deterministic)
  rows.sort((a, b) => {
    if (b.totalBase !== a.totalBase) return b.totalBase - a.totalBase;
    return a.name.localeCompare(b.name);
  });

  // Compute total for pct denominator
  const grandTotal = rows.reduce((s, r) => s + r.totalBase, 0);

  // Assign pct before potential folding
  for (const row of rows) {
    row.pct = grandTotal > 0 ? (row.totalBase / grandTotal) * 100 : 0;
  }

  // Fold tail into __rest__ when there are more rows than topN
  if (rows.length > topN) {
    const kept = rows.slice(0, topN);
    const tail = rows.slice(topN);
    const restTotal = tail.reduce((s, r) => s + r.totalBase, 0);
    const otros = otrosPreset();
    const restPct = grandTotal > 0 ? (restTotal / grandTotal) * 100 : 0;
    kept.push({
      categoryId: '__rest__',
      name: otros.name,
      color: otros.color,
      icon: otros.icon,
      totalBase: restTotal,
      pct: restPct,
    });
    return kept;
  }

  return rows;
}

// ---------------------------------------------------------------------------
// spendByDay
// ---------------------------------------------------------------------------

export interface SpendByDayRow {
  day: number;
  totalBase: number;
  isToday: boolean;
}

/**
 * Returns one entry per calendar day in the month.
 * totalBase = sum of baseAmount (null skipped) for expenses on that day.
 * isToday = true only when month is the current month AND day is today.
 */
export function spendByDay(expenses: Expense[], month: string): SpendByDayRow[] {
  const numDays = daysInMonth(month);
  const inMonth = expensesInMonth(expenses, month);
  const currentMonthKey = todayMonthKey();
  const todayStr = todayKey();
  const todayDayNum = parseInt(todayStr.slice(8, 10), 10);

  // Accumulate per day (1-indexed)
  const totals: number[] = new Array(numDays + 1).fill(0); // index 1..n
  for (const e of inMonth) {
    if (e.baseAmount === null) continue;
    const day = parseInt(e.date.slice(8, 10), 10);
    totals[day] += e.baseAmount;
  }

  const result: SpendByDayRow[] = [];
  for (let day = 1; day <= numDays; day++) {
    result.push({
      day,
      totalBase: totals[day],
      isToday: month === currentMonthKey && day === todayDayNum,
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// deltaVsPrevMonth
// ---------------------------------------------------------------------------

export interface DeltaResult {
  pct: number;
  hasPrev: boolean;
}

/**
 * Computes the percentage change in spending from the previous month to the
 * given month. hasPrev is true if there are any expenses in the previous
 * month. If prevTotal is 0 or hasPrev is false, pct is 0.
 */
export function deltaVsPrevMonth(expenses: Expense[], month: string): DeltaResult {
  const prev = prevMonthKey(month);
  const prevExpenses = expensesInMonth(expenses, prev);
  const hasPrev = prevExpenses.length > 0;

  if (!hasPrev) return { pct: 0, hasPrev: false };

  const curTotal = monthTotal(expenses, month).totalBase;
  const prevTotal = monthTotal(expenses, prev).totalBase;

  if (prevTotal === 0) return { pct: 0, hasPrev: true };

  const pct = ((curTotal - prevTotal) / prevTotal) * 100;
  return { pct, hasPrev: true };
}

// ---------------------------------------------------------------------------
// transactionsByDay
// ---------------------------------------------------------------------------

export interface TransactionRow {
  expense: Expense;
  category: Category;
}

export interface TransactionDayGroup {
  day: string; // 'yyyy-MM-dd'
  rows: TransactionRow[];
}

/**
 * Groups month expenses by date string ('yyyy-MM-dd').
 * Within a day, rows are sorted by createdAt DESC.
 * Groups are sorted by day DESC (most recent first).
 * Category is resolved; unknown ids fall back to a synthetic Otros category
 * that keeps the original categoryId.
 */
export function transactionsByDay(
  expenses: Expense[],
  categories: Category[],
  month: string,
): TransactionDayGroup[] {
  const inMonth = expensesInMonth(expenses, month);

  if (inMonth.length === 0) return [];

  // Group by date
  const grouped = new Map<string, Expense[]>();
  for (const e of inMonth) {
    const list = grouped.get(e.date) ?? [];
    list.push(e);
    grouped.set(e.date, list);
  }

  // Build groups
  const groups: TransactionDayGroup[] = [];
  for (const [day, dayExpenses] of grouped) {
    // Sort rows within day by createdAt DESC
    const sorted = [...dayExpenses].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
    groups.push({
      day,
      rows: sorted.map((e) => ({
        expense: e,
        category: resolveCategory(e.categoryId, categories),
      })),
    });
  }

  // Sort groups by day DESC
  groups.sort((a, b) => b.day.localeCompare(a.day));

  return groups;
}
