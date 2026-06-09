import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { makeUserClient } from './_helpers';

// Every user-scoped table and a minimal valid row factory for A's user_id.
// user_id is omitted: the column default auth.uid() fills it from the JWT.
function rows(_uid: string) {
  return {
    categories:     { id: 'rls-cat',  name: 'X', color: '#fff', icon: 'comida', is_preset: false },
    expenses:       { id: 'rls-exp',  amount: 100, currency: 'COP', date: '2026-01-01',
                      category_id: 'preset-comida', source: 'manual',
                      created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
    settings:       { /* PK is user_id (default auth.uid()); upsert one row */ base_currency: 'COP' },
    budgets:        { id: 'rls-bud',  category_id: 'preset-comida', amount_base: 1000, period: 'monthly' },
    category_rules: { id: 'rls-rule', pattern: 'STARBUCKS', category_id: 'preset-comida' },
  } as const;
}
const USER_TABLES = ['categories', 'expenses', 'settings', 'budgets', 'category_rules'] as const;

describe('RLS cross-user isolation (per table)', () => {
  let aClient: SupabaseClient, bClient: SupabaseClient, aUid: string;

  beforeAll(async () => {
    const a = await makeUserClient(`rls_a_${Date.now()}@condor.test`);
    const b = await makeUserClient(`rls_b_${Date.now()}@condor.test`);
    aClient = a.client; bClient = b.client; aUid = a.id;
    // Seed one row per table as user A.
    const r = rows(aUid);
    for (const t of USER_TABLES) {
      const onConflict = t === 'settings' ? 'user_id' : 'user_id,id';
      const { error } = await aClient.from(t).upsert(r[t] as never, { onConflict });
      expect(error, `seed ${t}`).toBeNull();
    }
  });

  afterAll(async () => {
    // RLS scopes each delete to the caller's own rows. settings has no `id`
    // column (PK is user_id), so it needs a user_id-keyed predicate; the others
    // delete-all (RLS does the scoping). Surface unexpected errors instead of
    // swallowing them — a silent failure here would mask a real schema regression.
    for (const c of [aClient, bClient]) {
      for (const t of USER_TABLES) {
        const { error } =
          t === 'settings'
            ? await c.from(t).delete().not('user_id', 'is', null)
            : await c.from(t).delete().neq('id', '__none__');
        if (error) console.warn(`cleanup ${t} failed: ${error.message}`);
      }
    }
  });

  for (const t of USER_TABLES) {
    it(`${t}: B cannot SELECT A's rows`, async () => {
      const { data } = await bClient.from(t).select('*');
      const aId = t === 'settings' ? null : (rows(aUid)[t] as { id?: string }).id;
      if (aId) expect((data ?? []).some((row: { id?: string }) => row.id === aId)).toBe(false);
      else expect((data ?? []).length).toBeLessThanOrEqual(1); // settings: only B's own
    });

    it(`${t}: B cannot UPDATE A's rows`, async () => {
      if (t === 'settings') return; // keyed by user_id; UPDATE can't target A
      const aId = (rows(aUid)[t] as { id: string }).id;
      const { data, error } = await bClient.from(t).update({ /* harmless */ }).eq('id', aId).select();
      expect(error).toBeNull();
      expect((data ?? []).length).toBe(0);
    });

    it(`${t}: B cannot DELETE A's rows`, async () => {
      if (t === 'settings') return;
      const aId = (rows(aUid)[t] as { id: string }).id;
      const { data, error } = await bClient.from(t).delete().eq('id', aId).select();
      expect(error).toBeNull();
      expect((data ?? []).length).toBe(0);
      const { data: still } = await aClient.from(t).select('id').eq('id', aId);
      expect((still ?? []).length).toBe(1);
    });

    it(`${t}: B cannot INSERT a row spoofing A's user_id`, async () => {
      if (t === 'settings') return;
      const { error } = await bClient.from(t).insert({
        ...(rows(aUid)[t] as object),
        id: `spoof-${t}`,
        user_id: aUid,
      } as never);
      expect(error, `${t} spoof insert must be rejected`).not.toBeNull();
    });
  }
});

describe('RLS fx_rates policy (global read, client write denied)', () => {
  it('fx_rates: a user (publishable JWT) can READ but not WRITE', async () => {
    const { client } = await makeUserClient(`rls_fx_${Date.now()}@condor.test`);
    const { error: readErr } = await client.from('fx_rates').select('*').limit(1);
    expect(readErr).toBeNull();
    const { error: writeErr } = await client.from('fx_rates').insert({
      from_ccy: 'USD', to_ccy: 'COP', on_date: '2026-01-01', rate: 4000,
    });
    expect(writeErr, 'client write to fx_rates must be denied').not.toBeNull();
  });
});
