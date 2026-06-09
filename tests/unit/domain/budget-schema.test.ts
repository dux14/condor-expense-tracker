import { describe, it, expect } from 'vitest';
import { budgetSchema, parseBudget } from '@/lib/domain/schemas';
import type { Budget } from '@/lib/domain/types';

function makeBudget(over: Partial<Budget> = {}): Budget {
  return {
    id: 'b1',
    categoryId: 'preset-comida',
    amountBase: 500000,
    period: 'monthly',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

describe('budgetSchema / parseBudget', () => {
  it('accepts a valid monthly budget', () => {
    const b = makeBudget();
    expect(parseBudget(b)).toEqual(b);
  });

  it('accepts amountBase === 0 (a zero cap is valid)', () => {
    expect(() => parseBudget(makeBudget({ amountBase: 0 }))).not.toThrow();
  });

  it('rejects a negative amountBase', () => {
    expect(() => parseBudget(makeBudget({ amountBase: -1 }))).toThrow();
  });

  it("rejects a period other than 'monthly'", () => {
    // @ts-expect-error — intentionally invalid period
    expect(() => parseBudget(makeBudget({ period: 'weekly' }))).toThrow();
  });

  it('rejects a missing categoryId', () => {
    const { categoryId, ...rest } = makeBudget();
    void categoryId;
    expect(() => budgetSchema.parse(rest)).toThrow();
  });
});
