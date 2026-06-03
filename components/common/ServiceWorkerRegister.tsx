'use client';

import { useEffect } from 'react';

/**
 * Registers /sw.js once the page has loaded.
 * Mount this in app/providers.tsx.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    function register() {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          if (process.env.NODE_ENV === 'development') {
            console.info('[SW] registered', reg.scope);
          }
        })
        .catch((err) => {
          console.warn('[SW] registration failed', err);
        });
    }

    if (document.readyState === 'complete') {
      register();
    } else {
      window.addEventListener('load', register, { once: true });
    }
  }, []);

  return null;
}
