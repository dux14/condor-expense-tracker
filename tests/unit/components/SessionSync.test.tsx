import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';

// ---- Mock useSession BEFORE importing the component -------------------------
// We control status via the returned object; tests override `mockStatus`.
let mockStatus: 'loading' | 'authenticated' | 'unauthenticated' = 'loading';
vi.mock('@/lib/auth/use-session', () => ({
  useSession: () => ({ user: null, status: mockStatus }),
}));

// ---- Mock supabase-browser --------------------------------------------------
vi.mock('@/lib/auth/supabase-browser', () => ({
  createClient: () => ({}),
}));

// ---- Mock SupabaseRepository ------------------------------------------------
// Must be a proper class so `new SupabaseRepository(...)` works.
vi.mock('@/lib/data/supabase-repository', () => {
  class FakeSupabaseRepo {
    listExpenses = vi.fn(async () => []);
    listCategories = vi.fn(async () => []);
    getSettings = vi.fn(async () => ({
      schemaVersion: 1,
      baseCurrency: 'COP',
      theme: 'auto',
      locale: 'es',
    }));
    upsertExpense = vi.fn(async (e: unknown) => e);
    upsertCategory = vi.fn(async (c: unknown) => c);
    putSettings = vi.fn(async (s: unknown) => s);
    deleteExpense = vi.fn(async () => {});
    deleteCategory = vi.fn(async () => {});
    exportAll = vi.fn(async () => ({ expenses: [], categories: [], settings: {} }));
    wipeAll = vi.fn(async () => {});
  }
  return { SupabaseRepository: FakeSupabaseRepo };
});

// ---- Imports after mocks ----------------------------------------------------
import { SessionSync } from '@/components/sync/SessionSync';
import { SyncController } from '@/lib/data/sync-controller';
import { SyncingRepository } from '@/lib/data/syncing-repository';
import { LocalStorageRepository } from '@/lib/data/local-storage-repository';
import { defaultStore } from '@/lib/store/store';

// ---- Spies ------------------------------------------------------------------
let startSpy: ReturnType<typeof vi.spyOn>;
let stopSpy: ReturnType<typeof vi.spyOn>;
let setRepoSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  mockStatus = 'loading';
  startSpy = vi.spyOn(SyncController.prototype, 'start').mockImplementation(() => {});
  stopSpy = vi.spyOn(SyncController.prototype, 'stop').mockImplementation(() => {});
  setRepoSpy = vi.spyOn(defaultStore.getState(), 'setRepo');
  // Suppress hydrate async warnings in jsdom; we don't need to assert on it
  vi.spyOn(defaultStore.getState(), 'hydrate').mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SessionSync', () => {
  it('does nothing while status is loading', () => {
    mockStatus = 'loading';
    render(<SessionSync />);
    expect(setRepoSpy).not.toHaveBeenCalled();
    expect(startSpy).not.toHaveBeenCalled();
  });

  it('authenticated: setRepo receives a SyncingRepository and controller.start is called', async () => {
    mockStatus = 'authenticated';
    render(<SessionSync />);

    await waitFor(() => {
      expect(setRepoSpy).toHaveBeenCalledOnce();
    });
    const repoArg = setRepoSpy.mock.calls[0][0];
    expect(repoArg).toBeInstanceOf(SyncingRepository);
    expect(startSpy).toHaveBeenCalledOnce();
  });

  it('unauthenticated: setRepo receives a LocalStorageRepository', async () => {
    mockStatus = 'unauthenticated';
    render(<SessionSync />);

    await waitFor(() => {
      expect(setRepoSpy).toHaveBeenCalledOnce();
    });
    const repoArg = setRepoSpy.mock.calls[0][0];
    expect(repoArg).toBeInstanceOf(LocalStorageRepository);
    expect(startSpy).not.toHaveBeenCalled();
  });

  it('authenticated → unauthenticated: stops controller and swaps to local repo', async () => {
    mockStatus = 'authenticated';
    const { rerender } = render(<SessionSync />);

    await waitFor(() => expect(startSpy).toHaveBeenCalledOnce());

    // Transition to unauthenticated triggers cleanup (stop) + new setRepo
    mockStatus = 'unauthenticated';
    rerender(<SessionSync />);

    await waitFor(() => expect(stopSpy).toHaveBeenCalled());
    // The second setRepo call should be a LocalStorageRepository
    await waitFor(() => expect(setRepoSpy).toHaveBeenCalledTimes(2));
    const lastArg = setRepoSpy.mock.calls[1][0];
    expect(lastArg).toBeInstanceOf(LocalStorageRepository);
  });
});
