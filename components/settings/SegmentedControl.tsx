'use client'

import { cn } from '@/lib/utils'

export interface SegmentedOption {
  value: string
  label: string
}

interface SegmentedControlProps {
  options: SegmentedOption[]
  value: string
  onChange: (v: string) => void
  className?: string
}

export function SegmentedControl({
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps) {
  return (
    <div
      role="radiogroup"
      className={cn(
        'inline-flex items-center rounded-full bg-surface-2 p-1 gap-1',
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            data-testid={`segment-${opt.value}`}
            onClick={() => onChange(opt.value)}
            className={cn(
              'min-h-[36px] rounded-full px-4 py-1 text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-condor-primary',
              active
                ? 'bg-condor-primary text-on-primary shadow-soft-sm'
                : 'text-muted-txt hover:text-text',
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
