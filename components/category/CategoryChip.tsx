'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import type { Category } from '@/lib/domain/types'
import { CategoryBadge } from './CategoryBadge'

export interface CategoryChipProps {
  category: Category
  selected: boolean
  onSelect: (id: string) => void
  className?: string
}

export function CategoryChip({
  category,
  selected,
  onSelect,
  className,
}: CategoryChipProps) {
  return (
    <button
      type="button"
      role="button"
      aria-pressed={selected}
      onClick={() => onSelect(category.id)}
      className={cn(
        // Base shape & size
        'inline-flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-[12px] px-3 py-2',
        // Surface
        'bg-surface-2 text-text',
        // Typography
        'text-xs font-medium',
        // Transition
        'transition-all duration-150',
        // Selected state: mint ring + slight elevation
        selected
          ? 'ring-2 ring-condor-primary shadow-soft-sm'
          : 'ring-0',
        className,
      )}
    >
      <CategoryBadge color={category.color} icon={category.icon} size={32} />
      <span className="max-w-[64px] truncate text-center">{category.name}</span>
    </button>
  )
}
