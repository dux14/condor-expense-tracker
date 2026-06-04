'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, History } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { AddFab } from '@/components/nav/AddFab'
import { cn } from '@/lib/utils'

export function BottomNav() {
  const pathname = usePathname()
  const t = useTranslations('Nav')

  const isHome = pathname === '/' || pathname === ''
  const isHistory = pathname === '/historico'

  return (
    <nav
      aria-label={t('mainNav')}
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50',
        'bg-surface/90 backdrop-blur-md',
        'border-t border-outline',
        'pb-[env(safe-area-inset-bottom)]',
        'px-4 pt-2',
      )}
    >
      {/* Inner rail capped to the content column so tabs don't scatter to the
          screen edges on desktop viewports. */}
      <div className="mx-auto flex w-full max-w-[480px] items-end justify-around">
      {/* Inicio */}
      <Link
        href="/"
        aria-label={t('home')}
        className={cn(
          'flex flex-col items-center gap-1 min-h-[44px] min-w-[60px] justify-center',
          'text-xs font-medium transition-colors',
          isHome ? 'text-condor-primary' : 'text-muted-txt hover:text-text',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-condor-primary rounded-lg',
        )}
      >
        <Home size={22} strokeWidth={isHome ? 2.5 : 2} />
        <span>{t('home')}</span>
      </Link>

      {/* Center FAB — raised above bar */}
      <div className="relative -top-5 flex flex-col items-center gap-1">
        <AddFab label={t('add')} />
        <span className="text-xs font-medium text-muted-txt mt-1">{t('add')}</span>
      </div>

      {/* Histórico */}
      <Link
        href="/historico"
        aria-label={t('history')}
        className={cn(
          'flex flex-col items-center gap-1 min-h-[44px] min-w-[60px] justify-center',
          'text-xs font-medium transition-colors',
          isHistory ? 'text-condor-primary' : 'text-muted-txt hover:text-text',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-condor-primary rounded-lg',
        )}
      >
        <History size={22} strokeWidth={isHistory ? 2.5 : 2} />
        <span>{t('history')}</span>
      </Link>
      </div>
    </nav>
  )
}
