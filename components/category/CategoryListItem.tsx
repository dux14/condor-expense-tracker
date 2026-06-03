'use client'

import * as React from 'react'
import { ChevronRight, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Category } from '@/lib/domain/types'
import { CategoryBadge } from './CategoryBadge'

export interface CategoryListItemProps {
  category: Category
  subtitle?: string
  onPress?: () => void
  onEdit?: () => void
  trailing?: 'chevron' | 'edit' | 'none'
  className?: string
}

export function CategoryListItem({
  category,
  subtitle,
  onPress,
  onEdit,
  trailing = 'chevron',
  className,
}: CategoryListItemProps) {
  const content = (
    <div
      className={cn(
        'flex min-h-[56px] w-full items-center gap-3 px-4 py-3',
        className,
      )}
    >
      {/* Badge */}
      <CategoryBadge color={category.color} icon={category.icon} size={40} />

      {/* Name + subtitle */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text">{category.name}</p>
        {subtitle && (
          <p className="font-money text-xs text-muted-txt">{subtitle}</p>
        )}
      </div>

      {/* Trailing */}
      {trailing === 'chevron' && (
        <ChevronRight size={18} className="shrink-0 text-muted-txt" />
      )}
      {trailing === 'edit' && (
        <button
          type="button"
          aria-label={`Edit ${category.name}`}
          onClick={(e) => {
            e.stopPropagation()
            onEdit?.()
          }}
          className="rounded-full p-1.5 text-muted-txt transition-colors hover:bg-surface-2 hover:text-text"
        >
          <Pencil size={16} />
        </button>
      )}
    </div>
  )

  if (onPress) {
    return (
      <button
        type="button"
        onClick={onPress}
        className="w-full text-left transition-colors hover:bg-surface-2 active:bg-surface-3"
      >
        {content}
      </button>
    )
  }

  return <div>{content}</div>
}
