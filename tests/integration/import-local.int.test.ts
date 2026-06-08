// LocalStorage shim — must run BEFORE any import that touches localStorage.
// Node has no `window` / `localStorage`; this satisfies both the
// `typeof window === 'undefined'` guard in import-local.ts and the read/write
// paths in LocalStorageRepository.
class LocalStorageStub {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
}

// Install window + localStorage shim for the Node test env.
// Cast through `unknown` to avoid TS type mismatch without needing @ts-expect-error.
(globalThis as unknown as Record<string, unknown>).window =
  (globalThis as unknown as Record<string, unknown>).window ?? {};
(globalThis as unknown as Record<string, unknown>).localStorage = new LocalStorageStub();
((globalThis as unknown as Record<string, unknown>).window as Record<string, unknown>).localStorage =
  (globalThis as unknown as Record<string, unknown>).localStorage;

// --- imports after the shim is installed ---
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseRepository } from '@/lib/data/supabase-repository';
import { LocalStorageRepository, DEFAULT_SETTINGS } from '@/lib/data/local-storage-repository';
import { importLocalToCloud } from '@/lib/data/import-local';
import { PRESET_CATEGORIES } from '@/lib/domain/presets';
import { makeUserClient, makeExpense } from './_helpers';

describe('importLocalToCloud (local Supabase)', () => {
  let client: SupabaseClient;
  let cloud: SupabaseRepository;

  beforeAll(async () => {
    const user = await makeUserClient(`import_${Date.now()}@condor.test`);
    client = user.client;
    cloud = new SupabaseRepository(client);
  });

  afterAll(async () => {
    await cloud.wipeAll();
  });

  beforeEach(() => {
    // Reset localStorage between tests so the idempotency guard is clean
    ((globalThis as unknown as Record<string, unknown>).localStorage as LocalStorageStub).clear();
  });

  it('import lands real rows and is idempotent', async () => {
    // --- Seed local storage ---
    const local = new LocalStorageRepository();

    const e1 = makeExpense({ id: crypto.randomUUID() });
    const e2 = makeExpense({ id: crypto.randomUUID() });
    await local.upsertExpense(e1);
    await local.upsertExpense(e2);

    const customCat = {
      id: crypto.randomUUID(),
      name: 'Imp',
      color: '#ffffff',
      icon: 'comida',
      isPreset: false,
    };
    await local.upsertCategory(customCat);

    await local.putSettings({ ...DEFAULT_SETTINGS, baseCurrency: 'USD' });

    // --- First import ---
    const result = await importLocalToCloud(local, cloud);
    expect(result).toEqual({ imported: true, expenses: 2, categories: 1 });

    // --- Assert real rows in Postgres ---
    const cloudExpenses = await cloud.listExpenses();
    const cloudExpenseIds = cloudExpenses.map((e) => e.id);
    expect(cloudExpenseIds).toContain(e1.id);
    expect(cloudExpenseIds).toContain(e2.id);

    // --- Assert categories: presets + 1 custom (no preset duplication) ---
    const cloudCats = await cloud.listCategories();
    expect(cloudCats).toHaveLength(PRESET_CATEGORIES.length + 1);
    expect(cloudCats.map((c) => c.id)).toContain(customCat.id);
    // Presets should each appear exactly once
    for (const preset of PRESET_CATEGORIES) {
      expect(cloudCats.filter((c) => c.id === preset.id)).toHaveLength(1);
    }

    // --- Idempotency: second call must be a no-op ---
    const countBefore = (await cloud.listExpenses()).length;

    const result2 = await importLocalToCloud(local, cloud);
    expect(result2).toEqual({ imported: false, expenses: 0, categories: 0 });

    const countAfter = (await cloud.listExpenses()).length;
    expect(countAfter).toBe(countBefore); // no duplicate rows

    // condor:imported key must still be set
    expect(
      ((globalThis as unknown as Record<string, unknown>).localStorage as LocalStorageStub).getItem('condor:imported'),
    ).not.toBeNull();
  });
});
