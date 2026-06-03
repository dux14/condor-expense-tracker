'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { ICONS, ICON_KEYS } from '@/lib/domain/icons'

export interface IconPickerProps {
  value: string
  onChange: (key: string) => void
  className?: string
}

export function IconPicker({ value, onChange, className }: IconPickerProps) {
  const t = useTranslations('Categorias')
  return (
    <div
      className={cn(
        'flex flex-wrap gap-2',
        className,
      )}
      role="group"
      aria-label={t('selectIcon')}
    >
      {ICON_KEYS.map((key) => {
        const IconComponent = ICONS[key]
        const isSelected = key === value

        return (
          <button
            key={key}
            type="button"
            aria-label={key}
            aria-pressed={isSelected}
            onClick={() => onChange(key)}
            className={cn(
              'flex size-10 min-h-[40px] min-w-[40px] items-center justify-center rounded-[10px] transition-all duration-150',
              'bg-surface-2 text-text',
              isSelected
                ? 'ring-2 ring-condor-primary bg-surface-3 text-condor-primary'
                : 'ring-0 hover:bg-surface-3',
            )}
          >
            <IconComponent size={20} strokeWidth={2} />
          </button>
        )
      })}
    </div>
  )
}
