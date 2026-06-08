import { describe, it, expect, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createRepository, makeRepository } from '@/lib/data/repository-factory';
import { LocalStorageRepository } from '@/lib/data/local-storage-repository';
import { SupabaseRepository } from '@/lib/data/supabase-repository';
import { SyncingRepository } from '@/lib/data/syncing-repository';
import { FakeRemoteRepository } from '../../helpers/fake-remote-repository';

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

describe('repository-factory', () => {
  beforeEach(() => localStorage.clear());

  it('no remote (unauthenticated) → bare LocalStorageRepository', () => {
    const repo = makeRepository({ remote: null });
    expect(repo).toBeInstanceOf(LocalStorageRepository);
  });

  it('with a remote (authenticated) → SyncingRepository wrapping local + remote', () => {
    const repo = makeRepository({ remote: new FakeRemoteRepository() });
    expect(repo).toBeInstanceOf(SyncingRepository);
  });
});
