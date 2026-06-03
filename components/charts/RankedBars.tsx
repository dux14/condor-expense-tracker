'use client'

import { cn } from '@/lib/utils'
import { formatMoney } from '@/lib/format/money'
import { barWidths, type RankedItem } from '@/lib/domain/geometry'
import type { Currency, Locale } from '@/lib/domain/types'

interface RankedBarsProps {
  items: RankedItem[]
  baseCurrency: Currency
  locale: Locale
  onSelect?: (categoryId: string) => void
  className?: string
}

export function RankedBars({
  items,
  baseCurrency,
  locale,
  onSelect,
  className,
}: RankedBarsProps) {

  const widths = barWidths(items.map((i) => i.totalBase))

  return (
    <ol className={cn('flex flex-col gap-0.5', className)} role="list">
      {items.map((item, idx) => {
        const isRest = item.categoryId === '__rest__'
        const pctStr = `${Math.round(item.pct)}%`
        const amountStr = formatMoney(item.totalBase, baseCurrency, locale)
        const barW = widths[idx] ?? 0

        const rowContent = (
          <>
            {/* Text row: name left, amount + pct right */}
            <div className="flex items-baseline justify-between gap-2 mb-1">
              <span className="text-sm text-text leading-tight truncate">
                {item.name}
              </span>
              <span className="font-money text-sm text-text whitespace-nowrap shrink-0">
                {amountStr}&nbsp;
                <span className="text-muted-txt text-xs">{pctStr}</span>
              </span>
            </div>
            {/* Bar track */}
            <div className="relative h-1.5 rounded-full bg-surface-3 overflow-hidden">
              <div
                className={cn(
                  'absolute inset-y-0 left-0 rounded-full',
                  'bar-grow',
                )}
                style={{
                  width: `${barW}%`,
                  backgroundColor: item.color,
                  // stagger each bar slightly
                  animationDelay: `${idx * 55}ms`,
                }}
              />
            </div>
          </>
        )

        if (isRest) {
          return (
            <li key={item.categoryId} className="py-2 px-0">
              {rowContent}
            </li>
          )
        }

        return (
          <li key={item.categoryId}>
            <button
              type="button"
              onClick={() => onSelect?.(item.categoryId)}
              className="w-full text-left py-2 px-0 rounded-condor focus-visible:outline focus-visible:outline-2 focus-visible:outline-condor-primary transition-opacity active:opacity-70"
              aria-label={`${item.name} ${amountStr} ${pctStr}`}
            >
              {rowContent}
            </button>
          </li>
        )
      })}
    </ol>
  )
}
