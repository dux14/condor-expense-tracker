import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { TrendLine } from '@/components/charts/TrendLine'
import type { MonthPoint } from '@/lib/domain/trends'

const messages = {
  Tendencias: {
    trendTableCaption: 'Gasto mensual',
    monthColumn: 'Mes',
    amountColumn: 'Monto',
    trendSummary: 'Tendencia de gasto mensual',
  },
}

function withIntl(ui: React.ReactElement) {
  return (
    <NextIntlClientProvider locale="es" messages={messages}>
      {ui}
    </NextIntlClientProvider>
  )
}

const series: MonthPoint[] = [
  { month: '2026-04', totalBase: 100 },
  { month: '2026-05', totalBase: 200 },
  { month: '2026-06', totalBase: 150 },
]

describe('TrendLine', () => {
  it('renders an accessible svg with an aria-label', () => {
    render(withIntl(<TrendLine series={series} baseCurrency="COP" locale="es" />))
    expect(screen.getByRole('img')).toHaveAttribute('aria-label')
  })

  it('renders an accessible table fallback with one row per month', () => {
    render(withIntl(<TrendLine series={series} baseCurrency="COP" locale="es" />))
    const table = screen.getByRole('table')
    expect(table).toBeInTheDocument()
    // 3 data rows + header row
    expect(screen.getAllByRole('row')).toHaveLength(4)
  })

  it('renders nothing meaningful for an empty series but does not crash', () => {
    const { container } = render(
      withIntl(<TrendLine series={[]} baseCurrency="COP" locale="es" />),
    )
    expect(container).toBeTruthy()
  })
})
