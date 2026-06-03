const CACHE_KEY = "condor:fxcache";

type CacheStore = Record<string, number>;

function cacheKey(from: string, base: string, date: string): string {
  return `${from}:${base}:${date}`;
}

function readStore(): CacheStore {
  // SSR guard
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    return parsed as CacheStore;
  } catch {
    return {};
  }
}

function writeStore(store: CacheStore): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(store));
  } catch {
    // quota exceeded or unavailable — silently ignore
  }
}

export function getCached(from: string, base: string, date: string): number | undefined {
  const store = readStore();
  const value = store[cacheKey(from, base, date)];
  return typeof value === "number" ? value : undefined;
}

export function setCached(from: string, base: string, date: string, rate: number): void {
  const store = readStore();
  store[cacheKey(from, base, date)] = rate;
  writeStore(store);
}

/**
 * Returns the cached rate for the most recent date for a given pair (max by date string).
 * Used as offline fallback when a fresh fetch fails.
 */
export function lastForPair(from: string, base: string): number | undefined {
  const store = readStore();
  const prefix = `${from}:${base}:`;

  let maxDate = "";
  let maxRate: number | undefined;

  for (const key of Object.keys(store)) {
    if (!key.startsWith(prefix)) continue;
    const date = key.slice(prefix.length);
    if (date > maxDate) {
      maxDate = date;
      maxRate = store[key];
    }
  }

  return maxRate;
}
