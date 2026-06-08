import type { SupabaseClient } from '@supabase/supabase-js';
import type { Repository } from './repository';
import { LocalStorageRepository } from './local-storage-repository';
import { SupabaseRepository } from './supabase-repository';

/**
 * F3: pick the repository for the current session.
 * - Supabase client present (authed) → SupabaseRepository (RLS-scoped).
 * - No client (SSR / unit tests / pre-login) → LocalStorageRepository.
 * Login is required at runtime (D1); this fallback only keeps SSR/tests safe.
 */
export function createRepository(client: SupabaseClient | null): Repository {
  return client ? new SupabaseRepository(client) : new LocalStorageRepository();
}
