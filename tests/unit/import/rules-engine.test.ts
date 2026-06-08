import { describe, it, expect } from 'vitest';
import {
  normalizeMerchant,
  matchRule,
  buildRule,
  categorize,
} from '@/lib/import/rules-engine';
import type { CategoryRule } from '@/lib/domain/types';
import type { RawTransaction } from '@/lib/import/templates/types';

describe('normalizeMerchant', () => {
  it('strips diacritics, uppercases, collapses whitespace, trims', () => {
    expect(normalizeMerchant('  Café   Súper-Éxito  ')).toBe('CAFE SUPER-EXITO');
  });

  it('removes asterisks and other punctuation (not - or &)', () => {
    expect(normalizeMerchant('UBER* TRIP 0612')).toBe('UBER TRIP 0612');
  });
});

describe('matchRule', () => {
  const rules: CategoryRule[] = [
    { id: 'r1', pattern: 'UBER', categoryId: 'preset-transporte' },
  ];

  it('returns categoryId when pattern matches by substring', () => {
    expect(matchRule('UBER TRIP 0612', rules)).toBe('preset-transporte');
  });

  it('returns null when no rules match', () => {
    expect(matchRule('UNKNOWN SHOP', [])).toBeNull();
  });

  it('longest-pattern-wins (most specific)', () => {
    const competingRules: CategoryRule[] = [
      { id: 'r1', pattern: 'UBER', categoryId: 'preset-transporte' },
      { id: 'r2', pattern: 'UBER EATS', categoryId: 'preset-comida' },
    ];
    expect(matchRule('UBER EATS 99', competingRules)).toBe('preset-comida');
  });
});

describe('buildRule', () => {
  it('produces a CategoryRule with normalized pattern and a uuid id', () => {
    const rule = buildRule('  Súper Éxito  ', 'preset-mercado');
    expect(rule.pattern).toBe('SUPER EXITO');
    expect(rule.categoryId).toBe('preset-mercado');
    expect(typeof rule.id).toBe('string');
    expect(rule.id.length).toBeGreaterThan(0);
  });
});

describe('categorize', () => {
  const rules: CategoryRule[] = [
    { id: 'r1', pattern: 'UBER', categoryId: 'preset-transporte' },
    { id: 'r2', pattern: 'RAPPI', categoryId: 'preset-comida' },
  ];

  const raws: RawTransaction[] = [
    { date: '2026-06-01', description: 'UBER TRIP 0612 BOGOTA', amount: 18500, currency: 'COP' },
    { date: '2026-06-02', description: 'Rappi   domicilio', amount: 32000, currency: 'COP' },
    { date: '2026-06-03', description: 'FARMACIA NACIONAL', amount: 7000, currency: 'COP' },
  ];

  it('maps matched raws to rule categoryId, unmatched to fallback', () => {
    const result = categorize(raws, rules, 'preset-otros');
    expect(result[0].categoryId).toBe('preset-transporte');
    expect(result[0].matched).toBe(true);
    expect(result[1].categoryId).toBe('preset-comida');
    expect(result[1].matched).toBe(true);
    expect(result[2].categoryId).toBe('preset-otros');
    expect(result[2].matched).toBe(false);
  });
});
