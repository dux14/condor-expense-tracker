import { getCached, setCached, lastForPair } from "@/lib/fx/fx-cache";

describe("fx-cache", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns undefined on cache miss", () => {
    expect(getCached("USD", "COP", "2026-06-01")).toBeUndefined();
  });

  it("round-trips a cached rate", () => {
    setCached("USD", "COP", "2026-06-01", 4000);
    expect(getCached("USD", "COP", "2026-06-01")).toBe(4000);
  });

  it("returns undefined for a different date after storing another date", () => {
    setCached("USD", "COP", "2026-06-01", 4000);
    expect(getCached("USD", "COP", "2026-06-02")).toBeUndefined();
  });

  it("lastForPair returns undefined when no rates cached", () => {
    expect(lastForPair("USD", "COP")).toBeUndefined();
  });

  it("lastForPair returns the only stored rate", () => {
    setCached("USD", "COP", "2026-06-01", 4000);
    expect(lastForPair("USD", "COP")).toBe(4000);
  });

  it("lastForPair returns the rate for the most recent date (max by date string)", () => {
    setCached("USD", "COP", "2026-05-01", 3900);
    setCached("USD", "COP", "2026-06-01", 4000);
    setCached("USD", "COP", "2026-04-15", 3800);
    expect(lastForPair("USD", "COP")).toBe(4000);
  });

  it("lastForPair is independent per pair", () => {
    setCached("USD", "COP", "2026-06-01", 4000);
    setCached("EUR", "COP", "2026-06-01", 4500);
    expect(lastForPair("USD", "COP")).toBe(4000);
    expect(lastForPair("EUR", "COP")).toBe(4500);
  });

  it("treats a corrupt localStorage value as empty cache", () => {
    localStorage.setItem("condor:fxcache", "not-json-{{{");
    expect(getCached("USD", "COP", "2026-06-01")).toBeUndefined();
    expect(lastForPair("USD", "COP")).toBeUndefined();
  });

  it("setCached survives a corrupt initial value by overwriting it", () => {
    localStorage.setItem("condor:fxcache", "bad");
    setCached("USD", "COP", "2026-06-01", 4000);
    expect(getCached("USD", "COP", "2026-06-01")).toBe(4000);
  });
});
