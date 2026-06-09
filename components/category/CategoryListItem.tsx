'use client'

import * as React from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Category } from '@/lib/domain/types'
import { CategoryBadge } from './CategoryBadge'

export interface CategoryListItemProps {
  category: Category
  subtitle?: string
  onPress?: () => void
  trailing?: 'chevron' | 'none'
  /** Optional custom action nodes rendered at the trailing edge, replacing the built-in trailing. */
  actions?: React.ReactNode
  className?: string
  /** Optional content rendered below the subtitle, inside the name column. */
  below?: React.ReactNode
}

export function CategoryListItem({
  category,
  subtitle,
  onPress,
  trailing = 'chevron',
  actions,
  className,
  below,
}: CategoryListItemProps) {
  const main = (
    <>
      {/* Badge — nudge down slightly when below is present so it aligns with the name line */}
      <CategoryBadge
        color={category.color}
        icon={category.icon}
        size={40}
        className={below ? 'mt-0.5' : undefined}
      />

      {/* Name + subtitle + below */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text">{category.name}</p>
        {subtitle && (
          <p className="font-money text-xs text-muted-txt">{subtitle}</p>
        )}
        {below}
      </div>
    </>
  )

  // Custom actions take priority over built-in trailing
  const trailingNode = actions ? (
    <div className="flex items-center gap-1 shrink-0">{actions}</div>
  ) : (
    trailing === 'chevron' && (
      <ChevronRight size={18} className="shrink-0 text-muted-txt" />
    )
  )

  const crossAlign = below ? 'items-start' : 'items-center'

  if (onPress) {
    // The pressable area and the trailing actions are siblings — interactive
    // elements must never nest inside the row button.
    return (
      <div
        className={cn(
          'flex w-full gap-3 pr-4 transition-colors hover:bg-surface-2',
          crossAlign,
          className,
        )}
      >
        <button
          type="button"
          onClick={onPress}
          className={cn(
            'flex min-h-[56px] min-w-0 flex-1 gap-3 px-4 py-3 text-left active:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-condor-primary',
            crossAlign,
          )}
        >
          {main}
        </button>
        {trailingNode}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex min-h-[56px] w-full gap-3 px-4 py-3',
        crossAlign,
        className,
      )}
    >
      {main}
      {trailingNode}
    </div>
  )
}
