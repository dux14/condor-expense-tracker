'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { ClockIcon } from 'lucide-react'
import { cn, openNativePicker } from '@/lib/utils'

export interface TimePickerRowProps {
  value: string // 'HH:mm'
  onChange: (t: string) => void
  className?: string
}

/** Sibling of DatePickerRow: visible button row + hidden native time input. */
export function TimePickerRow({ value, onChange, className }: TimePickerRowProps) {
  const t = useTranslations('Anadir')
  const inputRef = React.useRef<HTMLInputElement>(null)

  function handleRowClick() {
    openNativePicker(inputRef.current)
  }

  function handleTimeChange(e: React.ChangeEvent<HTMLInputElement>) {
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
          'flex w-full items-center gap-2 px-4',
          'min-h-[52px]',
          'rounded-[12px] bg-surface',
          'border border-outline',
          'text-text',
          'outline-none focus-visible:ring-2 focus-visible:ring-condor-primary/60',
          'active:opacity-80',
        )}
        aria-label={t('timeTapToChange', { label: value })}
      >
        <ClockIcon className="size-[18px] shrink-0 text-muted-txt" />
        <span className="flex-1 text-left text-sm font-medium font-money">{value}</span>
      </button>

      {/* Native time input — visually hidden, covers the row for native picker */}
      <input
        ref={inputRef}
        type="time"
        value={value}
        onChange={handleTimeChange}
        tabIndex={-1}
        aria-hidden="true"
        // text-base: ≥16px so iOS Safari doesn't auto-zoom when showPicker() focuses it
        className="pointer-events-none absolute inset-0 h-full w-full text-base opacity-0"
      />
    </div>
  )
}
