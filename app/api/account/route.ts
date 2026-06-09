import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/auth/supabase-server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // auth per request

// User tables holding PII, keyed by user_id (NO FK cascade to auth.users — so
// rows must be deleted explicitly BEFORE the auth user, else they orphan).
const USER_TABLES = [
  "expenses",
  "budgets",
  "category_rules",
  "categories",
  "settings",
] as const;

// DELETE /api/account — permanently deletes the calling user's cloud data and
// auth account. This is the SINGLE authoritative cloud-cleanup path: rows are
// removed server-side (no client-trust dependency), scoped by the verified
// session user_id.
//
// SECURITY INVARIANT: the user id is derived ONLY from the verified session via
// getUser() — NEVER from the request body/query. The handler takes no input, so
// a caller cannot redirect the deletion at someone else's account. The admin
// client uses SUPABASE_SECRET_KEY (server-only) and is never exposed client-side.
//
// ORDERING INVARIANT: every user row is deleted before the auth user. If ANY
// row-delete errors we return 500 and DO NOT call deleteUser — we never delete
// the auth user while PII rows remain (which would orphan them, no cascade).
export async function DELETE(): Promise<Response> {
  // 1. Auth — anonymous users get 401.
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 2. Admin client (SUPABASE_SECRET_KEY is server-only, never client-exposed).
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false } },
  );

  // 3. Delete the user's rows from every user table (scoped by the verified
  //    session user_id, never the request) BEFORE deleting the auth user.
  for (const table of USER_TABLES) {
    const { error } = await admin.from(table).delete().eq("user_id", user.id);
    if (error) {
      return NextResponse.json({ error: "delete_failed" }, { status: 500 });
    }
  }

  // 4. Only now delete the auth user (id from getUser(), never the request).
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
