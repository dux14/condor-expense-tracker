'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

export interface TextFieldRowProps {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  icon?: React.ReactNode
  multiline?: boolean
  className?: string
}

export function TextFieldRow({
  label,
  value,
  onChange,
  placeholder,
  icon,
  multiline = false,
  className,
}: TextFieldRowProps) {
  const fieldClasses = cn(
    // Override shadcn defaults for Cóndor surface.
    // text-base on mobile is mandatory: iOS auto-zooms on focus when an
    // input's font-size is below 16px.
    'border-0 bg-transparent px-0 py-0 text-base md:text-sm text-text',
    'placeholder:text-muted-txt',
    // Remove the default shadcn ring/border since the wrapper provides it
    'focus-visible:ring-0 focus-visible:border-0 outline-none',
    // Ensure full width inside the wrapper
    'w-full',
  )

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {/* Label */}
      <span className="text-xs font-medium text-muted-txt">{label}</span>

      {/* Field wrapper */}
      <div
        className={cn(
          // Surface + radius
          'rounded-[12px] bg-surface',
          // Border
          'border border-outline',
          // Layout
          'flex items-start gap-2.5 px-4',
          // Min touch target
          multiline ? 'py-3' : 'min-h-[52px] items-center',
        )}
      >
        {icon && (
          <span className="mt-px shrink-0 text-muted-txt [&_svg]:size-[18px]">
            {icon}
          </span>
        )}

        {multiline ? (
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={3}
            className={cn(fieldClasses, 'min-h-0 resize-none border-0 dark:bg-transparent')}
          />
        ) : (
          <Input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={cn(fieldClasses, 'h-auto border-0 dark:bg-transparent')}
          />
        )}
      </div>
    </div>
  )
}
