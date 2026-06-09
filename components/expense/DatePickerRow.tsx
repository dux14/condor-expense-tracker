'use client'

import { format, parseISO } from 'date-fns'
import { es, enUS } from 'date-fns/locale'
import { useTranslations } from 'next-intl'
import { CalendarIcon, ChevronRightIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { todayKey } from '@/lib/format/date'
import type { ChangeEvent } from 'react'
import type { Locale } from '@/lib/domain/types'

const DATE_FNS_LOCALE = {
  es,
  en: enUS,
}

const DATE_FORMAT: Record<Locale, string> = {
  es: 'd MMM yyyy',
  en: 'MMM d, yyyy',
}

export interface DatePickerRowProps {
  value: string // yyyy-MM-dd
  onChange: (d: string) => void
  locale: Locale
  className?: string
}

export function DatePickerRow({
  value,
  onChange,
  locale,
  className,
}: DatePickerRowProps) {
  const t = useTranslations('Anadir')

  const isToday = value === todayKey()
  const dateObj = parseISO(value)
  const formattedDate = format(dateObj, DATE_FORMAT[locale], {
    locale: DATE_FNS_LOCALE[locale],
  })
  const todayPrefix = t('todayPrefix')
  const label = isToday ? `${todayPrefix}${formattedDate}` : formattedDate

  function handleDateChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.value) {
      onChange(e.target.value)
    }
  }

  return (
    <div
      className={cn(
        'relative rounded-[12px]',
        'focus-within:ring-2 focus-within:ring-condor-primary/60',
        className,
      )}
    >
      {/* Presentational row — non-interactive; the native input below is the tap target */}
      <div
        aria-hidden="true"
        className={cn(
          // Layout
          'flex w-full items-center gap-3 px-4',
          // Touch target / height
          'min-h-[52px]',
          // Surface + radius
          'rounded-[12px] bg-surface',
          // Border
          'border border-outline',
          // Text
          'text-text',
          // Never intercept taps — the input on top handles them
          'pointer-events-none',
        )}
      >
        <CalendarIcon className="size-[18px] shrink-0 text-muted-txt" />
        <span className="flex-1 text-left text-sm font-medium">{label}</span>
        <ChevronRightIcon className="size-4 shrink-0 text-muted-txt" />
      </div>

      {/* Native date input — the real interactive overlay. Direct taps open the
          native picker on iOS Safari + desktop (no JS showPicker needed).
          text-base (≥16px) prevents iOS auto-zoom on focus. */}
      <input
        type="date"
        value={value}
        onChange={handleDateChange}
        aria-label={t('dateTapToChange', { label })}
        className="absolute inset-0 h-full w-full cursor-pointer text-base opacity-0"
      />
    </div>
  )
}
