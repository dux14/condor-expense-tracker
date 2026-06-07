'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import CondorLogo from '@/components/common/CondorLogo';
import { createClient } from '@/lib/auth/supabase-browser';

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
    </svg>
  );
}

export default function LoginScreen() {
  const t = useTranslations('Auth');
  const [busy, setBusy] = React.useState(false);
  const [online, setOnline] = React.useState(true);

  React.useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  async function handleSignIn() {
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
      // On success the browser is redirected to Google; no further UI.
    } catch {
      toast.error(t('loginError'));
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-bg px-6 pt-[env(safe-area-inset-top)] pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
      <div className="flex w-full max-w-[360px] flex-col items-center text-center">
        <CondorLogo size={96} animate />
        <h1 className="mt-6 font-heading text-3xl font-semibold text-text">
          {t('loginTitle')}
        </h1>
        <p className="mt-1 text-sm italic text-muted-txt">
          &ldquo;{t('loginTagline')}&rdquo;
        </p>
        <p className="mt-6 text-sm text-muted-txt">{t('loginSubtitle')}</p>

        {!online && (
          <div
            role="alert"
            className="mt-6 w-full rounded-[12px] border border-outline bg-surface px-4 py-3 text-left"
          >
            <p className="text-sm font-semibold text-text">{t('offlineTitle')}</p>
            <p className="mt-0.5 text-xs text-muted-txt">{t('offlineBody')}</p>
          </div>
        )}

        <button
          type="button"
          onClick={handleSignIn}
          disabled={busy || !online}
          className="mt-8 flex min-h-[48px] w-full items-center justify-center gap-3 rounded-[12px] bg-white px-4 font-medium text-[#1f1f1f] transition-opacity disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-condor-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          <GoogleG />
          <span>{busy ? t('signingIn') : t('continueWithGoogle')}</span>
        </button>

        <p className="mt-6 text-xs text-muted-txt">{t('privacyNote')}</p>
      </div>
    </main>
  );
}
