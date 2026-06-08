import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SupabaseRepository } from '@/lib/data/supabase-repository';
import { PRESET_CATEGORIES } from '@/lib/domain/presets';
import { DEFAULT_SETTINGS } from '@/lib/data/local-storage-repository';
import type { Expense } from '@/lib/domain/types';

const URL = process.env.SUPABASE_TEST_URL!;
const PUBLISHABLE = process.env.SUPABASE_TEST_PUBLISHABLE_KEY!;
const SECRET = process.env.SUPABASE_TEST_SECRET_KEY!;

const admin = createClient(URL, SECRET, { auth: { persistSession: false } });

async function makeUserClient(email: string): Promise<{ client: SupabaseClient; id: string }> {
  const password = 'test-password-123';
  const { data: created, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (error) throw error;
  const client = createClient(URL, PUBLISHABLE, { auth: { persistSession: false } });
  const { error: signErr } = await client.auth.signInWithPassword({ email, password });
  if (signErr) throw signErr;
  return { client, id: created.user!.id };
}

function makeExpense(over: Partial<Expense> = {}): Expense {
  return {
    id: crypto.randomUUID(),
    amount: 10000, currency: 'COP', baseAmount: 10000, fxRate: 1,
    date: '2026-01-01', categoryId: 'preset-comida', source: 'manual',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

describe('SupabaseRepository (local Supabase)', () => {
  let aClient: SupabaseClient, bClient: SupabaseClient;
  let repoA: SupabaseRepository, repoB: SupabaseRepository;

  beforeAll(async () => {
    const a = await makeUserClient(`a_${Date.now()}@condor.test`);
    const b = await makeUserClient(`b_${Date.now()}@condor.test`);
    aClient = a.client; bClient = b.client;
    repoA = new SupabaseRepository(aClient);
    repoB = new SupabaseRepository(bClient);
  });

  afterAll(async () => {
    await repoA.wipeAll(); await repoB.wipeAll();
  });

  it('first listCategories seeds presets for the user', async () => {
    const cats = await repoA.listCategories();
    expect(cats).toHaveLength(PRESET_CATEGORIES.length);
    expect(cats.map((c) => c.id).sort()).toEqual(PRESET_CATEGORIES.map((c) => c.id).sort());
  });

  it('expense round-trips with time / nulls preserved', async () => {
    const e = makeExpense({ time: '14:30', baseAmount: null, fxRate: null, currency: 'USD' });
    await repoA.upsertExpense(e);
    const list = await repoA.listExpenses();
    const got = list.find((x) => x.id === e.id)!;
    expect(got).toEqual(e);
  });

  it('settings round-trip', async () => {
    const s = { ...DEFAULT_SETTINGS, baseCurrency: 'USD', locale: 'en' as const };
    await repoA.putSettings(s);
    expect(await repoA.getSettings()).toEqual(s);
  });

  it('deleteCategory RPC reassigns then deletes; rejects presets', async () => {
    await repoA.upsertCategory({ id: crypto.randomUUID(), name: 'X', color: '#fff', icon: 'comida', isPreset: false });
    const cats = await repoA.listCategories();
    const custom = cats.find((c) => c.name === 'X')!;
    const e = makeExpense({ categoryId: custom.id });
    await repoA.upsertExpense(e);

    await repoA.deleteCategory(custom.id, 'preset-otros');
    expect((await repoA.listCategories()).find((c) => c.id === custom.id)).toBeUndefined();
    expect((await repoA.listExpenses()).find((x) => x.id === e.id)!.categoryId).toBe('preset-otros');

    await expect(repoA.deleteCategory('preset-comida')).rejects.toBeTruthy();
  });

  it('RLS: user B cannot read user A rows', async () => {
    const e = makeExpense({ id: crypto.randomUUID(), merchant: 'A-only' });
    await repoA.upsertExpense(e);
    const bList = await repoB.listExpenses();
    expect(bList.find((x) => x.id === e.id)).toBeUndefined();
  });

  it('RLS: user B cannot write into user A space (own user_id is forced)', async () => {
    const shared = makeExpense({ id: 'shared-id', merchant: 'B-write' });
    await repoB.upsertExpense(shared);
    const aList = await repoA.listExpenses();
    expect(aList.find((x) => x.id === 'shared-id')).toBeUndefined();
  });
});
