import { NextRequest } from "next/server";

// --- mocks (declare before importing the route) ---
const getUser = vi.fn();
vi.mock("@/lib/auth/supabase-server", () => ({
  createClient: async () => ({ auth: { getUser } }),
}));

const dbGet = vi.fn();
const dbUpsert = vi.fn();
vi.mock("@/lib/fx/fx-db", () => ({
  fxDbGet: (...a: unknown[]) => dbGet(...a),
  fxDbUpsert: (...a: unknown[]) => dbUpsert(...a),
}));

const fetchUpstream = vi.fn();
vi.mock("@/lib/fx/fx-resolver", async (orig) => {
  const mod = await orig<typeof import("@/lib/fx/fx-resolver")>();
  return { ...mod, fetchFrankfurter: (...a: unknown[]) => fetchUpstream(...a) };
});

import { GET } from "@/app/api/fx/route";
import { __resetMemCache } from "@/lib/fx/fx-memory-cache";
import { __resetRateLimit } from "@/lib/api/rate-limit";

function req(qs: string) {
  return new NextRequest(`https://x.test/api/fx?${qs}`);
}
const TODAY = new Date().toISOString().slice(0, 10);

beforeEach(() => {
  vi.clearAllMocks();
  __resetMemCache();
  __resetRateLimit();
  getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  dbGet.mockResolvedValue(undefined);
  dbUpsert.mockResolvedValue(undefined);
  fetchUpstream.mockResolvedValue(4000);
});

describe("GET /api/fx", () => {
  it("401 for anonymous users", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await GET(req(`from=USD&to=COP&date=2026-06-01`));
    expect(res.status).toBe(401);
  });

  it("400 for invalid currency / future date", async () => {
    expect((await GET(req(`from=usd&to=COP&date=2026-06-01`))).status).toBe(400);
    const future = "2999-01-01";
    expect((await GET(req(`from=USD&to=COP&date=${future}`))).status).toBe(400);
  });

  it("200 with rate and immutable Cache-Control for a past date", async () => {
    const res = await GET(req(`from=USD&to=COP&date=2026-06-01`));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ rate: 4000 });
    expect(res.headers.get("cache-control")).toContain("max-age=86400");
    expect(res.headers.get("cache-control")).toContain("immutable");
  });

  it("cache hit (mem) does not call upstream on the second request", async () => {
    await GET(req(`from=USD&to=COP&date=2026-06-01`));
    fetchUpstream.mockClear();
    const res = await GET(req(`from=USD&to=COP&date=2026-06-01`));
    expect(res.status).toBe(200);
    expect(fetchUpstream).not.toHaveBeenCalled();
  });

  it("200 { rate: null } when upstream cannot resolve (no cache header)", async () => {
    fetchUpstream.mockResolvedValue(null);
    const res = await GET(req(`from=USD&to=COP&date=2026-06-01`));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ rate: null });
    expect(res.headers.get("cache-control") ?? "").not.toContain("immutable");
  });

  it("429 after exceeding the per-user limit", async () => {
    let last: Response | undefined;
    for (let i = 0; i < 40; i++) {
      last = await GET(req(`from=USD&to=COP&date=2026-06-0${(i % 9) + 1}`));
    }
    expect(last!.status).toBe(429);
    expect(last!.headers.get("retry-after")).toBeTruthy();
  });
});
