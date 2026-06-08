'use client'

import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { BottomNav } from '@/components/nav/BottomNav'

const ImportFlow = dynamic(
  () => import('@/components/import/ImportFlow').then((m) => m.ImportFlow),
  {
    ssr: false,
    loading: () => (
      <div className="p-6 text-center text-muted-txt">…</div>
    ),
  },
)

export default function ImportarPage() {
  const t = useTranslations('Importar')
  const tCommon = useTranslations('Common')
  const router = useRouter()

  return (
    <main className="min-h-dvh bg-bg pb-[calc(env(safe-area-inset-bottom)+5.5rem)]">
      <div className="mx-auto max-w-[480px] px-5">

        {/* ── Top bar ─────────────────────────────────────────────────── */}
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

        <ImportFlow />

      </div>

      <BottomNav />
    </main>
  )
}
