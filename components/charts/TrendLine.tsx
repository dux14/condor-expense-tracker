'use client'

import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { formatMoney } from '@/lib/format/money'
import { linePoints } from '@/lib/domain/geometry'
import type { MonthPoint } from '@/lib/domain/trends'
import type { Currency, Locale } from '@/lib/domain/types'

const WIDTH = 300
const HEIGHT = 64
const PAD = 6 // px breathing room so end dots aren't clipped

interface TrendLineProps {
  series: MonthPoint[]
  baseCurrency: Currency
  locale: Locale
  highlightLast?: boolean // emphasize the most recent point (anchor month)
  className?: string
}

export function TrendLine({
  series,
  baseCurrency,
  locale,
  highlightLast = true,
  className,
}: TrendLineProps) {
  const t = useTranslations('Tendencias')

  const innerW = WIDTH - PAD * 2
  const innerH = HEIGHT - PAD * 2
  const pts = linePoints(series.map((s) => s.totalBase), innerW, innerH).map((p) => ({
    x: p.x + PAD,
    y: p.y + PAD,
  }))

  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const last = pts[pts.length - 1]

  const ariaLabel = `${t('trendSummary')}`

  return (
    <figure className={cn('bg-surface rounded-condor p-3', className)}>
      {series.length > 0 ? (
        <svg
          width="100%"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={ariaLabel}
          className="block"
        >
          {pts.length > 1 && (
            <path
              d={path}
              fill="none"
              stroke="var(--condor-primary)"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {highlightLast && last && (
            <circle cx={last.x} cy={last.y} r={3} fill="var(--condor-primary)" />
          )}
        </svg>
      ) : null}

      {/* Accessible / non-visual fallback: full data table */}
      <table className="sr-only">
        <caption>{t('trendTableCaption')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('monthColumn')}</th>
            <th scope="col">{t('amountColumn')}</th>
          </tr>
        </thead>
        <tbody>
          {series.map((p) => (
            <tr key={p.month}>
              <th scope="row">{p.month}</th>
              <td>{formatMoney(p.totalBase, baseCurrency, locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
