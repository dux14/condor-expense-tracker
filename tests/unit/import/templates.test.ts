import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { genericTemplate } from '@/lib/import/templates/generic';
import { pickTemplate } from '@/lib/import/templates/index';

const fixturePath = join(process.cwd(), 'tests/fixtures/statements/generic-sample.txt');
const text = readFileSync(fixturePath, 'utf-8');

describe('genericTemplate', () => {
  it('detect() always returns true (fallback)', () => {
    expect(genericTemplate.detect(text)).toBe(true);
    expect(genericTemplate.detect('')).toBe(true);
  });

  it('parse() returns exactly 3 transactions (expenses only, no credits, no noise)', () => {
    const txns = genericTemplate.parse(text);
    expect(txns).toHaveLength(3);
  });

  it('first row parsed correctly with Colombian amount', () => {
    const txns = genericTemplate.parse(text);
    expect(txns[0]).toEqual({
      date: '2026-05-03',
      description: 'UBER TRIP 0612 BOGOTA',
      amount: 18500,
      currency: 'COP',
    });
  });

  it('dd/mm/yyyy date normalized to ISO yyyy-MM-dd', () => {
    const txns = genericTemplate.parse(text);
    const netflix = txns.find((t) => t.description.includes('NETFLIX'));
    expect(netflix).toBeDefined();
    expect(netflix!.date).toBe('2026-05-05');
  });
});

describe('pickTemplate', () => {
  it('returns the generic template when nothing more specific matches', () => {
    const tpl = pickTemplate(text);
    expect(tpl.id).toBe('generic');
  });
});
