'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import type { Expense, Category, Locale, Currency } from '@/lib/domain/types'
import { formatMoney } from '@/lib/format/money'
import { CategoryBadge } from '@/components/category/CategoryBadge'

export interface TransactionRowProps {
  expense: Expense
  category: Category
  locale: Locale
  baseCurrency: Currency
  onPress?: () => void
  className?: string
}

export function TransactionRow({
  expense,
  category,
  locale,
  baseCurrency,
  onPress,
  className,
}: TransactionRowProps) {
  const t = useTranslations('Common')

  // Primary label: merchant > note > category name
  const primaryLabel = expense.merchant || expense.note || category.name
  // Secondary label (shown when merchant is present): note or category name
  const secondaryLabel =
    expense.merchant
      ? (expense.note || category.name)
      : category.name !== primaryLabel
        ? category.name
        : undefined

  const showBaseAmount =
    expense.currency !== baseCurrency && expense.baseAmount != null

  const showNoConversion =
    expense.currency !== baseCurrency && expense.baseAmount == null

  const content = (
    <div
      className={cn(
        'flex min-h-[56px] w-full items-center gap-3 px-4 py-3',
        className,
      )}
    >
      {/* Left: category badge */}
      <CategoryBadge color={category.color} icon={category.icon} size={40} />

      {/* Middle: labels */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text">{primaryLabel}</p>
        {secondaryLabel && (
          <p className="truncate text-xs text-muted-txt">{secondaryLabel}</p>
        )}
      </div>

      {/* Right: amounts */}
      <div className="flex flex-col items-end shrink-0">
        <span className="font-money text-sm font-semibold text-text">
          {formatMoney(expense.amount, expense.currency, locale)}
        </span>
        {showBaseAmount && (
          <span className="font-money text-xs text-muted-txt">
            {formatMoney(expense.baseAmount!, baseCurrency, locale)}
          </span>
        )}
        {showNoConversion && (
          <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted-txt">
            {t('no_conversion')}
          </span>
        )}
      </div>
    </div>
  )

  if (onPress) {
    return (
      <button
        type="button"
        onClick={onPress}
        className="w-full text-left transition-colors hover:bg-surface-2 active:bg-surface-3"
      >
        {content}
      </button>
    )
  }

  return <div>{content}</div>
}
