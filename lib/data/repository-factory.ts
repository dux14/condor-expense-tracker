import type { SupabaseClient } from '@supabase/supabase-js';
import type { Repository } from './repository';
import { LocalStorageRepository } from './local-storage-repository';
import { SupabaseRepository } from './supabase-repository';
import { SyncingRepository } from './syncing-repository';

/**
 * F3: pick the repository for the current session.
 * - Supabase client present (authed) → SupabaseRepository (RLS-scoped).
 * - No client (SSR / unit tests / pre-login) → LocalStorageRepository.
 * Login is required at runtime (D1); this fallback only keeps SSR/tests safe.
 */
export function createRepository(client: SupabaseClient | null): Repository {
  return client ? new SupabaseRepository(client) : new LocalStorageRepository();
}

// ---------------------------------------------------------------------------
// Composition root for the F4 offline-first data layer.
// - Unauthenticated / SSR: a bare LocalStorageRepository (no sync).
// - Authenticated: SyncingRepository(local cache, remote) — offline-first.
// The `remote` is injected (SupabaseRepository from F3) so F4 is independent of F3.

export interface RepositoryFactoryInput {
  /** The cloud repository for the authed user, or null when not signed in. */
  remote: Repository | null;
  /** Override the local cache (defaults to LocalStorageRepository). */
  local?: Repository;
}

export function makeRepository(input: RepositoryFactoryInput): Repository {
  const local = input.local ?? new LocalStorageRepository();
  if (!input.remote) return local;
  return new SyncingRepository(local, input.remote);
}
