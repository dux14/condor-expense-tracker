'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Fingerprint } from 'lucide-react';
import { verifyPin, type PinHash, isValidPin } from '@/lib/lock/pin';
import { authenticateWithBiometric } from '@/lib/lock/webauthn';
import CondorLogo from '@/components/common/CondorLogo';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const MAX_ATTEMPTS = 5;
const BACKOFF_SECONDS = 30;

export interface LockScreenProps {
  pinHash: PinHash;
  biometricCredentialId: string | null;
  onUnlocked: () => void;
}

export function LockScreen({ pinHash, biometricCredentialId, onUnlocked }: LockScreenProps) {
  const t = useTranslations('Lock');
  const [pin, setPin] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [attempts, setAttempts] = React.useState(0);
  const [cooldown, setCooldown] = React.useState(0);
  const busy = React.useRef(false);

  // Backoff countdown
  React.useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  // Auto-prompt biometrics on mount when available.
  React.useEffect(() => {
    if (!biometricCredentialId) return;
    let cancelled = false;
    void (async () => {
      const ok = await authenticateWithBiometric(biometricCredentialId);
      if (!cancelled && ok) onUnlocked();
    })();
    return () => { cancelled = true; };
  }, [biometricCredentialId, onUnlocked]);

  const locked = cooldown > 0;

  async function tryPin(e: React.FormEvent) {
    e.preventDefault();
    if (locked || busy.current) return;
    if (!isValidPin(pin)) {
      setError(t('pinTooShort'));
      return;
    }
    busy.current = true;
    const ok = await verifyPin(pin, pinHash);
    busy.current = false;
    if (ok) {
      onUnlocked();
      return;
    }
    const next = attempts + 1;
    setAttempts(next);
    setPin('');
    if (next >= MAX_ATTEMPTS) {
      // The live countdown is rendered from `cooldown` below, so don't freeze
      // the seconds into `error` state here.
      setCooldown(BACKOFF_SECONDS);
      setError(null);
    } else {
      setError(t('wrongPin'));
    }
  }

  async function tryBiometric() {
    if (!biometricCredentialId || busy.current) return;
    busy.current = true;
    const ok = await authenticateWithBiometric(biometricCredentialId);
    busy.current = false;
    if (ok) onUnlocked();
    else setError(t('biometricFailed'));
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('title')}
      className={cn(
        'fixed inset-0 z-[100] flex flex-col items-center justify-center',
        'bg-bg text-text',
        'px-6',
        'pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]',
      )}
    >
      <div className="flex w-full max-w-[360px] flex-col items-center gap-6">
        <CondorLogo size={88} />
        <div className="text-center">
          <h1 className="font-heading text-xl font-semibold">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-txt">{t('subtitle')}</p>
        </div>

        {biometricCredentialId && (
          <button
            type="button"
            onClick={tryBiometric}
            disabled={locked}
            aria-label={t('useBiometric')}
            className={cn(
              'flex min-h-[64px] min-w-[64px] items-center justify-center rounded-full',
              'bg-surface text-condor-primary',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-condor-primary',
              'disabled:opacity-50',
            )}
          >
            <Fingerprint size={32} />
          </button>
        )}

        <form onSubmit={tryPin} className="flex w-full flex-col gap-3">
          <label htmlFor="lock-pin" className="sr-only">{t('pinLabel')}</label>
          <input
            id="lock-pin"
            aria-label={t('pinLabel')}
            inputMode="numeric"
            autoComplete="off"
            pattern="\d*"
            maxLength={6}
            value={pin}
            disabled={locked}
            onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setError(null); }}
            placeholder={t('enterPin')}
            className={cn(
              'h-14 w-full rounded-[12px] bg-surface px-4 text-center text-2xl tracking-[0.5em]',
              'text-text placeholder:text-muted-txt placeholder:tracking-normal placeholder:text-base',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-condor-primary',
              'disabled:opacity-50',
            )}
          />
          {cooldown > 0 ? (
            <p role="alert" className="text-center text-sm text-danger">
              {t('tooManyAttempts', { seconds: cooldown })}
            </p>
          ) : error ? (
            <p role="alert" className="text-center text-sm text-danger">{error}</p>
          ) : null}
          <Button
            type="submit"
            disabled={locked}
            className="h-12 w-full text-base"
          >
            {t('unlock')}
          </Button>
        </form>
      </div>
    </div>
  );
}
