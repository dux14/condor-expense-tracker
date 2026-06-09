import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { TransactionRow } from '@/components/tx/TransactionRow'
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

const category = PRESET_CATEGORIES[0]

const expense: Expense = {
  id: 'e-test-1',
  amount: 5000,
  currency: 'COP',
  baseAmount: 5000,
  fxRate: 1,
  date: '2026-06-08',
  categoryId: category.id,
  source: 'manual',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

describe('TransactionRow', () => {
  it('shows the "Inusual" chip when isAnomaly is true', () => {
    render(
      withIntl(
        <TransactionRow
          expense={expense}
          category={category}
          locale="es"
          baseCurrency="COP"
          isAnomaly
        />,
      ),
    )
    expect(screen.getByText(esMessages.Common.emergencia)).toBeInTheDocument()
  })

  it('does NOT show the "Inusual" chip when isAnomaly is omitted', () => {
    render(
      withIntl(
        <TransactionRow
          expense={expense}
          category={category}
          locale="es"
          baseCurrency="COP"
        />,
      ),
    )
    expect(screen.queryByText(esMessages.Common.emergencia)).toBeNull()
  })
})
