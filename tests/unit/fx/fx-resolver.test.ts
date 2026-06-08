import { resolveFxRate } from "@/lib/fx/fx-resolver";
import { __resetMemCache, memGet } from "@/lib/fx/fx-memory-cache";

const DATE = "2026-06-01";

function makeDeps(over: Partial<Parameters<typeof resolveFxRate>[1]> = {}) {
  return {
    dbGet: vi.fn().mockResolvedValue(undefined),
    dbUpsert: vi.fn().mockResolvedValue(undefined),
    fetchUpstream: vi.fn().mockResolvedValue(4000),
    ...over,
  };
}

describe("resolveFxRate", () => {
  beforeEach(() => __resetMemCache());

  it("returns 1 for same currency without any I/O", async () => {
    const deps = makeDeps();
    expect(await resolveFxRate({ from: "USD", to: "USD", date: DATE }, deps)).toBe(1);
    expect(deps.dbGet).not.toHaveBeenCalled();
    expect(deps.fetchUpstream).not.toHaveBeenCalled();
  });

  it("memory-cache hit avoids DB and upstream", async () => {
    const deps = makeDeps();
    await resolveFxRate({ from: "USD", to: "COP", date: DATE }, deps); // primes mem cache
    deps.dbGet.mockClear(); deps.fetchUpstream.mockClear();
    const r = await resolveFxRate({ from: "USD", to: "COP", date: DATE }, deps);
    expect(r).toBe(4000);
    expect(deps.dbGet).not.toHaveBeenCalled();
    expect(deps.fetchUpstream).not.toHaveBeenCalled();
  });

  it("DB hit avoids upstream and memoizes", async () => {
    const deps = makeDeps({ dbGet: vi.fn().mockResolvedValue(3950) });
    const r = await resolveFxRate({ from: "USD", to: "COP", date: DATE }, deps);
    expect(r).toBe(3950);
    expect(deps.fetchUpstream).not.toHaveBeenCalled();
    expect(memGet("USD", "COP", DATE)).toBe(3950);
  });

  it("on DB+mem miss, fetches upstream and upserts to DB", async () => {
    const deps = makeDeps();
    const r = await resolveFxRate({ from: "USD", to: "COP", date: DATE }, deps);
    expect(r).toBe(4000);
    expect(deps.fetchUpstream).toHaveBeenCalledOnce();
    expect(deps.dbUpsert).toHaveBeenCalledWith("USD", "COP", DATE, 4000);
  });

  it("returns null when upstream yields null and does not upsert", async () => {
    const deps = makeDeps({ fetchUpstream: vi.fn().mockResolvedValue(null) });
    const r = await resolveFxRate({ from: "USD", to: "COP", date: DATE }, deps);
    expect(r).toBeNull();
    expect(deps.dbUpsert).not.toHaveBeenCalled();
  });

  it("a failing dbUpsert never breaks the returned rate", async () => {
    const deps = makeDeps({ dbUpsert: vi.fn().mockRejectedValue(new Error("db down")) });
    const r = await resolveFxRate({ from: "USD", to: "COP", date: DATE }, deps);
    expect(r).toBe(4000);
  });
});
