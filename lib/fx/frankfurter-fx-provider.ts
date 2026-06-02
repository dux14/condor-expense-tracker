import type { FxProvider } from "@/lib/fx/fx-provider";
import { getCached, setCached, lastForPair } from "@/lib/fx/fx-cache";

export class FrankfurterFxProvider implements FxProvider {
  async getRate(from: string, base: string, date: string): Promise<number | null> {
    // 1. Same currency — no network, no cache.
    if (from === base) return 1;

    // 2. Cache hit — past-date rates are immutable.
    const cached = getCached(from, base, date);
    if (cached !== undefined) return cached;

    // 3. Fetch — only currency codes + date travel over the wire.
    try {
      const url = `https://api.frankfurter.app/${date}?from=${from}&to=${base}`;
      const res = await fetch(url);

      if (res.ok) {
        const body = await res.json();
        const rate: unknown = body?.rates?.[base];

        if (typeof rate === "number") {
          setCached(from, base, date, rate);
          return rate;
        }
      }
    } catch {
      // Network error or JSON parse error — fall through to fallback.
    }

    // 4. Fallback: use the most recent cached rate for the pair.
    const fallback = lastForPair(from, base);
    if (fallback !== undefined) return fallback;

    return null;
  }
}
