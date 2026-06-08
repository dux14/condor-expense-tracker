import type { RawTransaction, StatementTemplate } from './types';

// Matches a leading date in either yyyy-mm-dd or dd/mm/yyyy form.
const DATE_ISO = /^(\d{4})-(\d{2})-(\d{2})/;
const DATE_DMY = /^(\d{2})\/(\d{2})\/(\d{4})/;
// Trailing money token: Colombian/European grouping (1.234,56) or plain (1234.56),
// optional leading minus.
const MONEY = /(-?\d{1,3}(?:[.\s]\d{3})*(?:,\d{2})?|-?\d+(?:\.\d{2})?)\s*$/;

function toIso(line: string): string | null {
  let m = DATE_ISO.exec(line);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = DATE_DMY.exec(line);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

/** Parse a Colombian/European-grouped amount string to a Number. */
export function parseAmount(token: string): number {
  let s = token.trim();
  const neg = s.startsWith('-');
  s = s.replace(/[^\d.,]/g, '');
  if (s.includes(',')) {
    // comma = decimal separator → drop thousand dots/spaces, comma → dot
    s = s.replace(/[.\s]/g, '').replace(',', '.');
  } else {
    // no comma → dots are thousands unless they look like 2-decimal (handled by regex)
    const parts = s.split('.');
    if (parts.length > 1 && parts[parts.length - 1].length === 3) s = s.replace(/\./g, '');
  }
  const n = Number(s);
  return neg ? -n : n;
}

function parseLine(line: string): RawTransaction | null {
  const date = toIso(line);
  if (!date) return null;
  const money = MONEY.exec(line);
  if (!money) return null;
  const amount = parseAmount(money[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null; // expenses only, skip credits
  // description = everything between the date token and the money token
  const afterDate = line.replace(DATE_ISO, '').replace(DATE_DMY, '');
  const description = afterDate.slice(0, afterDate.lastIndexOf(money[1])).trim() || afterDate.trim();
  if (!description) return null;
  return { date, description, amount, currency: 'COP' };
}

export const genericTemplate: StatementTemplate = {
  id: 'generic',
  institution: 'Genérico',
  detect: () => true,            // always the last-resort fallback
  parse(text: string): RawTransaction[] {
    return text
      .split(/\r?\n/)
      .map(parseLine)
      .filter((t): t is RawTransaction => t !== null);
  },
};
