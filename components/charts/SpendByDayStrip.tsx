'use client'

import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { dayBarHeights } from '@/lib/domain/geometry'
import type { Locale } from '@/lib/domain/types'

const MAX_BAR_HEIGHT = 48 // px — component's visual ceiling
const MIN_BAR_HEIGHT = 3  // px — ensure nonzero days are always visible

interface DaySeries {
  day: number
  totalBase: number
  isToday: boolean
}

interface SpendByDayStripProps {
  series: DaySeries[]
  locale: Locale
  className?: string
}

export function SpendByDayStrip({ series, className }: SpendByDayStripProps) {
  const t = useTranslations('Inicio')

  const heights = dayBarHeights(series.map((s) => s.totalBase), MAX_BAR_HEIGHT)

  const todayIndex = series.findIndex((s) => s.isToday)
  const firstDay = series[0]?.day ?? 1
  const lastDay = series[series.length - 1]?.day ?? 30
  const daysInMonth = series.length

  // Suppress edge numeric labels when today bar is too close and would overlap.
  // Only relevant for real month lengths (≥10 days); short test series always show both.
  // Suppress first-day label when today is within the first 3 bars of the strip,
  // suppress last-day label when today is within the last 3 bars.
  const isRealMonth = daysInMonth >= 10
  const showFirstDayLabel =
    !isRealMonth || todayIndex < 0 || todayIndex > 2
  const showLastDayLabel =
    !isRealMonth || todayIndex < 0 || todayIndex < daysInMonth - 3

  const ariaLabel = t('chartSummaryDays')

  return (
    <div
      className={cn('bg-surface rounded-condor p-4 flex flex-col gap-2', className)}
      role="img"
      aria-label={ariaLabel}
    >
      {/* Bar strip */}
      <div className="flex items-end gap-px" style={{ height: MAX_BAR_HEIGHT }}>
        {series.map((day, i) => {
          const rawH = heights[i] ?? 0
          // Apply min-height only when value > 0
          const h = day.totalBase > 0 ? Math.max(rawH, MIN_BAR_HEIGHT) : 0

          return (
            <div
              key={day.day}
              data-today={day.isToday ? 'true' : undefined}
              className={cn(
                'flex-1 rounded-sm transition-none',
                day.isToday
                  ? 'bg-condor-primary'
                  : 'bg-surface-3',
              )}
              style={{ height: h }}
              aria-hidden="true"
            />
          )
        })}
      </div>

      {/* Axis: first day | today (centered under its bar) | last day */}
      <div className="relative flex items-center text-[10px] text-muted-txt select-none" style={{ height: 16 }}>
        {/* First day — suppressed when today is within the first 3 days */}
        {showFirstDayLabel && (
          <span className="absolute left-0">
            {String(firstDay).padStart(2, '0')}
          </span>
        )}

        {/* Today label — centered under the today bar */}
        {todayIndex >= 0 && series.length > 0 && (
          <span
            className="absolute text-condor-primary font-medium"
            style={{
              left: `${((todayIndex + 0.5) / series.length) * 100}%`,
              transform: 'translateX(-50%)',
            }}
          >
            {t('today')}
          </span>
        )}

        {/* Last day — suppressed when today is within the last 3 days */}
        {showLastDayLabel && (
          <span className="absolute right-0">
            {String(lastDay).padStart(2, '0')}
          </span>
        )}
      </div>
    </div>
  )
}
