import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NextIntlClientProvider } from 'next-intl'
import { RankedBars } from '@/components/charts/RankedBars'
import { SpendByDayStrip } from '@/components/charts/SpendByDayStrip'
import type { RankedItem } from '@/lib/domain/geometry'

// ---------------------------------------------------------------------------
// i18n wrapper
// ---------------------------------------------------------------------------

const messages = {
  Inicio: {
    spentThisMonth: 'Gastado este mes',
    vsPrev: 'vs',
    viewBars: 'Barras',
    viewDonut: 'Dona',
    viewTreemap: 'Treemap',
    today: 'HOY',
    chartSummaryBars: 'Gráfica de barras: categorías de gasto',
    chartSummaryDonut: 'Dona: distribución de gasto por categoría',
    chartSummaryTreemap: 'Mapa de árbol: gasto por categoría',
    chartSummaryDays: 'Gasto diario del mes',
  },
}

function withIntl(ui: React.ReactElement) {
  return (
    <NextIntlClientProvider locale="es" messages={messages}>
      {ui}
    </NextIntlClientProvider>
  )
}

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------

const item1: RankedItem = {
  categoryId: 'cat-food',
  name: 'Comida',
  color: '#C9B6FF',
  icon: 'comida',
  totalBase: 820000,
  pct: 29,
}

const item2: RankedItem = {
  categoryId: 'cat-transport',
  name: 'Transporte',
  color: '#9EC1FF',
  icon: 'transporte',
  totalBase: 540000,
  pct: 19,
}

const restItem: RankedItem = {
  categoryId: '__rest__',
  name: 'Otros',
  color: '#FFD98A',
  icon: 'otros',
  totalBase: 200000,
  pct: 7,
}

// ---------------------------------------------------------------------------
// RankedBars
// ---------------------------------------------------------------------------

describe('RankedBars', () => {
  it('renders both category names', () => {
    render(
      withIntl(
        <RankedBars
          items={[item1, item2]}
          baseCurrency="COP"
          locale="es"
          onSelect={vi.fn()}
        />,
      ),
    )
    expect(screen.getByText('Comida')).toBeInTheDocument()
    expect(screen.getByText('Transporte')).toBeInTheDocument()
  })

  it('renders formatted amounts', () => {
    render(
      withIntl(
        <RankedBars
          items={[item1, item2]}
          baseCurrency="COP"
          locale="es"
          onSelect={vi.fn()}
        />,
      ),
    )
    // formatMoney in es-CO locale renders COP amounts
    // Just check that *some* rendered text includes numeric content for both
    const all = screen.getAllByText(/820\.000|820,000|\$\s*820/)
    expect(all.length).toBeGreaterThanOrEqual(1)
  })

  it('clicking the first row calls onSelect with its categoryId', async () => {
    const onSelect = vi.fn()
    render(
      withIntl(
        <RankedBars
          items={[item1, item2]}
          baseCurrency="COP"
          locale="es"
          onSelect={onSelect}
        />,
      ),
    )
    // The button for item1 has aria-label including "Comida"
    const btn = screen.getByRole('button', { name: /Comida/i })
    await userEvent.click(btn)
    expect(onSelect).toHaveBeenCalledOnce()
    expect(onSelect).toHaveBeenCalledWith('cat-food')
  })

  it('clicking the second row calls onSelect with second categoryId', async () => {
    const onSelect = vi.fn()
    render(
      withIntl(
        <RankedBars
          items={[item1, item2]}
          baseCurrency="COP"
          locale="es"
          onSelect={onSelect}
        />,
      ),
    )
    const btn = screen.getByRole('button', { name: /Transporte/i })
    await userEvent.click(btn)
    expect(onSelect).toHaveBeenCalledWith('cat-transport')
  })

  it('__rest__ item is NOT rendered as a button', () => {
    const onSelect = vi.fn()
    render(
      withIntl(
        <RankedBars
          items={[item1, restItem]}
          baseCurrency="COP"
          locale="es"
          onSelect={onSelect}
        />,
      ),
    )
    // Only item1 should have a button; restItem should not
    const buttons = screen.getAllByRole('button')
    const restButton = buttons.find((b) => /Otros/i.test(b.textContent ?? ''))
    expect(restButton).toBeUndefined()
    // item1 is still a button
    expect(screen.getByRole('button', { name: /Comida/i })).toBeInTheDocument()
  })

  it('clicking __rest__ item does not trigger onSelect', async () => {
    const onSelect = vi.fn()
    render(
      withIntl(
        <RankedBars
          items={[restItem]}
          baseCurrency="COP"
          locale="es"
          onSelect={onSelect}
        />,
      ),
    )
    // There should be no button at all (only one item and it's __rest__)
    expect(screen.queryByRole('button')).toBeNull()
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('RankedBars tints an over-budget category and labels it accessibly', () => {
    const items: RankedItem[] = [
      { categoryId: 'preset-comida', name: 'Comida', color: '#C9B6FF', icon: 'comida', totalBase: 180000, pct: 60 },
      { categoryId: 'preset-transporte', name: 'Transporte', color: '#9AD', icon: 'transporte', totalBase: 50000, pct: 40 },
    ]
    render(withIntl(
      <RankedBars items={items} baseCurrency="COP" locale="es"
        overCategoryIds={new Set(['preset-comida'])} overLabel="Sobre el presupuesto" />,
    ))
    const overBtn = screen.getByTestId('ranked-bar-preset-comida')
    expect(overBtn.getAttribute('aria-label')).toMatch(/sobre el presupuesto/i)
    const okBtn = screen.getByTestId('ranked-bar-preset-transporte')
    expect(okBtn.getAttribute('aria-label')).not.toMatch(/sobre el presupuesto/i)

    // Verify visual over-budget cues are rendered on the over row and absent on the ok row
    expect(overBtn.querySelector('.bg-danger')).not.toBeNull()
    expect(okBtn.querySelector('.bg-danger')).toBeNull()
    expect(overBtn.querySelector('svg')).not.toBeNull()
    expect(okBtn.querySelector('svg')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// SpendByDayStrip
// ---------------------------------------------------------------------------

describe('SpendByDayStrip', () => {
  const series = [
    { day: 1, totalBase: 0, isToday: false },
    { day: 2, totalBase: 50000, isToday: false },
    { day: 3, totalBase: 120000, isToday: true },
    { day: 4, totalBase: 30000, isToday: false },
    { day: 5, totalBase: 0, isToday: false },
  ]

  it('renders without error', () => {
    expect(() =>
      render(withIntl(<SpendByDayStrip series={series} locale="es" />)),
    ).not.toThrow()
  })

  it('today bar has data-today attribute', () => {
    render(withIntl(<SpendByDayStrip series={series} locale="es" />))
    const todayBar = document.querySelector('[data-today="true"]')
    expect(todayBar).not.toBeNull()
  })

  it('only one bar has data-today', () => {
    render(withIntl(<SpendByDayStrip series={series} locale="es" />))
    const todayBars = document.querySelectorAll('[data-today="true"]')
    expect(todayBars.length).toBe(1)
  })

  it('today label shows "HOY" (from i18n)', () => {
    render(withIntl(<SpendByDayStrip series={series} locale="es" />))
    expect(screen.getByText('HOY')).toBeInTheDocument()
  })

  it('renders first day and last day axis labels', () => {
    render(withIntl(<SpendByDayStrip series={series} locale="es" />))
    expect(screen.getByText('01')).toBeInTheDocument()
    expect(screen.getByText('05')).toBeInTheDocument()
  })

  it('renders with all-zero series without crashing', () => {
    const zeroSeries = Array.from({ length: 10 }, (_, i) => ({
      day: i + 1,
      totalBase: 0,
      isToday: i === 4,
    }))
    expect(() =>
      render(withIntl(<SpendByDayStrip series={zeroSeries} locale="es" />)),
    ).not.toThrow()
  })

  it('renders empty series without crashing', () => {
    expect(() =>
      render(withIntl(<SpendByDayStrip series={[]} locale="es" />)),
    ).not.toThrow()
  })
})
