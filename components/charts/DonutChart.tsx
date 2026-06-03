'use client'

import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { formatMoney } from '@/lib/format/money'
import { donutArcs, type RankedItem } from '@/lib/domain/geometry'
import type { Currency, Locale } from '@/lib/domain/types'

const SIZE = 160
const STROKE = 28
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

interface DonutChartProps {
  items: RankedItem[]
  baseCurrency: Currency
  locale: Locale
  className?: string
}

export function DonutChart({ items, baseCurrency, locale, className }: DonutChartProps) {
  const t = useTranslations('Inicio')

  const arcs = donutArcs(
    items.map((i) => i.totalBase),
    CIRCUMFERENCE,
  )

  // Build aria-label from top categories
  const top3 = items.slice(0, 3).map((i) => `${i.name} ${Math.round(i.pct)}%`).join(', ')
  const ariaLabel = `${t('chartSummaryDonut')}: ${top3}`

  return (
    <div className={cn('flex flex-col items-center gap-4', className)}>
      {/* SVG donut */}
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={ariaLabel}
        className="shrink-0"
      >
        {/* Background track */}
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="var(--surface-3)"
          strokeWidth={STROKE}
        />
        {/* Segments: rotate -90° so they start at the top */}
        <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
          {arcs.map((arc, i) => {
            if (arc.length <= 0) return null
            return (
              <circle
                key={items[i].categoryId}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke={items[i].color}
                strokeWidth={STROKE}
                strokeDasharray={`${arc.length} ${CIRCUMFERENCE - arc.length}`}
                strokeDashoffset={-arc.offset}
              />
            )
          })}
        </g>
      </svg>

      {/* Legend — accessible fallback list */}
      <ol className="flex flex-col gap-1.5 w-full" role="list">
        {items.map((item) => (
          <li key={item.categoryId} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 min-w-0">
              {/* Color dot */}
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: item.color }}
                aria-hidden="true"
              />
              <span className="text-sm text-text truncate">{item.name}</span>
            </span>
            <span className="font-money text-sm text-text whitespace-nowrap shrink-0">
              {formatMoney(item.totalBase, baseCurrency, locale)}&nbsp;
              <span className="text-muted-txt text-xs">{Math.round(item.pct)}%</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
