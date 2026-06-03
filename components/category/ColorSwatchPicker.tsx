'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { CATEGORY_PALETTE } from '@/lib/domain/palette'

export interface ColorSwatchPickerProps {
  value: string
  onChange: (hex: string) => void
  palette?: string[]
  className?: string
}

export function ColorSwatchPicker({
  value,
  onChange,
  palette = [...CATEGORY_PALETTE],
  className,
}: ColorSwatchPickerProps) {
  const t = useTranslations('Categorias')
  const colorInputRef = React.useRef<HTMLInputElement>(null)

  // Normalize hex to uppercase for comparison
  const normalizedValue = value.toUpperCase()

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {palette.map((hex) => {
        const isSelected = hex.toUpperCase() === normalizedValue
        return (
          <button
            key={hex}
            type="button"
            aria-label={t('colorSwatch', { hex })}
            aria-pressed={isSelected}
            onClick={() => onChange(hex)}
            className={cn(
              'size-8 rounded-full transition-all duration-150',
              isSelected
                ? 'ring-2 ring-offset-2 ring-condor-primary ring-offset-surface'
                : 'ring-0 hover:scale-110',
            )}
            style={{ backgroundColor: hex }}
          />
        )
      })}

      {/* Custom color swatch — native color input styled as a circle */}
      <label
        aria-label={t('customColor')}
        className={cn(
          'relative size-8 cursor-pointer rounded-full transition-all duration-150',
          !palette.some((h) => h.toUpperCase() === normalizedValue)
            ? 'ring-2 ring-offset-2 ring-condor-primary ring-offset-surface'
            : 'ring-0 hover:scale-110',
        )}
        style={{
          backgroundColor:
            !palette.some((h) => h.toUpperCase() === normalizedValue)
              ? value
              : '#888888',
        }}
        title={t('customColor')}
      >
        {/* Render a "+" hint if no custom color is active */}
        {palette.some((h) => h.toUpperCase() === normalizedValue) && (
          <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-white/80 select-none">
            +
          </span>
        )}
        <input
          ref={colorInputRef}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 size-full cursor-pointer rounded-full opacity-0"
          aria-label={t('pickCustomColor')}
        />
      </label>
    </div>
  )
}
