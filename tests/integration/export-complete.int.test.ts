import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseRepository } from '@/lib/data/supabase-repository';
import { makeUserClient } from './_helpers';

// F10 Task 7.1 — a full export bundle must round-trip EVERY user table, not
// just expenses/categories/settings. This is the regression guard that proves
// budgets + categoryRules are included (the gap this task closes).

describe('exportAll completeness (local Supabase)', () => {
  let client: SupabaseClient;
  let repo: SupabaseRepository;

  beforeAll(async () => {
    const u = await makeUserClient(`export_${Date.now()}@condor.test`);
    client = u.client;
    repo = new SupabaseRepository(client);

    // Seed exactly one row in every user table via the user's own client.
    // user_id is omitted everywhere — the column default auth.uid() fills it.
    // Row shapes mirror tests/integration/rls-isolation.int.test.ts.
    const seed = [
      client.from('categories').upsert(
        { id: 'exp-cat', name: 'X', color: '#fff', icon: 'comida', is_preset: false },
        { onConflict: 'user_id,id' },
      ),
      client.from('expenses').upsert(
        {
          id: 'exp-exp', amount: 100, currency: 'COP', date: '2026-01-01',
          category_id: 'preset-comida', source: 'manual',
          created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
        },
        { onConflict: 'user_id,id' },
      ),
      client.from('budgets').upsert(
        { id: 'exp-bud', category_id: 'preset-comida', amount_base: 1000, period: 'monthly' },
        { onConflict: 'user_id,id' },
      ),
      client.from('category_rules').upsert(
        { id: 'exp-rule', pattern: 'STARBUCKS', category_id: 'preset-comida' },
        { onConflict: 'user_id,id' },
      ),
      client.from('settings').upsert(
        { base_currency: 'COP' },
        { onConflict: 'user_id' },
      ),
    ];
    for (const q of seed) {
      const { error } = await q;
      expect(error).toBeNull();
    }
  });

  afterAll(async () => {
    await repo.wipeAll();
  });

  it('includes every user-table category with the expected rows', async () => {
    const bundle = await repo.exportAll();

    expect(bundle.expenses.length).toBeGreaterThanOrEqual(1);
    expect(bundle.categories.length).toBeGreaterThanOrEqual(1);
    expect(bundle.budgets.length).toBeGreaterThanOrEqual(1);
    expect(bundle.categoryRules.length).toBeGreaterThanOrEqual(1);

    // Each seeded row is present.
    expect(bundle.expenses.some((e) => e.id === 'exp-exp')).toBe(true);
    expect(bundle.categories.some((c) => c.id === 'exp-cat')).toBe(true);
    expect(bundle.budgets.some((b) => b.id === 'exp-bud')).toBe(true);
    expect(bundle.categoryRules.some((r) => r.id === 'exp-rule')).toBe(true);

    // Settings is the singleton row, present (defaults merged).
    expect(bundle.settings).toBeTruthy();
    expect(bundle.settings.baseCurrency).toBe('COP');

    // Bundle metadata.
    expect(typeof bundle.exportedAt).toBe('string');
    expect(new Date(bundle.exportedAt).toISOString()).toBe(bundle.exportedAt);
  });
});
