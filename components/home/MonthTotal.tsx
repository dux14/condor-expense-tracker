'use client'

import { useTranslations } from 'next-intl'
import { formatMoney } from '@/lib/format/money'
import type { Currency, Locale } from '@/lib/domain/types'
import { cn } from '@/lib/utils'

interface MonthTotalProps {
  totalBase: number
  baseCurrency: Currency
  locale: Locale
  deltaPct: number
  hasPrev: boolean
  prevMonthLabel?: string
  className?: string
}

export function MonthTotal({
  totalBase,
  baseCurrency,
  locale,
  deltaPct,
  hasPrev,
  prevMonthLabel,
  className,
}: MonthTotalProps) {
  const t = useTranslations('Inicio')

  const roundedDelta = Math.round(deltaPct)
  const isPositive = roundedDelta >= 0
  const sign = isPositive ? '+' : ''

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {/* Label */}
      <p className="text-sm text-muted-txt">{t('spentThisMonth')}</p>

      {/* Big money figure */}
      <div className="flex items-baseline gap-2">
        <span className="font-money text-condor-primary" style={{ fontSize: '2.5rem', lineHeight: 1.1 }}>
          {formatMoney(totalBase, baseCurrency, locale)}
        </span>
        <span className="text-xs font-medium text-muted-txt uppercase tracking-wide">
          {baseCurrency}
        </span>
      </div>

      {/* Delta chip */}
      {hasPrev && (
        <div
          className={cn(
            'inline-flex items-center gap-1 self-start rounded-full px-2 py-0.5 text-xs font-medium',
            isPositive
              ? 'bg-condor-primary/15 text-condor-primary'
              : 'bg-danger/15 text-danger',
          )}
        >
          <span>
            {sign}{roundedDelta}%
          </span>
          {prevMonthLabel && (
            <span className="opacity-75">
              {t('vsPrev')} {prevMonthLabel}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
