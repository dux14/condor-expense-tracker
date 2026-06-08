'use client';

// glue F4: bridges the Supabase auth session to the offline-first data layer.
// When authenticated, swaps the store's repo to a SyncingRepository backed by
// Supabase and starts the SyncController (focus/online/debounce triggers).
// When unauthenticated, falls back to the bare local-only repository.
// Renders nothing — side-effect component only.

import { useEffect } from 'react';
import { useSession } from '@/lib/auth/use-session';
import { createClient } from '@/lib/auth/supabase-browser';
import { defaultStore } from '@/lib/store/store';
import { SupabaseRepository } from '@/lib/data/supabase-repository';
import { LocalStorageRepository } from '@/lib/data/local-storage-repository';
import { SyncingRepository } from '@/lib/data/syncing-repository';
import { SyncController } from '@/lib/data/sync-controller';

export function SessionSync() {
  const { status } = useSession();

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'authenticated') {
      const remote = new SupabaseRepository(createClient());
      const repo = new SyncingRepository(new LocalStorageRepository(), remote);

      defaultStore.getState().setRepo(repo);
      void defaultStore.getState().hydrate();

      const controller = new SyncController(repo);

      const offWrite = repo.onWrite(() => controller.notifyWrite());
      const offStatus = repo.onStatus((s) => {
        if (s === 'synced') void defaultStore.getState().hydrate();
      });

      controller.start();

      return () => {
        offWrite();
        offStatus();
        controller.stop();
      };
    }

    // unauthenticated: revert to local-only
    defaultStore.getState().setRepo(new LocalStorageRepository());
    void defaultStore.getState().hydrate();
  }, [status]);

  return null;
}
