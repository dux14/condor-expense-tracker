import { parseFxQuery, ISO_4217 } from "@/lib/fx/fx-validation";

describe("parseFxQuery", () => {
  const valid = { from: "USD", to: "COP", date: "2026-06-01" };

  it("accepts a valid query and uppercases nothing extra", () => {
    const r = parseFxQuery(valid);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual(valid);
  });

  it("rejects lowercase / non-3-letter / non-whitelisted codes", () => {
    expect(parseFxQuery({ ...valid, from: "usd" }).success).toBe(false);
    expect(parseFxQuery({ ...valid, from: "US" }).success).toBe(false);
    expect(parseFxQuery({ ...valid, from: "ABCD" }).success).toBe(false);
    expect(parseFxQuery({ ...valid, from: "ZZZ" }).success).toBe(false); // 3 letters, not ISO-4217
  });

  it("rejects malformed dates", () => {
    expect(parseFxQuery({ ...valid, date: "2026-6-1" }).success).toBe(false);
    expect(parseFxQuery({ ...valid, date: "06/01/2026" }).success).toBe(false);
    expect(parseFxQuery({ ...valid, date: "2026-13-40" }).success).toBe(false);
  });

  it("rejects future dates relative to a fixed today", () => {
    const today = "2026-06-07";
    expect(parseFxQuery({ ...valid, date: "2026-06-08" }, today).success).toBe(false);
    expect(parseFxQuery({ ...valid, date: today }, today).success).toBe(true);
  });

  it("rejects missing fields", () => {
    expect(parseFxQuery({ from: "USD", to: "COP" }).success).toBe(false);
  });

  it("ISO_4217 contains the app currencies", () => {
    for (const c of ["USD", "EUR", "COP", "GBP", "JPY", "MXN", "BRL", "CAD"]) {
      expect(ISO_4217.has(c)).toBe(true);
    }
  });
});
