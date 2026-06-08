import { memGet, memSet } from "@/lib/fx/fx-memory-cache";
import type { FxQuery } from "@/lib/fx/fx-validation";

export interface FxResolverDeps {
  /** Read a cached rate from fx_rates, or undefined if absent. */
  dbGet(from: string, to: string, date: string): Promise<number | undefined>;
  /** Upsert a freshly fetched rate into fx_rates (service-role). */
  dbUpsert(from: string, to: string, date: string, rate: number): Promise<void>;
  /** Fetch the rate from the upstream provider; null if unknown/unavailable. */
  fetchUpstream(from: string, to: string, date: string): Promise<number | null>;
}

/**
 * Layered resolve: same-ccy → memory → fx_rates DB → upstream(+upsert).
 * Returns null only when the upstream cannot provide a rate.
 */
export async function resolveFxRate(q: FxQuery, deps: FxResolverDeps): Promise<number | null> {
  const { from, to, date } = q;
  if (from === to) return 1;

  const mem = memGet(from, to, date);
  if (mem !== undefined) return mem;

  const fromDb = await deps.dbGet(from, to, date);
  if (fromDb !== undefined) {
    memSet(from, to, date, fromDb);
    return fromDb;
  }

  const upstream = await deps.fetchUpstream(from, to, date);
  if (upstream === null) return null;

  memSet(from, to, date, upstream);
  try {
    await deps.dbUpsert(from, to, date, upstream);
  } catch {
    // Cache write is best-effort; never fail the request because of it.
  }
  return upstream;
}

/**
 * Default upstream: Frankfurter, server-side, with a hard timeout so a slow
 * upstream can't pin a serverless instance. Returns null on any failure.
 */
export async function fetchFrankfurter(
  from: string,
  to: string,
  date: string,
  timeoutMs = 4000,
): Promise<number | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = `https://api.frankfurter.app/${date}?from=${from}&to=${to}`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const body = await res.json();
    const rate: unknown = body?.rates?.[to];
    return typeof rate === "number" ? rate : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
