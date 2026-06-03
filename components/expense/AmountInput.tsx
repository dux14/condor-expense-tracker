'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { parseAmount } from '@/lib/format/money'
import type { Locale } from '@/lib/domain/types'

export interface AmountInputProps {
  initialText?: string
  locale: Locale
  /** The currency code (e.g. "COP"). Accepted here so the parent can pass a uniform
   *  expense form object; the parent is responsible for rendering the currency symbol. */
  currencyCode: string
  onAmountChange: (amount: number, text: string) => void
  autoFocus?: boolean
  className?: string
}

export function AmountInput(props: AmountInputProps) {
  const { initialText = '', locale, onAmountChange, autoFocus = false, className } = props
  const t = useTranslations('Anadir')

  const [text, setText] = React.useState(initialText)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    setText(raw)
    const parsed = parseAmount(raw, locale)
    onAmountChange(parsed, raw)
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      placeholder="0"
      value={text}
      onChange={handleChange}
      autoFocus={autoFocus}
      aria-label={t('amountLabel')}
      className={cn(
        // Full-width, transparent bg, no border of its own — parent supplies the surface
        'w-full min-w-0 bg-transparent text-right outline-none',
        // Big money typography
        'font-money text-[44px] leading-none text-condor-primary',
        // Placeholder color
        'placeholder:text-condor-primary/40',
        // Touch target
        'py-2',
        className,
      )}
    />
  )
}
