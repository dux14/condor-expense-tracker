'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { KNOWN_CURRENCIES } from '@/lib/domain/schemas'
import type { Currency } from '@/lib/domain/types'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export interface CurrencyPillProps {
  value: Currency
  onChange: (c: Currency) => void
  currencies?: string[]
  className?: string
}

export function CurrencyPill({
  value,
  onChange,
  currencies = [...KNOWN_CURRENCIES],
  className,
}: CurrencyPillProps) {
  const t = useTranslations('Anadir')
  return (
    <Select
      value={value}
      onValueChange={(v) => {
        if (v != null) onChange(v as Currency)
      }}
    >
      <SelectTrigger
        aria-label={t('selectCurrency')}
        data-testid="currency-pill"
        className={cn(
          // Pill shape
          'h-8 rounded-full border-0 px-3 py-0',
          // Surface
          'bg-surface-2 text-text',
          // Typography
          'text-sm font-medium',
          // Focus ring respects design tokens
          'focus-visible:ring-condor-primary/40',
          className,
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {currencies.map((c) => (
          <SelectItem key={c} value={c}>
            {c}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
