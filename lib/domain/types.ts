export const SCHEMA_VERSION = 1;

export type Currency = string; // ISO 4217, e.g. "COP", "USD", "EUR"
export type DashboardView = 'bars' | 'donut' | 'treemap';
export type ThemePref = 'dark' | 'light' | 'auto';
export type Locale = 'es' | 'en';

export interface Expense {
  id: string;               // crypto.randomUUID()
  amount: number;           // in `currency`, > 0
  currency: Currency;
  baseAmount: number | null; // derived: amount * fxRate; null if FX unavailable
  fxRate: number | null;    // rate currency→baseCurrency on `date`; 1 if equal; null if unknown
  date: string;             // 'yyyy-MM-dd' (local calendar day)
  time?: string;            // 'HH:mm' local time of the expense (optional, additive)
  categoryId: string;
  merchant?: string;
  note?: string;
  source: 'manual';         // Phase 2 adds 'import'
  createdAt: string;        // ISO timestamp
  updatedAt: string;        // ISO timestamp
}

export interface Category {
  id: string;
  name: string;
  color: string;            // hex
  icon: string;             // icon key from curated set
  isPreset: boolean;
  hidden?: boolean;         // presets can be hidden, not deleted
}

export interface Settings {
  baseCurrency: Currency;   // default 'COP'
  locale: Locale;           // default 'es'
  theme: ThemePref;         // default 'auto'
  dashboardView: DashboardView; // default 'bars'
  schemaVersion: number;
}

export interface ExportBundle {
  schemaVersion: number;
  exportedAt: string;
  expenses: Expense[];
  categories: Category[];
  settings: Settings;
}
