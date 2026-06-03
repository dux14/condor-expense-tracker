'use client'

import { useTranslations } from 'next-intl'
import { SegmentedControl } from '@/components/settings/SegmentedControl'
import type { DashboardView } from '@/lib/domain/types'
import { cn } from '@/lib/utils'

interface ViewSwitcherProps {
  value: DashboardView
  onChange: (v: DashboardView) => void
  className?: string
}

export function ViewSwitcher({ value, onChange, className }: ViewSwitcherProps) {
  const t = useTranslations('Inicio')

  const options = [
    { value: 'bars', label: t('viewBars') },
    { value: 'donut', label: t('viewDonut') },
    { value: 'treemap', label: t('viewTreemap') },
  ]

  return (
    <SegmentedControl
      options={options}
      value={value}
      onChange={(v) => onChange(v as DashboardView)}
      className={cn(className)}
    />
  )
}
