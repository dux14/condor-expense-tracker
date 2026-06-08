import { describe, it, expect } from 'vitest'
import type { Expense } from '@/lib/domain/types'
import { monthOverMonth } from '@/lib/domain/trends'

let _id = 0
function makeExpense(p: Partial<Expense>): Expense {
  _id += 1
  const amount = p.amount ?? 1000
  return {
    id: `e-${_id}`,
    amount,
    currency: 'COP',
    baseAmount: amount,
    fxRate: 1,
    date: '2026-06-15',
    categoryId: 'cat-a',
    source: 'manual',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...p,
  }
}

describe('monthOverMonth', () => {
  it('returns nMonths points in ascending chronological order ending at anchor', () => {
    const series = monthOverMonth([], null, '2026-06', 3)
    expect(series.map((p) => p.month)).toEqual(['2026-04', '2026-05', '2026-06'])
  })

  it('sums baseAmount per month across all categories when categoryId is null', () => {
    const expenses = [
      makeExpense({ date: '2026-05-10', baseAmount: 100, categoryId: 'cat-a' }),
      makeExpense({ date: '2026-05-20', baseAmount: 200, categoryId: 'cat-b' }),
      makeExpense({ date: '2026-06-01', baseAmount: 50, categoryId: 'cat-a' }),
    ]
    const series = monthOverMonth(expenses, null, '2026-06', 2)
    expect(series).toEqual([
      { month: '2026-05', totalBase: 300 },
      { month: '2026-06', totalBase: 50 },
    ])
  })

  it('filters to a single category when categoryId is provided', () => {
    const expenses = [
      makeExpense({ date: '2026-06-01', baseAmount: 100, categoryId: 'cat-a' }),
      makeExpense({ date: '2026-06-02', baseAmount: 999, categoryId: 'cat-b' }),
    ]
    const series = monthOverMonth(expenses, 'cat-a', '2026-06', 1)
    expect(series).toEqual([{ month: '2026-06', totalBase: 100 }])
  })

  it('skips expenses with null baseAmount (FX unavailable)', () => {
    const expenses = [
      makeExpense({ date: '2026-06-01', baseAmount: 100 }),
      makeExpense({ date: '2026-06-02', baseAmount: null }),
    ]
    const series = monthOverMonth(expenses, null, '2026-06', 1)
    expect(series).toEqual([{ month: '2026-06', totalBase: 100 }])
  })

  it('emits 0 for months with no expenses', () => {
    const expenses = [makeExpense({ date: '2026-06-01', baseAmount: 100 })]
    const series = monthOverMonth(expenses, null, '2026-06', 3)
    expect(series).toEqual([
      { month: '2026-04', totalBase: 0 },
      { month: '2026-05', totalBase: 0 },
      { month: '2026-06', totalBase: 100 },
    ])
  })

  it('clamps nMonths to at least 1', () => {
    expect(monthOverMonth([], null, '2026-06', 0)).toEqual([
      { month: '2026-06', totalBase: 0 },
    ])
  })
})
