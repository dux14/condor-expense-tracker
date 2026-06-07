'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ChevronLeft, Download, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { useCondorStore } from '@/lib/store/store'
import { KNOWN_CURRENCIES } from '@/lib/domain/schemas'
import type { DashboardView, ThemePref, Locale } from '@/lib/domain/types'

import { SettingRow } from '@/components/settings/SettingRow'
import { AccountSection } from '@/components/settings/AccountSection'
import { SegmentedControl } from '@/components/settings/SegmentedControl'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import CondorLogo from '@/components/common/CondorLogo'
import { BottomNav } from '@/components/nav/BottomNav'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export default function AjustesPage() {
  const t = useTranslations('Ajustes')
  const tCommon = useTranslations('Common')
  const tInicio = useTranslations('Inicio')
  const router = useRouter()

  const settings = useCondorStore((s) => s.settings)
  const setSettings = useCondorStore((s) => s.setSettings)
  const exportAll = useCondorStore((s) => s.exportAll)
  const wipeAll = useCondorStore((s) => s.wipeAll)

  const [wipeOpen, setWipeOpen] = React.useState(false)

  // --- Handlers ---------------------------------------------------------------

  async function handleBaseCurrencyChange(baseCurrency: string | null) {
    if (!baseCurrency) return
    toast(t('updatingFx'))
    await setSettings({ baseCurrency })
  }

  function handleLocaleChange(locale: string | null) {
    if (!locale) return
    setSettings({ locale: locale as Locale })
  }

  function handleThemeChange(theme: string) {
    setSettings({ theme: theme as ThemePref })
  }

  function handleDashboardViewChange(dashboardView: string | null) {
    if (!dashboardView) return
    setSettings({ dashboardView: dashboardView as DashboardView })
  }

  async function handleExport() {
    const bundle = await exportAll()
    const blob = new Blob([JSON.stringify(bundle, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'condor-export.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleWipeConfirm() {
    await wipeAll()
    toast(t('dataCleared'))
  }

  // --- Segment options --------------------------------------------------------

  const themeOptions = [
    { value: 'dark', label: t('themeDark') },
    { value: 'light', label: t('themeLight') },
    { value: 'auto', label: t('themeAuto') },
  ]

  const localeOptions = [
    { value: 'es', label: 'Español' },
    { value: 'en', label: 'English' },
  ]

  const viewOptions: { value: DashboardView; label: string }[] = [
    { value: 'bars', label: tInicio('viewBars') },
    { value: 'donut', label: tInicio('viewDonut') },
    { value: 'treemap', label: tInicio('viewTreemap') },
  ]

  return (
    <main className="min-h-dvh bg-bg pb-[calc(env(safe-area-inset-bottom)+5.5rem)]">
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

        {/* ── Account card ──────────────────────────────────────────── */}
        <AccountSection />

        {/* ── Preferences card ──────────────────────────────────────── */}
        <section className="mb-5">
          <p className="mb-2 text-xs font-semibold tracking-wider text-muted-txt">
            {t('preferences')}
          </p>
          <div className="overflow-hidden rounded-[12px] bg-surface">

            {/* Moneda base */}
            <SettingRow label={t('baseCurrency')}>
              <Select
                value={settings.baseCurrency}
                onValueChange={handleBaseCurrencyChange}
              >
                <SelectTrigger
                  aria-label={t('baseCurrency')}
                  className="h-8 border-outline bg-surface-2 text-text text-sm"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KNOWN_CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingRow>

            <div className="mx-4 h-px bg-outline/40" />

            {/* Idioma */}
            <SettingRow label={t('language')}>
              <Select
                value={settings.locale}
                onValueChange={handleLocaleChange}
              >
                <SelectTrigger
                  aria-label={t('language')}
                  className="h-8 border-outline bg-surface-2 text-text text-sm"
                >
                  <SelectValue>
                    {(v: string | null) =>
                      localeOptions.find((o) => o.value === v)?.label ?? v
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {localeOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingRow>

            <div className="mx-4 h-px bg-outline/40" />

            {/* Tema */}
            <SettingRow label={t('theme')}>
              <SegmentedControl
                options={themeOptions}
                value={settings.theme}
                onChange={handleThemeChange}
              />
            </SettingRow>

            <div className="mx-4 h-px bg-outline/40" />

            {/* Vista de inicio */}
            <SettingRow label={t('homeView')}>
              <Select
                value={settings.dashboardView}
                onValueChange={handleDashboardViewChange}
              >
                <SelectTrigger
                  aria-label={t('homeView')}
                  className="h-8 border-outline bg-surface-2 text-text text-sm"
                >
                  <SelectValue>
                    {(v: string | null) =>
                      viewOptions.find((o) => o.value === v)?.label ?? v
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {viewOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingRow>

          </div>
        </section>

        {/* ── Data card ─────────────────────────────────────────────── */}
        <section className="mb-5">
          <p className="mb-2 text-xs font-semibold tracking-wider text-muted-txt">
            {t('data')}
          </p>
          <div className="overflow-hidden rounded-[12px] bg-surface">

            {/* Export */}
            <SettingRow
              label={t('exportData')}
              onPress={handleExport}
              data-testid="export-btn"
            >
              <Download size={18} className="text-muted-txt" />
            </SettingRow>

            <div className="mx-4 h-px bg-outline/40" />

            {/* Wipe */}
            <SettingRow
              label={t('wipeAll')}
              danger
              onPress={() => setWipeOpen(true)}
              data-testid="wipe-btn"
            >
              <Trash2 size={18} className="text-danger" />
            </SettingRow>

          </div>
        </section>

        {/* ── About section ─────────────────────────────────────────── */}
        <section className="mb-6 flex flex-col items-center gap-2 py-4">
          <CondorLogo size={56} />
          <p className="font-heading text-lg font-semibold text-text">
            {tCommon('appName')}
          </p>
          <p className="text-sm text-muted-txt">{t('version')}</p>
          <p className="text-sm italic text-muted-txt">
            &ldquo;{tCommon('tagline')}&rdquo;
          </p>
          <p className="mt-2 text-center text-xs text-muted-txt">
            {t('localNote')}
          </p>
        </section>

      </div>

      {/* ── Wipe confirm dialog ───────────────────────────────────────── */}
      <ConfirmDialog
        open={wipeOpen}
        onOpenChange={setWipeOpen}
        title={t('wipeConfirmTitle')}
        description={t('wipeConfirmBody')}
        destructive
        onConfirm={handleWipeConfirm}
      />

      <BottomNav />
    </main>
  )
}
