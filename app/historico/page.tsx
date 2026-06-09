'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { X, History } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { format, parseISO } from 'date-fns'
import { es, enUS } from 'date-fns/locale'

import { useCondorStore } from '@/lib/store/store'
import { transactionsByDay } from '@/lib/domain/selectors'
import type { Locale } from '@/lib/domain/types'

import { BottomNav } from '@/components/nav/BottomNav'
import { MonthSwitcher } from '@/components/home/MonthSwitcher'
import { EmptyState } from '@/components/common/EmptyState'
import { TransactionRow } from '@/components/tx/TransactionRow'
import { SegmentedControl } from '@/components/settings/SegmentedControl'
import { TrendsView } from '@/components/home/TrendsView'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DATE_FNS_LOCALE: Record<Locale, Locale extends 'es' ? typeof es : typeof enUS> = {
  es,
  en: enUS,
} as Record<Locale, typeof es | typeof enUS>

function formatDayHeader(day: string, locale: Locale): string {
  const date = parseISO(day)
  const dateFnsLocale = DATE_FNS_LOCALE[locale]
  return format(date, 'EEEE, d MMMM', { locale: dateFnsLocale })
}

// ---------------------------------------------------------------------------
// Inner component (uses useSearchParams — must live inside <Suspense>)
// ---------------------------------------------------------------------------

function HistoricoContent() {
  const t = useTranslations('Historico')
  const router = useRouter()
  const searchParams = useSearchParams()

  const expenses = useCondorStore((s) => s.expenses)
  const categories = useCondorStore((s) => s.categories)
  const settings = useCondorStore((s) => s.settings)
  const month = useCondorStore((s) => s.month)
  const setMonth = useCondorStore((s) => s.setMonth)

  const { baseCurrency, locale } = settings

  // Sync month from URL query param ?m=yyyy-MM once on mount
  const mParam = searchParams.get('m')
  useEffect(() => {
    if (mParam && mParam !== month) {
      setMonth(mParam)
    }
    // Only run on mount (mParam read once)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const view = searchParams.get('view') === 'trends' ? 'trends' : 'transactions'

  const catParam = searchParams.get('cat')

  // Get all day groups for the current month
  const allGroups = transactionsByDay(expenses, categories, month)

  // Optionally filter by category
  const groups = catParam
    ? allGroups
        .map((g) => ({
          ...g,
          rows: g.rows.filter((r) => r.category.id === catParam || r.expense.categoryId === catParam),
        }))
        .filter((g) => g.rows.length > 0)
    : allGroups

  // Resolve filter category name for chip
  const filterCategory = catParam
    ? categories.find((c) => c.id === catParam)
    : null

  const filterLabel = filterCategory?.name ?? catParam ?? ''

  const isEmpty = groups.length === 0

  function clearFilter() {
    router.push('/historico?m=' + month)
  }

  function setView(v: string) {
    const p = new URLSearchParams(searchParams.toString())
    if (v === 'transactions') p.delete('view')
    else p.set('view', v)
    p.set('m', month)
    router.push('/historico?' + p.toString())
  }

  return (
    <main className="min-h-dvh bg-bg pb-[calc(env(safe-area-inset-bottom)+5.5rem)]">
      <div className="mx-auto max-w-[480px] px-5">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <header className="pt-5 pb-3">
          <h1 className="font-heading text-xl font-semibold text-text mb-3">
            {t('title')}
          </h1>
          <MonthSwitcher value={month} onChange={setMonth} locale={locale} />
          <SegmentedControl
            className="mt-3"
            options={[
              { value: 'transactions', label: t('tabTransactions') },
              { value: 'trends', label: t('tabTrends') },
            ]}
            value={view}
            onChange={setView}
          />
        </header>

        {/* ── Body: Trends or Transactions ──────────────────────────── */}
        {view === 'trends' ? (
          <TrendsView
            expenses={expenses}
            categories={categories}
            month={month}
            baseCurrency={baseCurrency}
            locale={locale}
          />
        ) : (
          <>
            {/* ── Category filter chip ─────────────────────────────── */}
            {catParam && (
              <div className="mb-3 flex items-center gap-2">
                <span className="text-xs text-muted-txt">{t('filteredBy')}</span>
                <button
                  type="button"
                  onClick={clearFilter}
                  className="inline-flex items-center gap-1.5 rounded-full bg-condor-primary/15 px-3 py-1 text-xs font-medium text-condor-primary transition-colors hover:bg-condor-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-condor-primary"
                  aria-label={t('clearFilter')}
                >
                  <span>{filterLabel}</span>
                  <X size={12} strokeWidth={2.5} aria-hidden />
                </button>
              </div>
            )}

            {/* ── Transaction list or empty state ──────────────────── */}
            {isEmpty ? (
              <EmptyState
                icon={<History />}
                title={t('empty')}
              />
            ) : (
              <div className="flex flex-col gap-4">
                {groups.map((group) => {
                  const dayLabel = formatDayHeader(group.day, locale)
                  // Capitalize first letter
                  const displayLabel = dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1)

                  return (
                    <section key={group.day}>
                      {/* Day header */}
                      <h2 className="mb-1 px-1 text-xs font-medium uppercase tracking-wide text-muted-txt">
                        {displayLabel}
                      </h2>

                      {/* Rows */}
                      <div className="rounded-condor bg-surface overflow-hidden divide-y divide-outline">
                        {group.rows.map(({ expense, category }) => (
                          <TransactionRow
                            key={expense.id}
                            expense={expense}
                            category={category}
                            locale={locale}
                            baseCurrency={baseCurrency}
                            onPress={() =>
                              router.push('/anadir?id=' + expense.id)
                            }
                          />
                        ))}
                      </div>
                    </section>
                  )
                })}
              </div>
            )}
          </>
        )}

      </div>

      <BottomNav />
    </main>
  )
}

// ---------------------------------------------------------------------------
// Page export — wraps content in Suspense for static export compatibility
// ---------------------------------------------------------------------------

export default function HistoricoPage() {
  return (
    <Suspense>
      <HistoricoContent />
    </Suspense>
  )
}
