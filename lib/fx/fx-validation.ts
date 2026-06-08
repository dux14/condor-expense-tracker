import { z } from "zod";

/**
 * ISO-4217 active currency codes whitelist. Trimmed to a broad, common set;
 * extend as the app supports more. A whitelist (not a regex) blocks bogus
 * 3-letter strings from ever reaching the upstream API.
 */
export const ISO_4217 = new Set<string>([
  "AED","ARS","AUD","BGN","BRL","CAD","CHF","CLP","CNY","COP","CRC","CZK",
  "DKK","EUR","GBP","HKD","HUF","IDR","ILS","INR","ISK","JPY","KRW","MXN",
  "MYR","NOK","NZD","PEN","PHP","PLN","RON","SEK","SGD","THB","TRY","USD",
  "UYU","ZAR",
]);

const currency = z
  .string()
  .length(3)
  .regex(/^[A-Z]{3}$/)
  .refine((c) => ISO_4217.has(c), { message: "unsupported currency" });

/** Strict yyyy-MM-dd that is a real calendar date and not in the future. */
function dateSchema(today: string) {
  return z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "date must be yyyy-MM-dd" })
    .refine((d) => {
      const [y, m, day] = d.split("-").map(Number);
      const dt = new Date(Date.UTC(y, m - 1, day));
      return (
        dt.getUTCFullYear() === y &&
        dt.getUTCMonth() === m - 1 &&
        dt.getUTCDate() === day
      );
    }, { message: "invalid calendar date" })
    .refine((d) => d <= today, { message: "date must not be in the future" });
}

export type FxQuery = { from: string; to: string; date: string };

/** `today` defaults to the current UTC date (yyyy-MM-dd); injectable for tests. */
export function parseFxQuery(
  input: unknown,
  today: string = new Date().toISOString().slice(0, 10),
) {
  const schema = z.object({ from: currency, to: currency, date: dateSchema(today) });
  return schema.safeParse(input);
}
