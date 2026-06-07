'use client';

import { useAppLock } from '@/lib/lock/use-app-lock';
import { loadLockConfig } from '@/lib/lock/lock-config';
import { LockScreen } from './LockScreen';
import { useMemo } from 'react';

export function LockGate({ children }: { children: React.ReactNode }) {
  const cfg = useMemo(() => loadLockConfig(), []);
  const { enabled, locked, unlock } = useAppLock();

  return (
    <>
      {children}
      {enabled && locked && cfg.pin && (
        <LockScreen
          pinHash={cfg.pin}
          biometricCredentialId={cfg.webauthnCredentialId}
          onUnlocked={unlock}
        />
      )}
    </>
  );
}
