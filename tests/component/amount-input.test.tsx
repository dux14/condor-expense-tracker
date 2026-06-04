import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NextIntlClientProvider } from 'next-intl'
import { AmountInput } from '@/components/expense/AmountInput'

const esMessages = {
  Anadir: {
    amountLabel: 'Monto',
    selectCurrency: 'Seleccionar moneda',
    dateTapToChange: 'Fecha: {label}. Toca para cambiar.',
    todayPrefix: 'Hoy · ',
  },
}

const enMessages = {
  Anadir: {
    amountLabel: 'Amount',
    selectCurrency: 'Select currency',
    dateTapToChange: 'Date: {label}. Tap to change.',
    todayPrefix: 'Today · ',
  },
}

function withIntl(ui: React.ReactElement, locale: 'es' | 'en' = 'es') {
  const messages = locale === 'es' ? esMessages : enMessages
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {ui}
    </NextIntlClientProvider>
  )
}

describe('AmountInput', () => {
  it('parses a Spanish-locale amount correctly (2.847.500 → 2847500)', async () => {
    const onAmountChange = vi.fn()
    render(
      withIntl(
        <AmountInput
          locale="es"
          currencyCode="COP"
          onAmountChange={onAmountChange}
        />,
      ),
    )

    const input = screen.getByRole('textbox', { name: /monto/i })
    await userEvent.type(input, '2.847.500')

    // Get the last call's parsed value
    const calls = onAmountChange.mock.calls
    const lastParsed = calls[calls.length - 1][0]
    expect(lastParsed).toBe(2847500)
  })

  it('parses an English-locale amount correctly (1,234.56 → 1234.56)', async () => {
    const onAmountChange = vi.fn()
    render(
      withIntl(
        <AmountInput
          locale="en"
          currencyCode="USD"
          onAmountChange={onAmountChange}
        />,
        'en',
      ),
    )

    const input = screen.getByRole('textbox', { name: /amount/i })
    await userEvent.type(input, '1,234.56')

    const calls = onAmountChange.mock.calls
    const lastParsed = calls[calls.length - 1][0]
    expect(lastParsed).toBe(1234.56)
  })

  it('shows live thousands separators while typing plain digits (es)', async () => {
    const onAmountChange = vi.fn()
    render(
      withIntl(
        <AmountInput
          locale="es"
          currencyCode="COP"
          onAmountChange={onAmountChange}
        />,
      ),
    )

    const input = screen.getByRole('textbox', { name: /monto/i })
    await userEvent.type(input, '1450000')

    expect((input as HTMLInputElement).value).toBe('1.450.000')
    const calls = onAmountChange.mock.calls
    expect(calls[calls.length - 1][0]).toBe(1450000)
  })

  it('shows live thousands separators while typing plain digits (en)', async () => {
    const onAmountChange = vi.fn()
    render(
      withIntl(
        <AmountInput
          locale="en"
          currencyCode="USD"
          onAmountChange={onAmountChange}
        />,
        'en',
      ),
    )

    const input = screen.getByRole('textbox', { name: /amount/i })
    await userEvent.type(input, '1450000')

    expect((input as HTMLInputElement).value).toBe('1,450,000')
  })

  it('formats a pre-filled edit-mode value on mount', () => {
    render(
      withIntl(
        <AmountInput
          locale="es"
          currencyCode="COP"
          initialText="1450000"
          onAmountChange={vi.fn()}
        />,
      ),
    )

    const input = screen.getByRole('textbox', { name: /monto/i })
    expect((input as HTMLInputElement).value).toBe('1.450.000')
  })
})
