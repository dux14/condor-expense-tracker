/**
 * Per-instance in-memory FX cache. On Vercel Fluid Compute, warm instances are
 * reused, so this absorbs repeated lookups for the same (pair, date) without
 * touching the DB. Past-date rates are immutable → no TTL. FIFO-capped.
 *
 * Limitation: scoped to a single serverless instance, not global. Acceptable
 * because the DB cache (fx_rates) is the durable shared layer behind it.
 */
export const MEM_CACHE_MAX = 500;

const cache = new Map<string, number>();

function key(from: string, to: string, date: string): string {
  return `${from}:${to}:${date}`;
}

export function memGet(from: string, to: string, date: string): number | undefined {
  return cache.get(key(from, to, date));
}

export function memSet(from: string, to: string, date: string, rate: number): void {
  const k = key(from, to, date);
  if (!cache.has(k) && cache.size >= MEM_CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(k, rate);
}

/** Test-only reset. */
export function __resetMemCache(): void {
  cache.clear();
}
