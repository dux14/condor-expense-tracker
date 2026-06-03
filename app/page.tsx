'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Tags, Settings, Receipt } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { useCondorStore } from '@/lib/store/store'
import {
  monthTotal,
  rankedByCategory,
  spendByDay,
  deltaVsPrevMonth,
  expensesInMonth,
} from '@/lib/domain/selectors'
import { formatMonthLabel, prevMonthKey } from '@/lib/format/date'

import CondorLogo from '@/components/common/CondorLogo'
import { EmptyState } from '@/components/common/EmptyState'
import { BottomNav } from '@/components/nav/BottomNav'
import { MonthSwitcher } from '@/components/home/MonthSwitcher'
import { MonthTotal } from '@/components/home/MonthTotal'
import { ViewSwitcher } from '@/components/home/ViewSwitcher'
import { SpendingView } from '@/components/home/SpendingView'
import { SpendByDayStrip } from '@/components/charts/SpendByDayStrip'

export default function InicioPage() {
  const t = useTranslations('Inicio')
  const tNav = useTranslations('Nav')
  const router = useRouter()

  const expenses = useCondorStore((s) => s.expenses)
  const categories = useCondorStore((s) => s.categories)
  const settings = useCondorStore((s) => s.settings)
  const month = useCondorStore((s) => s.month)
  const setMonth = useCondorStore((s) => s.setMonth)
  const setSettings = useCondorStore((s) => s.setSettings)

  const { baseCurrency, locale } = settings

  // Derived data
  const { totalBase } = monthTotal(expenses, month)
  const { pct: deltaPct, hasPrev } = deltaVsPrevMonth(expenses, month)
  const prevLabel = formatMonthLabel(prevMonthKey(month), locale)

  const barsItems = rankedByCategory(expenses, categories, month, 6)
  const treemapItems = rankedByCategory(expenses, categories, month, 99)
  const daySeriesData = spendByDay(expenses, month)

  const monthExpenses = expensesInMonth(expenses, month)
  const isEmpty = monthExpenses.length === 0

  return (
    <main className="min-h-dvh bg-bg pb-28">
      <div className="mx-auto max-w-[480px] px-5">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <header className="flex items-center justify-between pt-5 pb-2">
          {/* Left: logo + wordmark */}
          <div className="flex items-center gap-2">
            <CondorLogo size={28} animate />
            <span className="font-heading text-lg font-semibold text-text">
              Cóndor
            </span>
          </div>

          {/* Right: icon buttons */}
          <div className="flex items-center gap-1">
            <Link
              href="/categorias"
              aria-label={tNav('categories')}
              className="flex items-center justify-center min-h-[40px] min-w-[40px] rounded-full text-muted-txt hover:text-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-condor-primary"
            >
              <Tags size={20} strokeWidth={2} />
            </Link>
            <Link
              href="/ajustes"
              aria-label={tNav('settings')}
              className="flex items-center justify-center min-h-[40px] min-w-[40px] rounded-full text-muted-txt hover:text-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-condor-primary"
            >
              <Settings size={20} strokeWidth={2} />
            </Link>
          </div>
        </header>

        {/* ── Month switcher ─────────────────────────────────────────── */}
        <div className="flex justify-end py-2">
          <MonthSwitcher value={month} onChange={setMonth} locale={locale} />
        </div>

        {/* ── Month total ────────────────────────────────────────────── */}
        <MonthTotal
          totalBase={totalBase}
          baseCurrency={baseCurrency}
          locale={locale}
          deltaPct={deltaPct}
          hasPrev={hasPrev}
          prevMonthLabel={prevLabel}
          className="mt-1 mb-4"
        />

        {/* ── View switcher ──────────────────────────────────────────── */}
        <ViewSwitcher
          value={settings.dashboardView}
          onChange={(v) => setSettings({ dashboardView: v })}
          className="mb-4"
        />

        {/* ── Chart area or empty state ──────────────────────────────── */}
        {isEmpty ? (
          <EmptyState
            icon={<Receipt />}
            title={t('emptyTitle')}
            description={t('emptyBody')}
            action={
              <Link
                href="/anadir"
                className="inline-flex items-center justify-center rounded-full bg-condor-primary px-5 py-2.5 text-sm font-medium text-bg transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-condor-primary"
              >
                {t('addFirst')}
              </Link>
            }
          />
        ) : (
          <>
            <SpendingView
              view={settings.dashboardView}
              barsItems={barsItems}
              treemapItems={treemapItems}
              baseCurrency={baseCurrency}
              locale={locale}
              onSelectCategory={(id) =>
                router.push('/historico?cat=' + id + '&m=' + month)
              }
              className="mb-6"
            />

            {/* ── When did you spend? ──────────────────────────────── */}
            <section>
              <h2 className="mb-3 text-sm font-medium text-muted-txt">
                {t('whenSpent')}
              </h2>
              <SpendByDayStrip series={daySeriesData} locale={locale} />
            </section>
          </>
        )}

      </div>

      <BottomNav />
    </main>
  )
}
