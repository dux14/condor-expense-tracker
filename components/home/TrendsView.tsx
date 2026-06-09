'use client'

import { useTranslations } from 'next-intl'
import { AlertTriangle, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatMoney } from '@/lib/format/money'
import { TrendLine } from '@/components/charts/TrendLine'
import { CategoryBadge } from '@/components/category/CategoryBadge'
import { monthOverMonth, detectAnomalies, BASELINE_WINDOW } from '@/lib/domain/trends'
import { rankedByCategory } from '@/lib/domain/selectors'
import type { Expense, Category, Currency, Locale } from '@/lib/domain/types'

const SERIES_MONTHS = BASELINE_WINDOW + 1 // baseline window + the anchor month

interface TrendsViewProps {
  expenses: Expense[]
  categories: Category[]
  month: string
  baseCurrency: Currency
  locale: Locale
  className?: string
}

export function TrendsView({
  expenses,
  categories,
  month,
  baseCurrency,
  locale,
  className,
}: TrendsViewProps) {
  const t = useTranslations('Tendencias')

  const anomalies = detectAnomalies(expenses, month)
  const anomalyByCat = new Map(anomalies.map((a) => [a.categoryId, a]))

  // Categories present this month, ranked, to give the list a stable useful order.
  const ranked = rankedByCategory(expenses, categories, month, 99).filter(
    (r) => r.categoryId !== '__rest__',
  )

  if (ranked.length === 0) {
    return <p className={cn('text-sm text-muted-txt px-1', className)}>{t('empty')}</p>
  }

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {ranked.map((row) => {
        const series = monthOverMonth(expenses, row.categoryId, month, SERIES_MONTHS)
        const a = anomalyByCat.get(row.categoryId)
        const isEmergencia = a?.status === 'emergencia'

        return (
          <section
            key={row.categoryId}
            className="rounded-condor bg-surface p-3 flex flex-col gap-2"
          >
            <header className="flex items-center gap-2">
              <CategoryBadge color={row.color} icon={row.icon} size={28} />
              <span className="text-sm font-medium text-text flex-1 truncate">
                {row.name}
              </span>
              {isEmergencia && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-500">
                  <AlertTriangle size={11} strokeWidth={2.5} aria-hidden />
                  {t('emergencia')}
                </span>
              )}
            </header>

            <TrendLine
              series={series}
              baseCurrency={baseCurrency}
              locale={locale}
            />

            {/* "this month vs your normal" callout */}
            {a && !a.insufficientData ? (
              <p
                className={cn(
                  'flex items-center gap-1.5 text-xs',
                  isEmergencia ? 'text-amber-500' : 'text-muted-txt',
                )}
              >
                {isEmergencia ? (
                  <AlertTriangle size={12} aria-hidden />
                ) : (
                  <TrendingUp size={12} aria-hidden />
                )}
                <span>
                  {t('thisMonthLabel', {
                    amount: formatMoney(a.amount, baseCurrency, locale),
                  })}
                  {' · '}
                  {t('baselineLabel', {
                    amount: formatMoney(a.baseline.median, baseCurrency, locale),
                  })}
                </span>
              </p>
            ) : (
              <p className="text-xs text-muted-txt">{t('insufficientData')}</p>
            )}
          </section>
        )
      })}
    </div>
  )
}
