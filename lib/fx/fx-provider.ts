export interface FxProvider {
  /** Rate to convert `from` → `base` on a given date (yyyy-MM-dd). 1 if equal; null if unknown. */
  getRate(from: string, base: string, date: string): Promise<number | null>;
}
