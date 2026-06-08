'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { CategoryChip } from '@/components/category/CategoryChip'
import type { CategorizedTransaction } from '@/lib/import/rules-engine'
import type { Category } from '@/lib/domain/types'
import type { RawTransaction } from '@/lib/import/templates/types'

export interface ReviewRowProps {
  row: CategorizedTransaction & { selected: boolean }
  rowIndex: number
  categories: Category[]
  onToggle(index: number): void
  /** Patch for date/amount/currency; merchant maps to `description` in the parent (Task 10). */
  onEdit(
    index: number,
    patch: Partial<Pick<RawTransaction, 'date' | 'amount' | 'currency'>> & {
      merchant?: string
    },
  ): void
  onChangeCategory(index: number, categoryId: string): void
}

export function ReviewRow({
  row,
  rowIndex,
  categories,
  onToggle,
  onEdit,
  onChangeCategory,
}: ReviewRowProps) {
  const t = useTranslations('Importar')
  const [pickerOpen, setPickerOpen] = React.useState(false)

  // Local text state lets the user type freely; onEdit fires on every change.
  // The parent is responsible for updating `row` (or not — inputs stay locally
  // controlled while the picker/selection state comes from props).
  const [merchantText, setMerchantText] = React.useState(row.description)
  const [amountText, setAmountText] = React.useState(String(row.amount))
  const [dateText, setDateText] = React.useState(row.date)

  const currentCategory = categories.find((c) => c.id === row.categoryId)

  function handleAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    setAmountText(raw)
    const parsed = Number(raw)
    // Only emit when the value is a finite number (guards against empty string → NaN)
    if (!Number.isNaN(parsed)) {
      onEdit(rowIndex, { amount: parsed })
    }
  }

  function handleMerchantChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setMerchantText(val)
    // NOTE: RawTransaction stores the merchant text in `description`.
    // This component exposes it via the `merchant` key in the patch so the
    // parent (ImportFlow / Task 10) can map { merchant } → { description }.
    onEdit(rowIndex, { merchant: val })
  }

  function handleDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setDateText(val)
    onEdit(rowIndex, { date: val })
  }

  function handleCategorySelect(categoryId: string) {
    onChangeCategory(rowIndex, categoryId)
    setPickerOpen(false)
  }

  return (
    <div
      className={cn(
        'rounded-xl bg-surface-2 p-3 shadow-soft-sm',
        'flex flex-col gap-2',
        row.selected ? 'ring-2 ring-condor-primary' : 'ring-0',
      )}
    >
      {/* ── Row header: checkbox + date + amount ─────────────────────────── */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          aria-label={`seleccionar fila ${rowIndex + 1}`}
          checked={row.selected}
          onChange={() => onToggle(rowIndex)}
          className="min-h-[44px] min-w-[44px] cursor-pointer accent-condor-primary"
        />

        {/* Date */}
        <label className="sr-only" htmlFor={`date-${rowIndex}`}>
          {t('colDate')}
        </label>
        <input
          id={`date-${rowIndex}`}
          type="date"
          value={dateText}
          onChange={handleDateChange}
          className={cn(
            'min-h-[44px] flex-1 rounded-lg bg-surface-3 px-2 py-1 text-sm text-text',
            'focus:outline-none focus:ring-2 focus:ring-condor-primary',
          )}
        />

        {/* Amount */}
        <label className="sr-only" htmlFor={`amount-${rowIndex}`}>
          {t('colAmount')}
        </label>
        <input
          id={`amount-${rowIndex}`}
          type="text"
          inputMode="decimal"
          value={amountText}
          onChange={handleAmountChange}
          className={cn(
            'min-h-[44px] w-24 rounded-lg bg-surface-3 px-2 py-1 text-right text-sm text-text',
            'focus:outline-none focus:ring-2 focus:ring-condor-primary',
          )}
        />
      </div>

      {/* ── Merchant ─────────────────────────────────────────────────────── */}
      <div>
        <label className="sr-only" htmlFor={`merchant-${rowIndex}`}>
          {t('colMerchant')}
        </label>
        <input
          id={`merchant-${rowIndex}`}
          type="text"
          // row.description is the raw merchant line from the bank statement
          value={merchantText}
          onChange={handleMerchantChange}
          className={cn(
            'min-h-[44px] w-full rounded-lg bg-surface-3 px-2 py-1 text-sm text-text',
            'focus:outline-none focus:ring-2 focus:ring-condor-primary',
          )}
        />
      </div>

      {/* ── Category trigger + inline chip grid ──────────────────────────── */}
      <div>
        <button
          type="button"
          aria-label={t('colCategory')}
          onClick={() => setPickerOpen((v) => !v)}
          className={cn(
            'inline-flex min-h-[44px] items-center gap-2 rounded-lg px-3 py-1',
            'bg-surface-3 text-sm text-text active:scale-95 transition-all duration-150',
          )}
        >
          <span className="font-medium">{t('colCategory')}:</span>
          <span>{currentCategory?.name ?? '—'}</span>
        </button>

        {pickerOpen && (
          <div
            className="mt-2 flex flex-wrap gap-2"
            role="group"
            aria-label={t('colCategory')}
          >
            {categories.map((cat) => (
              <CategoryChip
                key={cat.id}
                category={cat}
                selected={cat.id === row.categoryId}
                onSelect={handleCategorySelect}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
