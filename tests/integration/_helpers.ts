import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Expense } from '@/lib/domain/types';

export const URL = process.env.SUPABASE_TEST_URL!;
export const PUBLISHABLE = process.env.SUPABASE_TEST_PUBLISHABLE_KEY!;
export const SECRET = process.env.SUPABASE_TEST_SECRET_KEY!;

export const admin = createClient(URL, SECRET, { auth: { persistSession: false } });

export async function makeUserClient(email: string): Promise<{ client: SupabaseClient; id: string }> {
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

export function makeExpense(over: Partial<Expense> = {}): Expense {
  return {
    id: crypto.randomUUID(),
    amount: 10000, currency: 'COP', baseAmount: 10000, fxRate: 1,
    date: '2026-01-01', categoryId: 'preset-comida', source: 'manual',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}
