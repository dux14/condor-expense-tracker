import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createRepository } from '@/lib/data/repository-factory';
import { LocalStorageRepository } from '@/lib/data/local-storage-repository';
import { SupabaseRepository } from '@/lib/data/supabase-repository';

describe('createRepository', () => {
  it('returns LocalStorageRepository when client is null', () => {
    const repo = createRepository(null);
    expect(repo).toBeInstanceOf(LocalStorageRepository);
  });

  it('returns SupabaseRepository when a Supabase client is provided', () => {
    const fakeClient = {} as unknown as SupabaseClient;
    const repo = createRepository(fakeClient);
    expect(repo).toBeInstanceOf(SupabaseRepository);
  });
});
