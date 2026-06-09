'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { CategoryBadge } from './CategoryBadge'
import { ColorSwatchPicker } from './ColorSwatchPicker'
import { IconPicker } from './IconPicker'
import { CATEGORY_PALETTE } from '@/lib/domain/palette'
import { ICON_KEYS } from '@/lib/domain/icons'

export interface NewCategorySheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial?: {
    name: string
    color: string
    icon: string
    budgetBase?: number | null
  }
  onSubmit: (data: { name: string; color: string; icon: string; budgetBase: number | null }) => void
}

export function NewCategorySheet({
  open,
  onOpenChange,
  initial,
  onSubmit,
}: NewCategorySheetProps) {
  const t = useTranslations('Categorias')

  const [name, setName] = React.useState(initial?.name ?? '')
  const [color, setColor] = React.useState(initial?.color ?? CATEGORY_PALETTE[0])
  const [icon, setIcon] = React.useState(initial?.icon ?? ICON_KEYS[0])
  const [budget, setBudget] = React.useState(initial?.budgetBase != null ? String(initial.budgetBase) : '')

  // React-approved render-phase state sync: track previous `open` in state
  // so we can reset form fields the moment the sheet transitions to open=true.
  // See: https://react.dev/reference/react/useState#storing-information-from-previous-renders
  const [prevOpen, setPrevOpen] = React.useState(open)
  if (prevOpen !== open) {
    setPrevOpen(open)
    if (open) {
      setName(initial?.name ?? '')
      setColor(initial?.color ?? CATEGORY_PALETTE[0])
      setIcon(initial?.icon ?? ICON_KEYS[0])
      setBudget(initial?.budgetBase != null ? String(initial.budgetBase) : '')
    }
  }

  function handleSubmit() {
    if (!name.trim()) return
    const budgetBase = budget.trim() === '' ? null : Number(budget)
    onSubmit({ name: name.trim(), color, icon, budgetBase })
    onOpenChange(false)
  }

  const isEditing = Boolean(initial)
  const title = isEditing ? t('title_edit') : t('title_new')

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-[20px] bg-surface pb-safe max-h-[92dvh] overflow-y-auto">
        <SheetHeader className="pb-2">
          <SheetTitle className="font-heading text-text">{title}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-5 px-4 pb-2">
          {/* Live preview badge */}
          <div className="flex items-center gap-3">
            <CategoryBadge color={color} icon={icon} size={52} />
            <span className="text-sm font-medium text-text truncate">
              {name || <span className="text-muted-txt">{t('name_placeholder')}</span>}
            </span>
          </div>

          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text">{t('name_label')}</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('name_placeholder')}
              maxLength={32}
              className="h-11 rounded-[12px] border-outline bg-surface-2 text-text placeholder:text-muted-txt focus-visible:border-condor-primary focus-visible:ring-condor-primary/30"
            />
          </div>

          {/* Color */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text">{t('color_label')}</label>
            <ColorSwatchPicker value={color} onChange={setColor} />
          </div>

          {/* Icon */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text">{t('icon_label')}</label>
            <IconPicker value={icon} onChange={setIcon} />
          </div>

          {/* Monthly budget (optional) */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="cat-budget" className="text-sm font-medium text-text">
              {t('budget_label')}{' '}
              <span className="text-xs font-normal text-muted-txt">{t('budget_optional')}</span>
            </label>
            <Input
              id="cat-budget"
              inputMode="numeric"
              value={budget}
              onChange={(e) => setBudget(e.target.value.replace(/[^\d]/g, ''))}
              placeholder={t('budget_placeholder')}
              className="h-11 rounded-[12px] border-outline bg-surface-2 text-text placeholder:text-muted-txt font-money focus-visible:border-condor-primary focus-visible:ring-condor-primary/30"
            />
          </div>
        </div>

        <SheetFooter className="px-4 pt-2">
          <button
            type="button"
            disabled={!name.trim()}
            onClick={handleSubmit}
            className={cn(
              'w-full rounded-[12px] py-3.5 text-sm font-semibold transition-all duration-150',
              'bg-condor-primary text-on-primary',
              'disabled:opacity-40 disabled:cursor-not-allowed',
              'hover:opacity-90 active:scale-[0.98]',
            )}
          >
            {t('save')}
          </button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
