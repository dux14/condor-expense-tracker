import { ServerFxProvider } from "@/lib/fx/server-fx-provider";

const DATE = "2026-06-01";

describe("ServerFxProvider", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("returns 1 for same currency without calling the proxy", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const p = new ServerFxProvider();
    expect(await p.getRate("USD", "USD", DATE)).toBe(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns the proxy rate on 200", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => ({ rate: 4000 }),
    }));
    const p = new ServerFxProvider();
    const r = await p.getRate("USD", "COP", DATE);
    expect(r).toBe(4000);
  });

  it("returns null when the proxy returns { rate: null } and no fallback", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => ({ rate: null }),
    }));
    const p = new ServerFxProvider({ fallback: null });
    expect(await p.getRate("USD", "COP", DATE)).toBeNull();
  });

  it("returns null on proxy 500 with no fallback", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false, status: 500, json: async () => ({}),
    }));
    const p = new ServerFxProvider({ fallback: null });
    expect(await p.getRate("USD", "COP", DATE)).toBeNull();
  });

  it("returns null when fetch rejects (offline) and no fallback", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const p = new ServerFxProvider({ fallback: null });
    expect(await p.getRate("USD", "COP", DATE)).toBeNull();
  });

  it("falls back to the injected provider when the proxy fails (network up)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false, status: 500, json: async () => ({}),
    }));
    const fallback = { getRate: vi.fn().mockResolvedValue(3950) };
    const p = new ServerFxProvider({ fallback });
    expect(await p.getRate("USD", "COP", DATE)).toBe(3950);
    expect(fallback.getRate).toHaveBeenCalledWith("USD", "COP", DATE);
  });
});
