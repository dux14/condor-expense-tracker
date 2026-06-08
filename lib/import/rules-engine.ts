import { newId } from '@/lib/domain/ids';
import type { CategoryRule } from '@/lib/domain/types';
import type { RawTransaction } from './templates/types';

/** Uppercase, strip accents (NFD), drop punctuation except internal - and &, collapse spaces. */
export function normalizeMerchant(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // strip diacritics
    .toUpperCase()
    .replace(/[^A-Z0-9\s&-]/g, ' ')    // keep alnum, space, & and -
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Find the best rule for a merchant string.
 * Match = the normalized merchant starts with, or contains, the rule's (already
 * normalized) pattern. The most specific (longest) matching pattern wins.
 */
export function matchRule(merchant: string, rules: CategoryRule[]): string | null {
  const m = normalizeMerchant(merchant);
  let best: CategoryRule | null = null;
  for (const r of rules) {
    if (!r.pattern) continue;
    if (m === r.pattern || m.startsWith(r.pattern) || m.includes(r.pattern)) {
      if (best === null || r.pattern.length > best.pattern.length) best = r;
    }
  }
  return best ? best.categoryId : null;
}

/** Build a learnable rule from a raw merchant + the category the user chose. */
export function buildRule(merchant: string, categoryId: string): CategoryRule {
  return { id: newId(), pattern: normalizeMerchant(merchant), categoryId };
}

export interface CategorizedTransaction extends RawTransaction {
  categoryId: string;          // suggested
  matched: boolean;            // true if a rule produced it (not the fallback)
}

/** Suggest a category for every raw transaction. */
export function categorize(
  raws: RawTransaction[],
  rules: CategoryRule[],
  fallbackCategoryId: string,
): CategorizedTransaction[] {
  return raws.map((r) => {
    const hit = matchRule(r.description, rules);
    return { ...r, categoryId: hit ?? fallbackCategoryId, matched: hit !== null };
  });
}
