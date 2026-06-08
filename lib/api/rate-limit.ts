/**
 * Lightweight in-memory sliding-window rate limiter, keyed by user_id.
 *
 * LIMITATION: per-instance, NOT global. Each warm serverless instance keeps its
 * own window, so the effective global limit is (MAX × live instances). This is
 * acceptable for /api/fx because the work behind the limiter is cheap and
 * heavily cached (in-mem → fx_rates → Frankfurter). The limiter exists to blunt
 * accidental loops / abuse, not to enforce a hard global quota. Upgrading to a
 * shared store (e.g. Upstash) was explicitly declined in design decision D4.
 */
export const RATE_LIMIT_MAX = 30;
export const RATE_LIMIT_WINDOW_MS = 60_000;

const hits = new Map<string, number[]>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export function rateLimit(
  key: string,
  max: number = RATE_LIMIT_MAX,
  windowMs: number = RATE_LIMIT_WINDOW_MS,
): RateLimitResult {
  const now = Date.now();
  const cutoff = now - windowMs;
  const recent = (hits.get(key) ?? []).filter((t) => t > cutoff);

  if (recent.length >= max) {
    hits.set(key, recent);
    const retryAfterMs = recent[0] + windowMs - now;
    return { allowed: false, remaining: 0, retryAfterMs: Math.max(retryAfterMs, 0) };
  }

  recent.push(now);
  hits.set(key, recent);
  return { allowed: true, remaining: max - recent.length, retryAfterMs: 0 };
}

/** Test-only reset. */
export function __resetRateLimit(): void {
  hits.clear();
}
