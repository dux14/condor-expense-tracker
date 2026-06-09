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

// ---------------------------------------------------------------------------
// categoryBaseline
// ---------------------------------------------------------------------------

export interface CategoryBaseline {
  median: number // median of the trailing months that HAD spend (base currency)
  mad: number // median absolute deviation of those same months
  months: number // size of the trailing window when any spend exists, else 0
}

/**
 * Trailing baseline for one category: median + MAD of the monthly base-currency
 * spend over `trailingMonths` months ENDING the month BEFORE `anchorMonth`
 * (the anchor is excluded so it can be compared against its own history).
 *
 * median/MAD are computed over ONLY the trailing months that actually had spend
 * (totalBase > 0). A category that spends sporadically is therefore judged
 * against "when it spends, how much" — so a flat 100/100/100 history yields
 * MAD 0 (enabling the relative flat-history fallback in detectAnomalies),
 * rather than being diluted by zero-spend months. With no spend at all the
 * baseline is { median: 0, mad: 0, months: 0 }.
 */
export function categoryBaseline(
  expenses: Expense[],
  categoryId: string,
  anchorMonth: string,
  trailingMonths: number,
): CategoryBaseline {
  const window = Math.max(1, Math.floor(trailingMonths))
  const prior = prevMonthKey(anchorMonth)
  const series = monthOverMonth(expenses, categoryId, prior, window)
  const spentMonths = series.map((p) => p.totalBase).filter((t) => t > 0)
  if (spentMonths.length === 0) return { median: 0, mad: 0, months: 0 }
  return { median: median(spentMonths), mad: mad(spentMonths), months: window }
}
