'use client'

import { useTranslations } from 'next-intl'
import { ClockIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ChangeEvent } from 'react'

export interface TimePickerRowProps {
  value: string // 'HH:mm'
  onChange: (t: string) => void
  className?: string
}

/** Sibling of DatePickerRow: presentational row + native time input on top as the tap target. */
export function TimePickerRow({ value, onChange, className }: TimePickerRowProps) {
  const t = useTranslations('Anadir')

  function handleTimeChange(e: ChangeEvent<HTMLInputElement>) {
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
          'flex w-full items-center gap-2 px-4',
          'min-h-[52px]',
          'rounded-[12px] bg-surface',
          'border border-outline',
          'text-text',
          'pointer-events-none',
        )}
      >
        <ClockIcon className="size-[18px] shrink-0 text-muted-txt" />
        <span className="flex-1 text-left text-sm font-medium font-money">{value}</span>
      </div>

      {/* Native time input — the real interactive overlay. Direct taps open the
          native picker on iOS Safari + desktop. text-base (≥16px) prevents iOS auto-zoom. */}
      <input
        type="time"
        value={value}
        onChange={handleTimeChange}
        aria-label={t('timeTapToChange', { label: value })}
        className="absolute inset-0 h-full w-full cursor-pointer text-base opacity-0"
      />
    </div>
  )
}
