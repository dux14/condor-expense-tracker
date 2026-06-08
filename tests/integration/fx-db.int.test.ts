import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { fxDbGet } from '@/lib/fx/fx-db';
import { admin, makeUserClient, URL, SECRET } from './_helpers';
import { createClient } from '@supabase/supabase-js';

const TEST_ROW = { from_ccy: 'USD', to_ccy: 'COP', on_date: '2026-06-01', rate: 4000 };

describe('fxDbGet integration', () => {
  beforeAll(async () => {
    // Seed via service-role client (bypasses RLS/grants).
    const { error } = await admin
      .from('fx_rates')
      .upsert(TEST_ROW, { onConflict: 'from_ccy,to_ccy,on_date' });
    if (error) throw error;
  });

  afterAll(async () => {
    await admin
      .from('fx_rates')
      .delete()
      .eq('from_ccy', TEST_ROW.from_ccy)
      .eq('to_ccy', TEST_ROW.to_ccy)
      .eq('on_date', TEST_ROW.on_date);
  });

  it('authenticated user can read fx_rates and gets the seeded rate', async () => {
    const { client } = await makeUserClient(`fx_auth_${Date.now()}@condor.test`);
    const result = await fxDbGet(client, 'USD', 'COP', '2026-06-01');
    expect(result).toBe(4000);
  });

  it('anon client (no session) cannot read fx_rates and returns undefined', async () => {
    const anonClient = createClient(URL, SECRET, { auth: { persistSession: false } });
    // Sign out to ensure the client has no session — confirm it is truly anon-role.
    await anonClient.auth.signOut();
    // We create an anon client using the publishable key with no signed-in user.
    const { SUPABASE_TEST_PUBLISHABLE_KEY } = process.env;
    const bareAnonClient = createClient(URL, SUPABASE_TEST_PUBLISHABLE_KEY!, {
      auth: { persistSession: false },
    });
    const result = await fxDbGet(bareAnonClient, 'USD', 'COP', '2026-06-01');
    expect(result).toBeUndefined();
  });
});
