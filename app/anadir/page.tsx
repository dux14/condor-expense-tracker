'use client'

import * as React from 'react'
import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ChevronLeft, Plus, Store, AlignLeft, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { todayKey } from '@/lib/format/date'
import { useCondorStore, defaultStore } from '@/lib/store/store'
import { AmountInput } from '@/components/expense/AmountInput'
import { CurrencyPill } from '@/components/expense/CurrencyPill'
import { DatePickerRow } from '@/components/expense/DatePickerRow'
import { TextFieldRow } from '@/components/expense/TextFieldRow'
import { CategoryChip } from '@/components/category/CategoryChip'
import { NewCategorySheet } from '@/components/category/NewCategorySheet'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'

// ---------------------------------------------------------------------------
// Inner component — uses useSearchParams, must live inside <Suspense>
// ---------------------------------------------------------------------------

function AnadirContent() {
  const t = useTranslations('Anadir')
  const tCommon = useTranslations('Common')
  const router = useRouter()
  const searchParams = useSearchParams()

  const editId = searchParams.get('id') ?? undefined
  const isEditMode = Boolean(editId)

  // ── Store selectors ────────────────────────────────────────────────────
  const expenses = useCondorStore((s) => s.expenses)
  const categories = useCondorStore((s) => s.categories)
  const settings = useCondorStore((s) => s.settings)
  const addExpense = useCondorStore((s) => s.addExpense)
  const updateExpense = useCondorStore((s) => s.updateExpense)
  const deleteExpense = useCondorStore((s) => s.deleteExpense)
  const addCategory = useCondorStore((s) => s.addCategory)

  const { baseCurrency, locale } = settings

  // Resolve the expense being edited (undefined in add mode)
  const editingExpense = editId
    ? expenses.find((e) => e.id === editId)
    : undefined

  // ── Local form state ───────────────────────────────────────────────────
  const [amountText, setAmountText] = React.useState<string>(
    isEditMode && editingExpense ? String(editingExpense.amount) : '',
  )
  const [amountValue, setAmountValue] = React.useState<number>(
    isEditMode && editingExpense ? editingExpense.amount : NaN,
  )
  const [currency, setCurrency] = React.useState<string>(
    isEditMode && editingExpense ? editingExpense.currency : baseCurrency,
  )
  const [date, setDate] = React.useState<string>(
    isEditMode && editingExpense ? editingExpense.date : todayKey(),
  )
  const [categoryId, setCategoryId] = React.useState<string>(
    isEditMode && editingExpense ? editingExpense.categoryId : '',
  )
  const [merchant, setMerchant] = React.useState<string>(
    isEditMode && editingExpense ? (editingExpense.merchant ?? '') : '',
  )
  const [note, setNote] = React.useState<string>(
    isEditMode && editingExpense ? (editingExpense.note ?? '') : '',
  )

  // ── UI state ───────────────────────────────────────────────────────────
  const [saving, setSaving] = React.useState(false)
  const [newCategorySheetOpen, setNewCategorySheetOpen] = React.useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false)

  // ── Derived ────────────────────────────────────────────────────────────
  const isValid = amountValue > 0 && !isNaN(amountValue) && categoryId !== ''
  const showConvertHint = currency !== baseCurrency
  const isFutureDate = date > todayKey()

  // Visible categories (not hidden)
  const visibleCategories = categories.filter((c) => !c.hidden)

  // ── Handlers ───────────────────────────────────────────────────────────
  function handleAmountChange(amount: number, text: string) {
    setAmountValue(amount)
    setAmountText(text)
  }

  async function handleNewCategory(data: { name: string; color: string; icon: string }) {
    // addCategory calls zustand set() synchronously after the repo await,
    // so defaultStore.getState() reflects the updated categories immediately
    // after the promise resolves — no effect needed.
    await addCategory(data)
    const updatedCategories = defaultStore.getState().categories
    const customCats = updatedCategories.filter((c) => !c.isPreset)
    if (customCats.length > 0) {
      setCategoryId(customCats[customCats.length - 1].id)
    }
  }

  async function handleSave() {
    if (!isValid || saving) return
    setSaving(true)
    try {
      if (isEditMode && editId) {
        await updateExpense(editId, {
          amount: amountValue,
          currency,
          date,
          categoryId,
          merchant: merchant.trim() || undefined,
          note: note.trim() || undefined,
        })
        router.push('/historico')
      } else {
        await addExpense({
          amount: amountValue,
          currency,
          date,
          categoryId,
          merchant: merchant.trim() || undefined,
          note: note.trim() || undefined,
        })
        router.push('/')
      }
    } catch {
      toast.error(t('saveError'))
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!editId) return
    try {
      await deleteExpense(editId)
      toast.success(t('deleted'))
      router.push('/historico')
    } catch {
      toast.error(t('saveError'))
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-dvh bg-bg">
      <div className="mx-auto flex max-w-[480px] flex-col px-4 pb-8">

        {/* ── Top bar ─────────────────────────────────────────────────── */}
        <header className="flex items-center justify-between pt-4 pb-2 min-h-[56px]">
          {/* Back */}
          <button
            type="button"
            onClick={() => router.back()}
            aria-label={tCommon('back')}
            className={cn(
              'flex items-center justify-center min-h-[44px] min-w-[44px] -ml-2 rounded-full',
              'text-text transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-condor-primary',
            )}
          >
            <ChevronLeft size={24} strokeWidth={2} />
          </button>

          {/* Title */}
          <h1 className="font-heading text-base font-semibold text-text">
            {isEditMode ? t('titleEdit') : t('titleAdd')}
          </h1>

          {/* Right actions */}
          <div className="flex items-center gap-1">
            {/* Delete affordance (edit mode only) */}
            {isEditMode && (
              <button
                type="button"
                onClick={() => setConfirmDeleteOpen(true)}
                aria-label={tCommon('delete')}
                className={cn(
                  'flex items-center justify-center min-h-[44px] min-w-[44px] rounded-full',
                  'text-danger transition-colors hover:bg-danger/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/60',
                )}
              >
                <Trash2 size={18} strokeWidth={2} />
              </button>
            )}

            {/* Save text button */}
            <button
              type="button"
              onClick={handleSave}
              disabled={!isValid || saving}
              className={cn(
                'px-3 py-1.5 text-sm font-semibold rounded-full transition-colors',
                'text-condor-primary',
                'hover:bg-condor-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-condor-primary',
                'disabled:opacity-40 disabled:cursor-not-allowed',
              )}
            >
              {tCommon('save')}
            </button>
          </div>
        </header>

        {/* ── Amount block ─────────────────────────────────────────────── */}
        <div className="flex flex-col items-center py-6">
          <div className="flex items-center gap-2">
            {/* Dollar sign */}
            <span className="font-money text-[44px] leading-none text-condor-primary">
              $
            </span>
            {/* Amount input */}
            <AmountInput
              initialText={amountText}
              locale={locale}
              currencyCode={currency}
              onAmountChange={handleAmountChange}
              autoFocus={!isEditMode}
              className="w-[140px]"
            />
            {/* Currency pill */}
            <CurrencyPill value={currency} onChange={setCurrency} />
          </div>

          {/* Conversion hint */}
          {showConvertHint && (
            <p className="mt-2 text-xs text-muted-txt">
              {t('convertHint')}
            </p>
          )}
        </div>

        {/* ── Date ─────────────────────────────────────────────────────── */}
        <div className="mb-1">
          <DatePickerRow value={date} onChange={setDate} locale={locale} />
        </div>

        {/* Future date warning */}
        {isFutureDate && (
          <p className="mb-3 mt-1 text-xs text-muted-txt">
            {t('futureWarning')}
          </p>
        )}

        {/* ── Categories ────────────────────────────────────────────────── */}
        <div className="mt-4">
          <span className="mb-2 block text-xs font-medium text-muted-txt">
            {t('category')}
          </span>
          {/* Horizontally scrollable chip row */}
          <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {visibleCategories.map((cat) => (
              <CategoryChip
                key={cat.id}
                category={cat}
                selected={categoryId === cat.id}
                onSelect={setCategoryId}
                className="shrink-0"
              />
            ))}

            {/* + Nueva chip */}
            <button
              type="button"
              onClick={() => setNewCategorySheetOpen(true)}
              aria-label={t('newCategory')}
              className={cn(
                'inline-flex min-h-[44px] shrink-0 flex-col items-center justify-center gap-1 rounded-[12px] px-3 py-2',
                'bg-surface-2 text-muted-txt',
                'text-xs font-medium transition-all duration-150',
                'hover:text-text hover:ring-2 hover:ring-outline',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-condor-primary',
              )}
            >
              <Plus size={20} strokeWidth={2} />
              <span>{t('newCategory')}</span>
            </button>
          </div>
        </div>

        {/* ── Merchant ──────────────────────────────────────────────────── */}
        <div className="mt-4">
          <TextFieldRow
            label={t('merchant')}
            value={merchant}
            onChange={setMerchant}
            placeholder={t('merchantPh')}
            icon={<Store />}
          />
        </div>

        {/* ── Note ──────────────────────────────────────────────────────── */}
        <div className="mt-4">
          <TextFieldRow
            label={t('note')}
            value={note}
            onChange={setNote}
            placeholder={t('notePh')}
            icon={<AlignLeft />}
            multiline
          />
        </div>

        {/* ── Primary save button ───────────────────────────────────────── */}
        <div className="mt-8">
          <button
            type="button"
            data-testid="save-expense"
            onClick={handleSave}
            disabled={!isValid || saving}
            className={cn(
              'w-full rounded-full py-4 text-base font-semibold transition-all duration-150',
              'bg-condor-primary text-on-primary',
              'hover:opacity-90 active:scale-[0.98]',
              'disabled:opacity-40 disabled:cursor-not-allowed',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-condor-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
            )}
          >
            {saving ? tCommon('loading') : t('saveExpense')}
          </button>
        </div>

      </div>

      {/* ── Sheets & dialogs ──────────────────────────────────────────── */}
      <NewCategorySheet
        open={newCategorySheetOpen}
        onOpenChange={setNewCategorySheetOpen}
        onSubmit={handleNewCategory}
      />

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title={tCommon('delete')}
        description={isEditMode ? undefined : undefined}
        confirmLabel={tCommon('delete')}
        cancelLabel={tCommon('cancel')}
        destructive
        onConfirm={handleDelete}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page export — wraps content in Suspense for static export compatibility
// (useSearchParams requires Suspense boundary with output: 'export')
// ---------------------------------------------------------------------------

export default function AnadirPage() {
  return (
    <Suspense>
      <AnadirContent />
    </Suspense>
  )
}
