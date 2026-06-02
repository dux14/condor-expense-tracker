import { FrankfurterFxProvider } from "@/lib/fx/frankfurter-fx-provider";

const DATE_A = "2026-06-01";
const DATE_B = "2026-06-02";

function makeFetchOk(rates: Record<string, number>, base = "USD", date = DATE_A) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ amount: 1, base, date, rates }),
  });
}

describe("FrankfurterFxProvider", () => {
  let provider: FrankfurterFxProvider;

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    provider = new FrankfurterFxProvider();
  });

  it("returns 1 immediately when from === base, does not call fetch", async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    const rate = await provider.getRate("USD", "USD", DATE_A);
    expect(rate).toBe(1);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("fetches and returns rate on cache miss", async () => {
    const mockFetch = makeFetchOk({ COP: 4000 });
    vi.stubGlobal("fetch", mockFetch);

    const rate = await provider.getRate("USD", "COP", DATE_A);
    expect(rate).toBe(4000);
    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockFetch).toHaveBeenCalledWith(
      `https://api.frankfurter.app/${DATE_A}?from=USD&to=COP`
    );
  });

  it("stores the rate in cache after a successful fetch", async () => {
    vi.stubGlobal("fetch", makeFetchOk({ COP: 4000 }));
    await provider.getRate("USD", "COP", DATE_A);

    // Second call — fetch should NOT be called again
    const mockFetch2 = vi.fn();
    vi.stubGlobal("fetch", mockFetch2);

    const rate = await provider.getRate("USD", "COP", DATE_A);
    expect(rate).toBe(4000);
    expect(mockFetch2).not.toHaveBeenCalled();
  });

  it("uses lastForPair as offline fallback after fetch rejects (new date)", async () => {
    // Prime cache with date A
    vi.stubGlobal("fetch", makeFetchOk({ COP: 4000 }, "USD", DATE_A));
    await provider.getRate("USD", "COP", DATE_A);

    // Now fetch rejects for date B
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));
    const rate = await provider.getRate("USD", "COP", DATE_B);
    expect(rate).toBe(4000);
  });

  it("returns null when fetch throws and no prior cached rate exists", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));
    const rate = await provider.getRate("USD", "COP", DATE_A);
    expect(rate).toBeNull();
  });

  it("returns null when response is not ok and no prior cache", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) })
    );
    const rate = await provider.getRate("USD", "COP", DATE_A);
    expect(rate).toBeNull();
  });

  it("returns null when rates[base] is missing from body and no prior cache", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ amount: 1, base: "USD", date: DATE_A, rates: {} }),
      })
    );
    const rate = await provider.getRate("USD", "COP", DATE_A);
    expect(rate).toBeNull();
  });

  it("returns null when rates[base] is not a number and no prior cache", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          amount: 1,
          base: "USD",
          date: DATE_A,
          rates: { COP: "not-a-number" },
        }),
      })
    );
    const rate = await provider.getRate("USD", "COP", DATE_A);
    expect(rate).toBeNull();
  });

  it("uses lastForPair fallback when ok=false but prior rate exists", async () => {
    // Prime with a successful fetch for date A
    vi.stubGlobal("fetch", makeFetchOk({ COP: 4000 }, "USD", DATE_A));
    await provider.getRate("USD", "COP", DATE_A);

    // Non-ok for date B
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) })
    );
    const rate = await provider.getRate("USD", "COP", DATE_B);
    expect(rate).toBe(4000);
  });
});
