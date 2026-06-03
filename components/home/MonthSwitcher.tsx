'use client'

import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import { formatMonthLabel, prevMonthKey, nextMonthKey } from '@/lib/format/date'
import type { Locale } from '@/lib/domain/types'
import { cn } from '@/lib/utils'

interface MonthSwitcherProps {
  value: string // yyyy-MM
  onChange: (m: string) => void
  locale: Locale
  className?: string
}

export function MonthSwitcher({ value, onChange, locale, className }: MonthSwitcherProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full bg-surface-2 px-1 py-1 gap-0.5',
        className,
      )}
    >
      {/* Prev chevron */}
      <button
        type="button"
        aria-label="Mes anterior"
        onClick={() => onChange(prevMonthKey(value))}
        className={cn(
          'flex items-center justify-center rounded-full',
          'min-h-[44px] min-w-[44px]',
          'text-muted-txt hover:text-text transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-condor-primary',
        )}
      >
        <ChevronLeft size={18} strokeWidth={2.5} />
      </button>

      {/* Label + decorative chevron-down */}
      <span className="flex items-center gap-1 px-2 text-sm font-medium text-text select-none whitespace-nowrap">
        {formatMonthLabel(value, locale)}
        <ChevronDown size={14} strokeWidth={2.5} className="text-muted-txt" aria-hidden />
      </span>

      {/* Next chevron */}
      <button
        type="button"
        aria-label="Mes siguiente"
        onClick={() => onChange(nextMonthKey(value))}
        className={cn(
          'flex items-center justify-center rounded-full',
          'min-h-[44px] min-w-[44px]',
          'text-muted-txt hover:text-text transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-condor-primary',
        )}
      >
        <ChevronRight size={18} strokeWidth={2.5} />
      </button>
    </div>
  )
}
