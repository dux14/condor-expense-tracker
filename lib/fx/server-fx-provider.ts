import type { FxProvider } from "@/lib/fx/fx-provider";
import { FrankfurterFxProvider } from "@/lib/fx/frankfurter-fx-provider";

interface ServerFxProviderOptions {
  /** Base path for the proxy. */
  endpoint?: string;
  /**
   * Last-resort provider used ONLY when the proxy itself fails (non-2xx or
   * network error) but the device may still reach the upstream directly.
   * Pass `null` to disable the fallback. Defaults to a direct
   * FrankfurterFxProvider. Composition order is, by design:
   *   1. /api/fx (server cache + DB)   ← primary
   *   2. FrankfurterFxProvider direct  ← fallback (proxy down, network up)
   *   3. null                          ← give up; store treats null gracefully
   */
  fallback?: FxProvider | null;
}

export class ServerFxProvider implements FxProvider {
  private readonly endpoint: string;
  private readonly fallback: FxProvider | null;

  constructor(opts: ServerFxProviderOptions = {}) {
    this.endpoint = opts.endpoint ?? "/api/fx";
    this.fallback =
      opts.fallback === undefined ? new FrankfurterFxProvider() : opts.fallback;
  }

  async getRate(from: string, base: string, date: string): Promise<number | null> {
    if (from === base) return 1;

    try {
      const url = `${this.endpoint}?from=${from}&to=${base}&date=${date}`;
      const res = await fetch(url);
      if (res.ok) {
        const body = await res.json();
        const rate: unknown = body?.rate;
        if (typeof rate === "number") return rate;
        if (rate === null) return null; // proxy says "unknown" — authoritative
      }
      // Non-2xx (e.g. 429/500): fall through to fallback.
    } catch {
      // Network error: fall through to fallback.
    }

    if (this.fallback) {
      return this.fallback.getRate(from, base, date);
    }
    return null;
  }
}
