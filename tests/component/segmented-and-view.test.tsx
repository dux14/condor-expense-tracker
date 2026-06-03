import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NextIntlClientProvider } from 'next-intl'
import { SegmentedControl } from '@/components/settings/SegmentedControl'
import { ViewSwitcher } from '@/components/home/ViewSwitcher'

// Minimal i18n messages for ViewSwitcher
const messages = {
  Inicio: {
    spentThisMonth: 'Gastado este mes',
    vsPrev: 'vs',
    viewBars: 'Barras',
    viewDonut: 'Dona',
    viewTreemap: 'Treemap',
  },
}

function withIntl(ui: React.ReactElement) {
  return (
    <NextIntlClientProvider locale="es" messages={messages}>
      {ui}
    </NextIntlClientProvider>
  )
}

describe('SegmentedControl', () => {
  const options = [
    { value: 'a', label: 'Option A' },
    { value: 'b', label: 'Option B' },
    { value: 'c', label: 'Option C' },
  ]

  it('renders all options', () => {
    render(<SegmentedControl options={options} value="a" onChange={vi.fn()} />)
    expect(screen.getByRole('radio', { name: 'Option A' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Option B' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Option C' })).toBeInTheDocument()
  })

  it('marks active option as aria-checked=true', () => {
    render(<SegmentedControl options={options} value="a" onChange={vi.fn()} />)
    expect(screen.getByRole('radio', { name: 'Option A' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'Option B' })).toHaveAttribute('aria-checked', 'false')
  })

  it('calls onChange with the value of the clicked segment', async () => {
    const onChange = vi.fn()
    render(<SegmentedControl options={options} value="a" onChange={onChange} />)
    await userEvent.click(screen.getByRole('radio', { name: 'Option B' }))
    expect(onChange).toHaveBeenCalledWith('b')
  })

  it('reflects the current value through aria-checked', () => {
    render(<SegmentedControl options={options} value="c" onChange={vi.fn()} />)
    expect(screen.getByRole('radio', { name: 'Option C' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'Option A' })).toHaveAttribute('aria-checked', 'false')
  })
})

describe('ViewSwitcher', () => {
  it('renders Barras, Dona, Treemap segments', () => {
    render(withIntl(<ViewSwitcher value="bars" onChange={vi.fn()} />))
    expect(screen.getByRole('radio', { name: 'Barras' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Dona' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Treemap' })).toBeInTheDocument()
  })

  it('marks the current value as active', () => {
    render(withIntl(<ViewSwitcher value="bars" onChange={vi.fn()} />))
    expect(screen.getByRole('radio', { name: 'Barras' })).toHaveAttribute('aria-checked', 'true')
  })

  it('calls onChange with "donut" when Dona segment is clicked', async () => {
    const onChange = vi.fn()
    render(withIntl(<ViewSwitcher value="bars" onChange={onChange} />))
    await userEvent.click(screen.getByRole('radio', { name: 'Dona' }))
    expect(onChange).toHaveBeenCalledWith('donut')
  })
})
