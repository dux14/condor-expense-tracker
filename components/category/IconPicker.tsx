'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { ICONS, ICON_GROUPS } from '@/lib/domain/icons'

export interface IconPickerProps {
  value: string
  onChange: (key: string) => void
  className?: string
}

export function IconPicker({ value, onChange, className }: IconPickerProps) {
  const t = useTranslations('Categorias')
  return (
    <div
      className={cn('max-h-[40vh] overflow-y-auto overscroll-contain', className)}
      role="group"
      aria-label={t('selectIcon')}
    >
      {ICON_GROUPS.map((group) => (
        <section key={group.id}>
          <h3 className="sticky top-0 z-10 bg-surface px-1 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-txt">
            {t(`iconGroup.${group.id}`)}
          </h3>
          <div className="flex flex-wrap gap-2 pb-2">
            {group.keys.map((key) => {
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
                    'flex size-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-[10px] transition-all duration-150',
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
        </section>
      ))}
    </div>
  )
}
