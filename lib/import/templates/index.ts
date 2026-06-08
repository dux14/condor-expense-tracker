import type { StatementTemplate, RawTransaction } from './types';
import { genericTemplate } from './generic';

// Order matters: specific banks first, generic LAST (its detect() always returns true).
// Add a bank = push its template here (above genericTemplate) + a fixture + a test.
export const TEMPLATES: StatementTemplate[] = [
  // bancolombiaTemplate,  ← future banks go here
  genericTemplate,
];

export function pickTemplate(text: string): StatementTemplate {
  return TEMPLATES.find((t) => t.detect(text)) ?? genericTemplate;
}

export function parseStatement(text: string): { template: StatementTemplate; transactions: RawTransaction[] } {
  const template = pickTemplate(text);
  return { template, transactions: template.parse(text) };
}

export type { StatementTemplate, RawTransaction };
