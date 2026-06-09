'use client'

import { AlertTriangle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { formatMoney } from '@/lib/format/money'
import type { Currency, Locale } from '@/lib/domain/types'

interface BudgetProgressLineProps {
  spentBase: number
  budgetBase: number
  pct: number
  over: boolean
  baseCurrency: Currency
  locale: Locale
}

export function BudgetProgressLine({
  spentBase,
  budgetBase,
  pct,
  over,
  baseCurrency,
  locale,
}: BudgetProgressLineProps) {
  const t = useTranslations('Categorias')
  const barW = Math.min(100, Math.max(0, pct))
  return (
    <div className="mt-1 flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className={cn('font-money text-xs', over ? 'text-danger' : 'text-muted-txt')}>
          {t('spentOfBudget', {
            spent: formatMoney(spentBase, baseCurrency, locale),
            budget: formatMoney(budgetBase, baseCurrency, locale),
          })}
        </span>
        <span className={cn('flex items-center gap-1 text-xs font-medium', over ? 'text-danger' : 'text-muted-txt')}>
          {over && <AlertTriangle size={12} aria-hidden="true" />}
          {Math.round(pct)}%
          {over && <span className="sr-only">{t('overBudget')}</span>}
        </span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-surface-3" aria-hidden="true">
        <div
          className={cn('h-full rounded-full', over ? 'bg-danger' : 'bg-condor-primary')}
          style={{ width: `${over ? 100 : barW}%` }}
        />
      </div>
    </div>
  )
}
