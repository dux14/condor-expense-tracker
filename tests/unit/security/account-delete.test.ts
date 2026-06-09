// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Records of every table delete + the (column, value) the row-delete was scoped
// to, so tests can assert rows are deleted by the verified session user_id.
type EqCall = { table: string; column: string; value: unknown };
const eqCalls: EqCall[] = [];

// Per-table error override: set tableErrors['categories'] = { message } to make
// that table's delete().eq() resolve with an error.
let tableErrors: Record<string, { message: string } | null> = {};

const deleteUser = vi.fn();

// Admin client: from(table).delete().eq(column, value). The eq() records the
// call and resolves with the (optional) configured error for that table.
const from = vi.fn((table: string) => ({
  delete: () => ({
    eq: (column: string, value: unknown) => {
      eqCalls.push({ table, column, value });
      return Promise.resolve({ error: tableErrors[table] ?? null });
    },
  }),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from,
    auth: { admin: { deleteUser } },
  }),
}));

const getUser = vi.fn();
vi.mock('@/lib/auth/supabase-server', () => ({
  createClient: async () => ({ auth: { getUser } }),
}));

import { DELETE } from '@/app/api/account/route';

const USER_TABLES = ['expenses', 'budgets', 'category_rules', 'categories', 'settings'];

beforeEach(() => {
  vi.clearAllMocks();
  eqCalls.length = 0;
  tableErrors = {};
  deleteUser.mockResolvedValue({ error: null });
});

describe('DELETE /api/account', () => {
  it('returns 401, deletes no rows, and never calls deleteUser when anonymous', async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    const res = await DELETE();

    expect(res.status).toBe(401);
    expect(eqCalls).toHaveLength(0);
    expect(from).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('authed: deletes rows for ALL user tables by session user_id, THEN the auth user, returns 200', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });

    const res = await DELETE();

    expect(res.status).toBe(200);

    // Every user table had its rows deleted, scoped by the verified user_id.
    expect(eqCalls.map((c) => c.table)).toEqual(USER_TABLES);
    for (const c of eqCalls) {
      expect(c.column).toBe('user_id');
      expect(c.value).toBe('u1');
    }

    // Auth user deleted exactly once with the session id.
    expect(deleteUser).toHaveBeenCalledTimes(1);
    expect(deleteUser).toHaveBeenCalledWith('u1');
  });

  it('CRITICAL: derives the id from the session only — a forged request body cannot redirect the deletion', async () => {
    // The session belongs to u1. The handler takes NO arguments, so a
    // body-supplied victim id 'u2' can never reach the row-delete or deleteUser.
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });

    // @ts-expect-error — the handler intentionally accepts no arguments; passing
    // a forged request must be ignored. This call documents the attack vector.
    const res = await DELETE({ json: async () => ({ id: 'u2' }) });

    expect(res.status).toBe(200);

    // Rows + auth user were all scoped to the session id, never the forged one.
    for (const c of eqCalls) {
      expect(c.value).toBe('u1');
      expect(c.value).not.toBe('u2');
    }
    expect(deleteUser).toHaveBeenCalledWith('u1');
    expect(deleteUser).not.toHaveBeenCalledWith('u2');
  });

  it('row-delete error: returns 500 and does NOT delete the auth user (no orphaned PII)', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    // Make one table fail mid-sweep.
    tableErrors = { category_rules: { message: 'boom' } };

    const res = await DELETE();

    expect(res.status).toBe(500);
    // We aborted at the failing table — the auth user is NOT deleted while rows
    // may remain. This is the ordering invariant that prevents orphaned rows.
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('returns 500 when the auth-user deletion fails', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    deleteUser.mockResolvedValue({ error: { message: 'boom' } });

    const res = await DELETE();

    expect(res.status).toBe(500);
    // Rows were attempted (all tables) before the auth-user delete failed.
    expect(eqCalls.map((c) => c.table)).toEqual(USER_TABLES);
  });
});
