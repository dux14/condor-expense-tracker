'use client'

import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { formatMoney } from '@/lib/format/money'
import { squarify, type RankedItem } from '@/lib/domain/geometry'
import type { Currency, Locale } from '@/lib/domain/types'

const DEFAULT_WIDTH = 320
const DEFAULT_HEIGHT = 200

interface TreemapProps {
  items: RankedItem[]
  baseCurrency: Currency
  locale: Locale
  onSelect?: (categoryId: string) => void
  className?: string
  width?: number
  height?: number
}

export function Treemap({
  items,
  baseCurrency,
  locale,
  onSelect,
  className,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
}: TreemapProps) {
  const t = useTranslations('Inicio')

  const rects = squarify(
    items.map((i) => i.totalBase),
    width,
    height,
  )

  const top3 = items.slice(0, 3).map((i) => `${i.name} ${Math.round(i.pct)}%`).join(', ')
  const ariaLabel = `${t('chartSummaryTreemap')}: ${top3}`

  return (
    <div className={cn('relative', className)}>
      {/* Visually-hidden accessible list alternative */}
      <ol className="sr-only" aria-label={ariaLabel} role="list">
        {items.map((item) => (
          <li key={item.categoryId}>
            {item.name}: {formatMoney(item.totalBase, baseCurrency, locale)} ({Math.round(item.pct)}%)
          </li>
        ))}
      </ol>

      {/* Visual treemap — not aria-hidden so focusable buttons inside are reachable */}
      <div
        className="relative overflow-hidden rounded-condor"
        style={{ width, height }}
      >
        {rects.map((rect) => {
          const item = items[rect.index]
          if (!item) return null

          const isRest = item.categoryId === '__rest__'
          const showLabel = rect.w > 64 && rect.h > 40

          const cell = (
            <div
              className={cn(
                'absolute overflow-hidden',
                !isRest && 'cursor-pointer transition-opacity active:opacity-80',
              )}
              style={{
                left: rect.x,
                top: rect.y,
                width: rect.w,
                height: rect.h,
                backgroundColor: item.color,
                // 1px gap via outline trick (avoids layout disruption)
                outline: '1px solid var(--bg)',
              }}
            >
              {showLabel && (
                <div className="flex flex-col p-1.5 h-full justify-end">
                  <span className="font-money text-[10px] leading-tight font-semibold text-on-primary truncate">
                    {item.name}
                  </span>
                  <span className="font-money text-[9px] leading-tight text-on-primary/80 truncate">
                    {formatMoney(item.totalBase, baseCurrency, locale)}
                  </span>
                </div>
              )}
            </div>
          )

          if (isRest) {
            return <div key={item.categoryId}>{cell}</div>
          }

          return (
            <button
              key={item.categoryId}
              type="button"
              onClick={() => onSelect?.(item.categoryId)}
              className="absolute p-0 border-0 bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-condor-primary focus-visible:z-10"
              style={{
                left: rect.x,
                top: rect.y,
                width: rect.w,
                height: rect.h,
              }}
              aria-label={`${item.name} ${formatMoney(item.totalBase, baseCurrency, locale)} ${Math.round(item.pct)}%`}
            >
              <div
                className="w-full h-full overflow-hidden"
                style={{
                  backgroundColor: item.color,
                  // 1px gap via outline trick — match the __rest__ cell separator
                  outline: '1px solid var(--bg)',
                }}
              >
                {showLabel && (
                  <div className="flex flex-col p-1.5 h-full justify-end">
                    <span className="font-money text-[10px] leading-tight font-semibold text-on-primary truncate">
                      {item.name}
                    </span>
                    <span className="font-money text-[9px] leading-tight text-on-primary/80 truncate">
                      {formatMoney(item.totalBase, baseCurrency, locale)}
                    </span>
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
