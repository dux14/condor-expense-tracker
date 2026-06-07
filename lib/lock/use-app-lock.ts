'use client';

import { useEffect, useMemo, useState } from 'react';
import { createLockController } from './lock-controller';
import { loadLockConfig } from './lock-config';

export interface UseAppLock {
  enabled: boolean;
  locked: boolean;
  unlock(): void;
  lock(): void;
}

export function useAppLock(): UseAppLock {
  const cfg = useMemo(() => loadLockConfig(), []);
  const controller = useMemo(
    () => createLockController({ enabled: cfg.enabled, timeoutMinutes: cfg.timeoutMinutes }),
    [cfg.enabled, cfg.timeoutMinutes],
  );
  const [locked, setLocked] = useState(() => controller.isLocked());

  useEffect(() => {
    const unsub = controller.subscribe(setLocked);
    if (!cfg.enabled) return () => { unsub(); controller.destroy(); };

    const onActivity = () => controller.noteActivity();
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') controller.onBackground();
    };
    window.addEventListener('pointerdown', onActivity, { passive: true });
    window.addEventListener('keydown', onActivity);
    document.addEventListener('visibilitychange', onVisibility);
    // PWA: returning from background also fires pageshow on iOS standalone
    window.addEventListener('pageshow', onVisibility);

    return () => {
      unsub();
      window.removeEventListener('pointerdown', onActivity);
      window.removeEventListener('keydown', onActivity);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pageshow', onVisibility);
      controller.destroy();
    };
  }, [controller, cfg.enabled]);

  return {
    enabled: cfg.enabled,
    locked,
    unlock: () => controller.unlock(),
    lock: () => controller.lock(),
  };
}
