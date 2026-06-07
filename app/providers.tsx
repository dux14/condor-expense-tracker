'use client';

import { useEffect } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { useCondorStore } from '@/lib/store/store';
import { resolveThemeClass } from '@/lib/theme';
import { getMessages } from '@/lib/i18n/messages';
import CondorLogo from '@/components/common/CondorLogo';
import { ServiceWorkerRegister } from '@/components/common/ServiceWorkerRegister';
import { Toaster } from '@/components/ui/sonner';
import { LockGate } from '@/components/lock/LockGate';

export default function Providers({ children }: { children: React.ReactNode }) {
  const hydrate = useCondorStore((s) => s.hydrate);
  const hydrated = useCondorStore((s) => s.hydrated);
  const theme = useCondorStore((s) => s.settings.theme);
  const locale = useCondorStore((s) => s.settings.locale);

  // One-time hydration on mount
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Apply theme class to <html>; subscribe to system preference when 'auto'
  useEffect(() => {
    function applyTheme() {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const resolved = resolveThemeClass(theme, prefersDark);
      const html = document.documentElement;
      html.classList.remove('dark', 'light');
      html.classList.add(resolved);
    }

    applyTheme();

    if (theme === 'auto') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener('change', applyTheme);
      return () => mq.removeEventListener('change', applyTheme);
    }
  }, [theme]);

  const messages = getMessages(locale);

  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="America/Bogota">
      {!hydrated ? (
        <div className="flex min-h-dvh items-center justify-center bg-bg">
          <CondorLogo animate size={120} />
        </div>
      ) : (
        <LockGate>{children}</LockGate>
      )}
      <ServiceWorkerRegister />
      <Toaster theme="system" />
    </NextIntlClientProvider>
  );
}
