import { NextRequest, NextResponse } from "next/server";
import { parseFxQuery } from "@/lib/fx/fx-validation";
import { resolveFxRate, fetchFrankfurter } from "@/lib/fx/fx-resolver";
import { fxDbGet, fxDbUpsert } from "@/lib/fx/fx-db";
import { rateLimit } from "@/lib/api/rate-limit";
import { createClient as createServerClient } from "@/lib/auth/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // auth + rate limit per request

export async function GET(request: NextRequest): Promise<Response> {
  // 1. Auth — anonymous users get 401.
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 2. Rate limit per user_id (in-memory sliding window).
  const rl = rateLimit(user.id);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  // 3. Validate query (ISO-4217 whitelist, yyyy-MM-dd, non-future).
  const sp = request.nextUrl.searchParams;
  const parsed = parseFxQuery({ from: sp.get("from"), to: sp.get("to"), date: sp.get("date") });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_query", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // 4. Resolve: memory → fx_rates → Frankfurter (+upsert).
  const rate = await resolveFxRate(parsed.data, {
    dbGet: fxDbGet,
    dbUpsert: fxDbUpsert,
    fetchUpstream: fetchFrankfurter,
  });

  // 5. Cache headers: only immutable for a resolved historical rate.
  const headers: Record<string, string> =
    rate !== null
      ? { "Cache-Control": "public, max-age=86400, immutable" }
      : { "Cache-Control": "no-store" };

  return NextResponse.json({ rate }, { status: 200, headers });
}
