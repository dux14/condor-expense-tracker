'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ChevronLeft, Pencil, Trash2, PlusCircle } from 'lucide-react'

import { useCondorStore } from '@/lib/store/store'
import { expensesInMonth } from '@/lib/domain/selectors'
import { CATEGORY_PALETTE } from '@/lib/domain/palette'
import { OTROS_ID } from '@/lib/domain/presets'
import { formatMoney } from '@/lib/format/money'
import { CategoryListItem } from '@/components/category/CategoryListItem'
import { NewCategorySheet } from '@/components/category/NewCategorySheet'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { BottomNav } from '@/components/nav/BottomNav'

export default function CategoriasPage() {
  const t = useTranslations('Categorias')
  const tCommon = useTranslations('Common')
  const router = useRouter()

  const expenses = useCondorStore((s) => s.expenses)
  const categories = useCondorStore((s) => s.categories)
  const settings = useCondorStore((s) => s.settings)
  const month = useCondorStore((s) => s.month)
  const addCategory = useCondorStore((s) => s.addCategory)
  const updateCategory = useCondorStore((s) => s.updateCategory)
  const deleteCategory = useCondorStore((s) => s.deleteCategory)

  const { baseCurrency, locale } = settings

  // Per-category month total
  const inMonth = expensesInMonth(expenses, month)
  function totalById(id: string): string {
    const sum = inMonth
      .filter((e) => e.categoryId === id && e.baseAmount != null)
      .reduce((s, e) => s + (e.baseAmount ?? 0), 0)
    return formatMoney(sum, baseCurrency, locale)
  }

  // Split preset vs custom categories
  const presetCategories = categories.filter((c) => c.isPreset && !c.hidden)
  const customCategories = categories.filter((c) => !c.isPreset)

  // Sheet state for add / edit
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [editingCategory, setEditingCategory] = React.useState<{
    id: string
    name: string
    color: string
    icon: string
  } | null>(null)

  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = React.useState<string | null>(null)
  const deleteTargetHasExpenses = deleteTarget
    ? expenses.some((e) => e.categoryId === deleteTarget)
    : false

  function openAdd() {
    setEditingCategory(null)
    setSheetOpen(true)
  }

  function openEdit(cat: { id: string; name: string; color: string; icon: string }) {
    setEditingCategory(cat)
    setSheetOpen(true)
  }

  async function handleSheetSubmit(data: { name: string; color: string; icon: string }) {
    if (editingCategory) {
      await updateCategory(editingCategory.id, data)
    } else {
      await addCategory(data)
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return
    try {
      await deleteCategory(deleteTarget, OTROS_ID)
    } catch {
      // deleteCategory throws for presets — shouldn't reach here since custom only
    }
    setDeleteTarget(null)
  }

  return (
    <main className="min-h-dvh bg-bg pb-28">
      <div className="mx-auto max-w-[480px] px-5">

        {/* ── Top bar ───────────────────────────────────────────────── */}
        <header className="flex items-center gap-2 pt-5 pb-4">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label={tCommon('back')}
            className="flex items-center justify-center min-h-[40px] min-w-[40px] -ml-2 rounded-full text-muted-txt hover:text-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-condor-primary"
          >
            <ChevronLeft size={22} />
          </button>
          <h1 className="font-heading text-xl font-semibold text-text">
            {t('title')}
          </h1>
        </header>

        {/* ── Preset categories ─────────────────────────────────────── */}
        <section className="mb-6">
          <p className="mb-2 text-xs font-semibold tracking-wider text-muted-txt">
            {t('presets')}
          </p>
          <div className="overflow-hidden rounded-[12px] bg-surface">
            {presetCategories.map((cat, i) => (
              <div key={cat.id}>
                {i > 0 && <div className="mx-4 h-px bg-outline/40" />}
                <CategoryListItem
                  category={cat}
                  subtitle={totalById(cat.id)}
                  trailing="chevron"
                  onPress={() =>
                    router.push('/historico?cat=' + cat.id + '&m=' + month)
                  }
                  actions={
                    <button
                      type="button"
                      aria-label={tCommon('editNamed', { name: cat.name })}
                      onClick={() =>
                        openEdit({
                          id: cat.id,
                          name: cat.name,
                          color: cat.color,
                          icon: cat.icon,
                        })
                      }
                      className="rounded-full p-2 text-muted-txt transition-colors hover:bg-surface-2 hover:text-text"
                    >
                      <Pencil size={16} />
                    </button>
                  }
                />
              </div>
            ))}
          </div>
        </section>

        {/* ── Custom categories ─────────────────────────────────────── */}
        <section className="mb-6">
          <p className="mb-2 text-xs font-semibold tracking-wider text-muted-txt">
            {t('custom')}
          </p>
          {customCategories.length > 0 && (
            <div className="overflow-hidden rounded-[12px] bg-surface mb-3">
              {customCategories.map((cat, i) => (
                <div key={cat.id}>
                  {i > 0 && <div className="mx-4 h-px bg-outline/40" />}
                  <CategoryListItem
                    category={cat}
                    subtitle={totalById(cat.id)}
                    trailing="none"
                    actions={
                      <>
                        <button
                          type="button"
                          aria-label={tCommon('editNamed', { name: cat.name })}
                          onClick={() =>
                            openEdit({
                              id: cat.id,
                              name: cat.name,
                              color: cat.color,
                              icon: cat.icon,
                            })
                          }
                          className="rounded-full p-2 text-muted-txt transition-colors hover:bg-surface-2 hover:text-text"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          aria-label={tCommon('deleteNamed', { name: cat.name })}
                          onClick={() => setDeleteTarget(cat.id)}
                          className="rounded-full p-2 text-danger transition-colors hover:bg-surface-2"
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
                    }
                  />
                </div>
              ))}
            </div>
          )}

          {/* New category button */}
          <button
            type="button"
            onClick={openAdd}
            className="flex w-full items-center justify-center gap-2 rounded-[12px] border border-outline py-3.5 text-sm font-medium text-text transition-colors hover:bg-surface active:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-condor-primary"
          >
            <PlusCircle size={18} className="text-condor-primary" />
            {t('newCategory')}
          </button>
        </section>

        {/* ── Suggested palette ─────────────────────────────────────── */}
        <section className="mb-6">
          <p className="mb-3 text-center text-xs font-semibold tracking-wider text-muted-txt">
            {t('palette')}
          </p>
          <div className="flex items-center justify-center gap-3">
            {CATEGORY_PALETTE.map((color) => (
              <div
                key={color}
                className="h-8 w-8 rounded-full"
                style={{ backgroundColor: color }}
                aria-hidden="true"
              />
            ))}
          </div>
        </section>

      </div>

      {/* ── Add / Edit sheet ──────────────────────────────────────────── */}
      <NewCategorySheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        initial={editingCategory ?? undefined}
        onSubmit={handleSheetSubmit}
      />

      {/* ── Delete confirm dialog ─────────────────────────────────────── */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title={t('deleteTitle')}
        description={
          deleteTargetHasExpenses ? t('reassignWarning') : undefined
        }
        destructive
        onConfirm={handleDeleteConfirm}
      />

      <BottomNav />
    </main>
  )
}
