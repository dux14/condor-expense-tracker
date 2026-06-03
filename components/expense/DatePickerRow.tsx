'use client'

import * as React from 'react'
import { format, parseISO } from 'date-fns'
import { es, enUS } from 'date-fns/locale'
import { CalendarIcon, ChevronRightIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { todayKey } from '@/lib/format/date'
import type { Locale } from '@/lib/domain/types'

const DATE_FNS_LOCALE = {
  es,
  en: enUS,
}

const TODAY_PREFIX: Record<Locale, string> = {
  es: 'Hoy · ',
  en: 'Today · ',
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
  const inputRef = React.useRef<HTMLInputElement>(null)

  const isToday = value === todayKey()
  const dateObj = parseISO(value)
  const formattedDate = format(dateObj, DATE_FORMAT[locale], {
    locale: DATE_FNS_LOCALE[locale],
  })
  const label = isToday ? `${TODAY_PREFIX[locale]}${formattedDate}` : formattedDate

  function handleRowClick() {
    if (inputRef.current) {
      // showPicker is available in modern browsers; falls back to click
      if (typeof inputRef.current.showPicker === 'function') {
        inputRef.current.showPicker()
      } else {
        inputRef.current.click()
      }
    }
  }

  function handleDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.value) {
      onChange(e.target.value)
    }
  }

  return (
    <div className={cn('relative', className)}>
      {/* Visible row */}
      <button
        type="button"
        onClick={handleRowClick}
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
          // Focus ring
          'outline-none focus-visible:ring-2 focus-visible:ring-condor-primary/60',
          // Active press feel
          'active:opacity-80',
        )}
        aria-label={`Date: ${label}. Tap to change.`}
      >
        <CalendarIcon className="size-[18px] shrink-0 text-muted-txt" />
        <span className="flex-1 text-left text-sm font-medium">{label}</span>
        <ChevronRightIcon className="size-4 shrink-0 text-muted-txt" />
      </button>

      {/* Native date input — visually hidden, covers the row for native picker */}
      <input
        ref={inputRef}
        type="date"
        value={value}
        onChange={handleDateChange}
        tabIndex={-1}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
      />
    </div>
  )
}
