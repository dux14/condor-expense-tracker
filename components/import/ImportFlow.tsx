'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

import { useCondorStore } from '@/lib/store/store'
import { extractStatementText, ImportError } from '@/lib/import/pdf-text'
import type { ImportErrorCode } from '@/lib/import/pdf-text'
import { parseStatement } from '@/lib/import/templates'
import { categorize } from '@/lib/import/rules-engine'
import type { CategorizedTransaction } from '@/lib/import/rules-engine'
import { OTROS_ID } from '@/lib/domain/presets'
import { ReviewTable } from './ReviewTable'
import type { RawTransaction } from '@/lib/import/templates/types'

// ---------- Types ------------------------------------------------------------

type Row = CategorizedTransaction & { selected: boolean }

type Phase = 'idle' | 'parsing' | 'review' | 'done'

// ---------- Component --------------------------------------------------------

export function ImportFlow() {
  const t = useTranslations('Importar')
  const router = useRouter()

  const categories = useCondorStore((s) => s.categories)
  const categoryRules = useCondorStore((s) => s.categoryRules)
  const addImportedExpense = useCondorStore((s) => s.addImportedExpense)
  const learnCategoryRule = useCondorStore((s) => s.learnCategoryRule)

  const [phase, setPhase] = React.useState<Phase>('idle')
  const [rows, setRows] = React.useState<Row[]>([])
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const importingRef = React.useRef(false)

  // ---------- Error toast mapping -------------------------------------------

  function toastImportError(code: ImportErrorCode) {
    switch (code) {
      case 'NOT_PDF':
        toast(t('errNotPdf'))
        break
      case 'TOO_LARGE':
        toast(t('errTooLarge'))
        break
      case 'TOO_MANY_PAGES':
        toast(t('errTooManyPages'))
        break
      case 'EXTRACT_FAILED':
        toast(t('errExtract'))
        break
    }
  }

  // ---------- File input handler --------------------------------------------

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    // Reset input so re-picking the same file fires onChange again
    e.target.value = ''

    setPhase('parsing')
    try {
      const text = await extractStatementText(file)
      const { transactions } = parseStatement(text)
      const categorized = categorize(transactions, categoryRules, OTROS_ID)
      const withSelected: Row[] = categorized.map((tx) => ({ ...tx, selected: true }))

      setRows(withSelected)
      setPhase('review')
    } catch (err) {
      if (err instanceof ImportError) {
        toastImportError(err.code)
      } else {
        toast(t('errExtract'))
      }
      setPhase('idle')
    }
  }

  // ---------- Row mutation handlers (index-stable, immutable) ---------------

  function handleToggle(index: number) {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, selected: !r.selected } : r)),
    )
  }

  function handleToggleAll(selected: boolean) {
    setRows((prev) => prev.map((r) => ({ ...r, selected })))
  }

  /**
   * ReviewTable sends { merchant } for description edits; map it to the row's
   * `description` field. date/amount/currency map directly.
   */
  function handleEdit(
    index: number,
    patch: Partial<Pick<RawTransaction, 'date' | 'amount' | 'currency'>> & {
      merchant?: string
    },
  ) {
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== index) return r
        const { merchant, ...rest } = patch
        return {
          ...r,
          ...rest,
          ...(merchant !== undefined ? { description: merchant } : {}),
        }
      }),
    )
  }

  function handleChangeCategory(index: number, categoryId: string) {
    const description = rows[index]?.description ?? ''
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, categoryId } : r)),
    )
    // Teach the engine the correction
    void learnCategoryRule(description, categoryId)
  }

  // ---------- Import handler ------------------------------------------------

  async function handleImport() {
    if (importingRef.current) return
    importingRef.current = true

    // Only import selected rows with a valid positive amount
    const toImport = rows.filter((r) => r.selected && Number.isFinite(r.amount) && r.amount > 0)
    if (toImport.length === 0) {
      importingRef.current = false
      return
    }

    try {
      for (const row of toImport) {
        await addImportedExpense({
          amount: row.amount,
          currency: row.currency,
          date: row.date,
          categoryId: row.categoryId,
          merchant: row.description,
        })
      }

      toast(t('imported', { n: toImport.length }))
      setPhase('done')
      router.push('/historico')
    } catch {
      toast(t('errExtract'))
    } finally {
      importingRef.current = false
    }
  }

  // ---------- Trigger file dialog -------------------------------------------

  function handlePickFile() {
    fileInputRef.current?.click()
  }

  // ---------- Render --------------------------------------------------------

  return (
    <div className="mx-auto max-w-[480px] px-5 py-4">
      {/* Hidden file input — always mounted so ref is stable */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleFile}
      />

      {/* ── idle ──────────────────────────────────────────────────────────── */}
      {phase === 'idle' && (
        <div className="flex flex-col items-center gap-5 pt-12">
          <p className="text-center text-sm text-muted-txt">{t('subtitle')}</p>
          <button
            type="button"
            onClick={handlePickFile}
            className="min-h-[52px] w-full rounded-2xl bg-condor-primary px-6 text-sm font-semibold text-white active:scale-95 transition-all duration-150"
          >
            {t('pickFile')}
          </button>
        </div>
      )}

      {/* ── parsing ───────────────────────────────────────────────────────── */}
      {phase === 'parsing' && (
        <div className="flex flex-col items-center gap-4 pt-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-condor-primary border-t-transparent" />
          <p className="text-sm text-muted-txt">{t('parsing')}</p>
        </div>
      )}

      {/* ── review ────────────────────────────────────────────────────────── */}
      {phase === 'review' && (
        <>
          {rows.length === 0 ? (
            <div className="flex flex-col items-center gap-5 pt-12">
              <p className="text-center text-sm text-muted-txt">{t('empty')}</p>
              <button
                type="button"
                onClick={() => setPhase('idle')}
                className="min-h-[52px] w-full rounded-2xl bg-condor-primary px-6 text-sm font-semibold text-white active:scale-95 transition-all duration-150"
              >
                {t('pickFile')}
              </button>
            </div>
          ) : (
            <ReviewTable
              rows={rows}
              categories={categories}
              onToggle={handleToggle}
              onToggleAll={handleToggleAll}
              onEdit={handleEdit}
              onChangeCategory={handleChangeCategory}
              onImport={handleImport}
            />
          )}
        </>
      )}
    </div>
  )
}
