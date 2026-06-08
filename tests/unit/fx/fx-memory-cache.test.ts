import { memGet, memSet, __resetMemCache, MEM_CACHE_MAX } from "@/lib/fx/fx-memory-cache";

describe("fx-memory-cache", () => {
  beforeEach(() => __resetMemCache());

  it("returns undefined on miss, the value on hit", () => {
    expect(memGet("USD", "COP", "2026-06-01")).toBeUndefined();
    memSet("USD", "COP", "2026-06-01", 4000);
    expect(memGet("USD", "COP", "2026-06-01")).toBe(4000);
  });

  it("keys are pair+date specific", () => {
    memSet("USD", "COP", "2026-06-01", 4000);
    expect(memGet("USD", "COP", "2026-06-02")).toBeUndefined();
    expect(memGet("EUR", "COP", "2026-06-01")).toBeUndefined();
  });

  it("evicts oldest entries past the cap", () => {
    for (let i = 0; i < MEM_CACHE_MAX + 50; i++) {
      memSet("USD", "COP", `2020-01-${String((i % 28) + 1).padStart(2, "0")}-${i}`, i);
    }
    // The very first inserted key should have been evicted.
    expect(memGet("USD", "COP", "2020-01-01-0")).toBeUndefined();
  });
});
