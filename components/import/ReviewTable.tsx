'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { ReviewRow } from './ReviewRow'
import type { CategorizedTransaction } from '@/lib/import/rules-engine'
import type { Category } from '@/lib/domain/types'
import type { RawTransaction } from '@/lib/import/templates/types'

export interface ReviewTableProps {
  rows: Array<CategorizedTransaction & { selected: boolean }>
  categories: Category[]
  onToggle(index: number): void
  onToggleAll(selected: boolean): void
  /** Patch for date/amount/currency; { merchant } maps to description in the parent. */
  onEdit(
    index: number,
    patch: Partial<Pick<RawTransaction, 'date' | 'amount' | 'currency'>> & {
      merchant?: string
    },
  ): void
  onChangeCategory(index: number, categoryId: string): void
  onImport(): void
}

export function ReviewTable({
  rows,
  categories,
  onToggle,
  onToggleAll,
  onEdit,
  onChangeCategory,
  onImport,
}: ReviewTableProps) {
  const t = useTranslations('Importar')

  const selectedCount = rows.filter((r) => r.selected).length

  return (
    <div className="flex flex-col">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="text-base font-semibold text-text">{t('reviewTitle')}</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onToggleAll(true)}
            className={cn(
              'min-h-[44px] rounded-lg px-3 text-sm font-medium text-condor-primary',
              'active:scale-95 transition-all duration-150',
            )}
          >
            {t('selectAll')}
          </button>
          <button
            type="button"
            onClick={() => onToggleAll(false)}
            className={cn(
              'min-h-[44px] rounded-lg px-3 text-sm font-medium text-text-2',
              'active:scale-95 transition-all duration-150',
            )}
          >
            {t('deselectAll')}
          </button>
        </div>
      </div>

      {/* ── Row list ────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 pb-24">
        {rows.map((row, index) => (
          <ReviewRow
            key={index}
            row={row}
            rowIndex={index}
            categories={categories}
            onToggle={onToggle}
            onEdit={onEdit}
            onChangeCategory={onChangeCategory}
          />
        ))}
      </div>

      {/* ── Sticky footer ───────────────────────────────────────────────── */}
      <div
        className={cn(
          'fixed bottom-0 left-0 right-0 bg-surface-1/90 backdrop-blur-sm',
          'px-4 pt-3 pb-[env(safe-area-inset-bottom)]',
          'border-t border-surface-3',
        )}
      >
        <button
          type="button"
          disabled={selectedCount === 0}
          onClick={onImport}
          className={cn(
            'w-full min-h-[52px] rounded-2xl text-sm font-semibold',
            'bg-condor-primary text-white active:scale-95 transition-all duration-150',
            'disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100',
          )}
        >
          {t('importN', { n: selectedCount })}
        </button>
      </div>
    </div>
  )
}
