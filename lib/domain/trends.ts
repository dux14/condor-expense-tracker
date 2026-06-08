import type { Expense } from './types'
import { isInMonth, prevMonthKey } from '@/lib/format/date'
import { median, mad } from './geometry'

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface MonthPoint {
  month: string // 'yyyy-MM'
  totalBase: number // sum of baseAmount (null skipped) for that month
}

// ---------------------------------------------------------------------------
// Internal: list of month keys ending at `anchor`, ascending, length n.
// ---------------------------------------------------------------------------
function monthWindow(anchor: string, n: number): string[] {
  const count = Math.max(1, Math.floor(n))
  const keys: string[] = [anchor]
  for (let i = 1; i < count; i++) {
    keys.unshift(prevMonthKey(keys[0]))
  }
  return keys
}

// ---------------------------------------------------------------------------
// monthOverMonth
// ---------------------------------------------------------------------------

/**
 * Monthly base-currency spend series for `categoryId` (or all categories when
 * null) over the last `nMonths` months ending at `anchorMonth` ('yyyy-MM').
 *
 * - Order: ascending chronological (oldest → newest).
 * - baseAmount === null (FX unavailable) is skipped from sums.
 * - Months with no matching expenses emit totalBase: 0 (dense series).
 * - nMonths is clamped to >= 1.
 */
export function monthOverMonth(
  expenses: Expense[],
  categoryId: string | null,
  anchorMonth: string,
  nMonths: number,
): MonthPoint[] {
  const months = monthWindow(anchorMonth, nMonths)
  const totals = new Map<string, number>(months.map((m) => [m, 0]))

  for (const e of expenses) {
    if (e.baseAmount === null) continue
    if (categoryId !== null && e.categoryId !== categoryId) continue
    for (const m of months) {
      if (isInMonth(e.date, m)) {
        totals.set(m, (totals.get(m) ?? 0) + e.baseAmount)
        break
      }
    }
  }

  return months.map((month) => ({ month, totalBase: totals.get(month) ?? 0 }))
}
