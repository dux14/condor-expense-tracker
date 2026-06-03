'use client'

import * as React from 'react'
import { CircleDot } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ICONS, isIconKey } from '@/lib/domain/icons'

export interface CategoryBadgeProps {
  color: string
  icon: string
  size?: number
  className?: string
}

export function CategoryBadge({
  color,
  icon,
  size = 40,
  className,
}: CategoryBadgeProps) {
  const IconComponent = isIconKey(icon) ? ICONS[icon] : CircleDot
  const iconSize = Math.round(size * 0.5)

  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full', className)}
      style={{
        width: size,
        height: size,
        backgroundColor: `${color}26`, // ~15% opacity tint
      }}
      aria-hidden="true"
    >
      <IconComponent
        size={iconSize}
        strokeWidth={2}
        style={{ color }}
      />
    </span>
  )
}
