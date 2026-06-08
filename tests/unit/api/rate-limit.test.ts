import { rateLimit, __resetRateLimit, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS } from "@/lib/api/rate-limit";

describe("rateLimit (sliding window, in-memory)", () => {
  beforeEach(() => {
    __resetRateLimit();
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });
  afterEach(() => vi.useRealTimers());

  it("allows up to MAX requests in the window, then blocks", () => {
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      expect(rateLimit("user-1").allowed).toBe(true);
    }
    const blocked = rateLimit("user-1");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("isolates keys per user", () => {
    for (let i = 0; i < RATE_LIMIT_MAX; i++) rateLimit("user-1");
    expect(rateLimit("user-2").allowed).toBe(true);
  });

  it("frees capacity after the window slides", () => {
    for (let i = 0; i < RATE_LIMIT_MAX; i++) rateLimit("user-1");
    expect(rateLimit("user-1").allowed).toBe(false);
    vi.setSystemTime(RATE_LIMIT_WINDOW_MS + 1);
    expect(rateLimit("user-1").allowed).toBe(true);
  });
});
