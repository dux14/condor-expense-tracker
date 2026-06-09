import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { TrendsView } from '@/components/home/TrendsView'
import { PRESET_CATEGORIES } from '@/lib/domain/presets'
import esMessages from '@/messages/es.json'
import type { Expense } from '@/lib/domain/types'

function withIntl(ui: React.ReactElement) {
  return (
    <NextIntlClientProvider locale="es" messages={esMessages}>
      {ui}
    </NextIntlClientProvider>
  )
}

let _id = 0
function makeExpense(p: Partial<Expense>): Expense {
  _id += 1
  const amount = p.amount ?? 1000
  return {
    id: `e-${_id}`, amount, currency: 'COP', baseAmount: amount, fxRate: 1,
    date: '2026-06-15', categoryId: PRESET_CATEGORIES[0].id, source: 'manual',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...p,
  }
}

describe('TrendsView', () => {
  const cat = PRESET_CATEGORIES[0].id
  const expenses: Expense[] = [
    makeExpense({ date: '2026-03-10', baseAmount: 100, categoryId: cat }),
    makeExpense({ date: '2026-04-10', baseAmount: 100, categoryId: cat }),
    makeExpense({ date: '2026-05-10', baseAmount: 100, categoryId: cat }),
    makeExpense({ date: '2026-06-10', baseAmount: 1000, categoryId: cat }),
  ]

  it('flags the spike category with the emergencia label and a table fallback', () => {
    render(withIntl(
      <TrendsView expenses={expenses} categories={PRESET_CATEGORIES}
        month="2026-06" baseCurrency="COP" locale="es" />,
    ))
    expect(screen.getAllByText(esMessages.Tendencias.emergencia).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('table').length).toBeGreaterThan(0)
  })

  it('shows empty copy when there is no spend in the month', () => {
    render(withIntl(
      <TrendsView expenses={[]} categories={PRESET_CATEGORIES}
        month="2026-06" baseCurrency="COP" locale="es" />,
    ))
    expect(screen.getByText(esMessages.Tendencias.empty)).toBeInTheDocument()
  })
})
