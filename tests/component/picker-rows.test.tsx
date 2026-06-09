import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { DatePickerRow } from '@/components/expense/DatePickerRow'
import { TimePickerRow } from '@/components/expense/TimePickerRow'

const messages = {
  Anadir: {
    todayPrefix: 'Hoy · ',
    dateTapToChange: '{label}',
    timeTapToChange: '{label}',
  },
}

function withIntl(ui: React.ReactElement) {
  return (
    <NextIntlClientProvider locale="es" messages={messages}>
      {ui}
    </NextIntlClientProvider>
  )
}

describe('DatePickerRow (Path 1 — native input is the tap target)', () => {
  it('renders a native date input that is the interactive top layer', () => {
    const onChange = vi.fn()
    const { container } = render(
      withIntl(<DatePickerRow value="2026-06-08" onChange={onChange} locale="es" />),
    )

    const input = container.querySelector('input[type="date"]') as HTMLInputElement | null
    expect(input).not.toBeNull()
    // Must NOT be aria-hidden — direct taps must reach it
    expect(input!.getAttribute('aria-hidden')).toBeNull()
    // Must NOT have pointer-events-none — it has to receive taps
    expect(input!.className).not.toContain('pointer-events-none')
    // Must be focusable (tabIndex not -1 — either absent or >= 0)
    expect(input!.tabIndex).not.toBe(-1)
  })

  it('fires onChange with the new value on change', () => {
    const onChange = vi.fn()
    const { container } = render(
      withIntl(<DatePickerRow value="2026-06-08" onChange={onChange} locale="es" />),
    )
    const input = container.querySelector('input[type="date"]') as HTMLInputElement
    fireEvent.change(input, { target: { value: '2026-12-25' } })
    expect(onChange).toHaveBeenCalledWith('2026-12-25')
  })

  it('still renders the human-readable label', () => {
    render(
      withIntl(<DatePickerRow value="2026-06-08" onChange={vi.fn()} locale="es" />),
    )
    // 2026-06-08 in es format = "8 jun 2026"
    expect(screen.getByText(/8 jun 2026/i)).toBeInTheDocument()
  })
})

describe('TimePickerRow (Path 1 — native input is the tap target)', () => {
  it('renders a native time input that is the interactive top layer', () => {
    const onChange = vi.fn()
    const { container } = render(
      withIntl(<TimePickerRow value="08:30" onChange={onChange} />),
    )

    const input = container.querySelector('input[type="time"]') as HTMLInputElement | null
    expect(input).not.toBeNull()
    expect(input!.getAttribute('aria-hidden')).toBeNull()
    expect(input!.className).not.toContain('pointer-events-none')
    expect(input!.tabIndex).not.toBe(-1)
  })

  it('fires onChange with the new value on change', () => {
    const onChange = vi.fn()
    const { container } = render(
      withIntl(<TimePickerRow value="08:30" onChange={onChange} />),
    )
    const input = container.querySelector('input[type="time"]') as HTMLInputElement
    fireEvent.change(input, { target: { value: '09:45' } })
    expect(onChange).toHaveBeenCalledWith('09:45')
  })

  it('renders the value text in the visual layer', () => {
    render(withIntl(<TimePickerRow value="08:30" onChange={vi.fn()} />))
    expect(screen.getByText('08:30')).toBeInTheDocument()
  })
})
