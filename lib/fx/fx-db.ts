import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Service-role client: server-only, bypasses RLS to write fx_rates. */
function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false } },
  );
}

/**
 * Read a cached FX rate from fx_rates using an authenticated Supabase client.
 * The table grants SELECT only to the `authenticated` role; anon is revoked.
 * The caller (route handler) must supply the per-request authenticated client.
 */
export async function fxDbGet(
  client: SupabaseClient,
  from: string,
  to: string,
  date: string,
): Promise<number | undefined> {
  const { data, error } = await client
    .from("fx_rates")
    .select("rate")
    .eq("from_ccy", from)
    .eq("to_ccy", to)
    .eq("on_date", date)
    .maybeSingle();
  if (error || !data) return undefined;
  return typeof data.rate === "number" ? data.rate : Number(data.rate);
}

export async function fxDbUpsert(
  from: string,
  to: string,
  date: string,
  rate: number,
): Promise<void> {
  const { error } = await serviceClient()
    .from("fx_rates")
    .upsert(
      { from_ccy: from, to_ccy: to, on_date: date, rate },
      { onConflict: "from_ccy,to_ccy,on_date" },
    );
  if (error) throw error;
}
