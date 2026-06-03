'use client'

import { cn } from '@/lib/utils'
import { RankedBars } from '@/components/charts/RankedBars'
import { DonutChart } from '@/components/charts/DonutChart'
import { Treemap } from '@/components/charts/Treemap'
import type { RankedItem } from '@/lib/domain/geometry'
import type { DashboardView, Currency, Locale } from '@/lib/domain/types'

interface SpendingViewProps {
  view: DashboardView
  barsItems: RankedItem[]
  treemapItems: RankedItem[]
  baseCurrency: Currency
  locale: Locale
  onSelectCategory?: (id: string) => void
  className?: string
}

export function SpendingView({
  view,
  barsItems,
  treemapItems,
  baseCurrency,
  locale,
  onSelectCategory,
  className,
}: SpendingViewProps) {
  return (
    <div className={cn('w-full', className)}>
      {view === 'bars' && (
        <RankedBars
          items={barsItems}
          baseCurrency={baseCurrency}
          locale={locale}
          onSelect={onSelectCategory}
        />
      )}
      {view === 'donut' && (
        <DonutChart
          items={barsItems}
          baseCurrency={baseCurrency}
          locale={locale}
        />
      )}
      {view === 'treemap' && (
        <Treemap
          items={treemapItems}
          baseCurrency={baseCurrency}
          locale={locale}
          onSelect={onSelectCategory}
        />
      )}
    </div>
  )
}
