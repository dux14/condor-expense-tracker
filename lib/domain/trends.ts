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

// ---------------------------------------------------------------------------
// detectAnomalies
// ---------------------------------------------------------------------------

/** Minimum trailing months with any spend required to judge an anomaly. */
export const MIN_HISTORY_MONTHS = 3
/** Default robust threshold multiplier: spend > median + k·MAD ⇒ anomaly. */
export const DEFAULT_K = 3
/** Trailing window used to build each category's baseline. */
export const BASELINE_WINDOW = 6
/**
 * When MAD === 0 (perfectly flat history) we cannot use the robust threshold,
 * so fall back to a relative rule: anchor spend must exceed the baseline median
 * by this factor to count as an anomaly. 2 = "double your normal".
 */
export const FLAT_HISTORY_FACTOR = 2

export type AnomalyStatus = 'normal' | 'emergencia'

export interface AnomalyResult {
  categoryId: string
  amount: number // anchor-month base spend for this category
  status: AnomalyStatus
  threshold: number // median + k·MAD (or relative fallback) used for the call
  baseline: CategoryBaseline
  insufficientData: boolean // true when trailing history < MIN_HISTORY_MONTHS
}

export interface DetectAnomaliesOpts {
  k?: number
  baselineWindow?: number
}

/**
 * For each category with spend in `anchorMonth`, compare that month's
 * base-currency spend against the category's trailing baseline:
 *   - status 'emergencia' when amount > median + k·MAD,
 *   - or, when MAD === 0, when amount > median · FLAT_HISTORY_FACTOR (and amount > 0),
 *   - otherwise 'normal'.
 * Categories with fewer than MIN_HISTORY_MONTHS trailing months that actually
 * had spend are always 'normal' with insufficientData: true.
 * Results are sorted by categoryId asc for determinism.
 */
export function detectAnomalies(
  expenses: Expense[],
  anchorMonth: string,
  opts: DetectAnomaliesOpts = {},
): AnomalyResult[] {
  const k = opts.k ?? DEFAULT_K
  const window = opts.baselineWindow ?? BASELINE_WINDOW

  // Categories that spent in the anchor month (skip null baseAmount).
  const anchorTotals = new Map<string, number>()
  for (const e of expenses) {
    if (e.baseAmount === null) continue
    if (!isInMonth(e.date, anchorMonth)) continue
    anchorTotals.set(e.categoryId, (anchorTotals.get(e.categoryId) ?? 0) + e.baseAmount)
  }

  const results: AnomalyResult[] = []
  for (const [categoryId, amount] of anchorTotals) {
    const baseline = categoryBaseline(expenses, categoryId, anchorMonth, window)

    // Count trailing months that actually had spend (real history).
    const prior = prevMonthKey(anchorMonth)
    const trailing = monthOverMonth(expenses, categoryId, prior, window)
    const monthsWithSpend = trailing.filter((p) => p.totalBase > 0).length

    let status: AnomalyStatus = 'normal'
    let threshold: number
    const insufficientData = monthsWithSpend < MIN_HISTORY_MONTHS

    if (insufficientData) {
      threshold = Infinity
    } else if (baseline.mad === 0) {
      threshold = baseline.median * FLAT_HISTORY_FACTOR
      if (amount > threshold) status = 'emergencia'
    } else {
      threshold = baseline.median + k * baseline.mad
      if (amount > threshold) status = 'emergencia'
    }

    results.push({ categoryId, amount, status, threshold, baseline, insufficientData })
  }

  results.sort((a, b) => a.categoryId.localeCompare(b.categoryId))
  return results
}
