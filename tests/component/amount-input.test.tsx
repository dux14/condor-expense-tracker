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
})
