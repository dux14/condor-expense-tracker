'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { parseAmount, formatAmountTyping, getSeparators } from '@/lib/format/money'
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

/** Count caret-significant characters (digits + the decimal separator). */
function countSig(s: string, decimal: string): number {
  let n = 0
  for (const ch of s) if ((ch >= '0' && ch <= '9') || ch === decimal) n++
  return n
}

/** Caret index in `s` sitting just after the `sig`-th significant character. */
function caretForSig(s: string, decimal: string, sig: number): number {
  if (sig <= 0) return 0
  let n = 0
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if ((ch >= '0' && ch <= '9') || ch === decimal) {
      n++
      if (n === sig) return i + 1
    }
  }
  return s.length
}

export function AmountInput(props: AmountInputProps) {
  const { initialText = '', locale, onAmountChange, autoFocus = false, className } = props
  const t = useTranslations('Anadir')

  // Edit mode passes a plain number string ("1450000") — format it up front.
  const [text, setText] = React.useState(() => formatAmountTyping(initialText, locale))

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target
    const raw = input.value
    const { decimal } = getSeparators(locale)
    const caret = input.selectionStart ?? raw.length
    const sigBefore = countSig(raw.slice(0, caret), decimal)

    const formatted = formatAmountTyping(raw, locale)
    setText(formatted)
    // Sync the DOM and caret synchronously instead of in an effect: when
    // re-formatting yields the string already in state (e.g. deleting a group
    // separator — "1.450" → raw "1450" → "1.450"), React bails out of the
    // re-render and an effect keyed on `text` would never run, leaving the
    // caret at the end. With the DOM already matching, React's controlled
    // re-render won't touch the input, so the caret position sticks.
    input.value = formatted
    const pos = caretForSig(formatted, decimal, sigBefore)
    input.setSelectionRange(pos, pos)
    onAmountChange(parseAmount(formatted, locale), formatted)
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
      data-testid="amount-input"
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
