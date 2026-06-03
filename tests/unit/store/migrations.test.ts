import { describe, it, expect } from 'vitest';
import { migrate } from '@/lib/store/migrations';
import { SCHEMA_VERSION } from '@/lib/domain/types';
import { DEFAULT_SETTINGS } from '@/lib/data/local-storage-repository';
import type { Settings, Expense, Category } from '@/lib/domain/types';

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return { ...DEFAULT_SETTINGS, ...overrides };
}

describe('migrate', () => {
  it('returns bundle as-is when schemaVersion === SCHEMA_VERSION', () => {
    const bundle = {
      schemaVersion: SCHEMA_VERSION,
      expenses: [],
      categories: [],
      settings: makeSettings(),
    };
    const result = migrate(bundle);
    expect(result).toBe(bundle); // identity — same reference
  });

  it('upgrades a bundle with schemaVersion 0 to SCHEMA_VERSION', () => {
    const bundle = {
      schemaVersion: 0,
      expenses: [] as Expense[],
      categories: [] as Category[],
      settings: { baseCurrency: 'USD' } as unknown as Settings,
    };
    const result = migrate(bundle);
    expect(result.schemaVersion).toBe(SCHEMA_VERSION);
    expect(result.settings.baseCurrency).toBe('USD'); // preserved from bundle
    expect(result.settings.locale).toBe(DEFAULT_SETTINGS.locale); // filled from defaults
    expect(result.settings.theme).toBe(DEFAULT_SETTINGS.theme);
    expect(result.settings.dashboardView).toBe(DEFAULT_SETTINGS.dashboardView);
  });

  it('missing expenses/categories default to empty arrays', () => {
    const bundle = {
      schemaVersion: 0,
      expenses: undefined as unknown as Expense[],
      categories: undefined as unknown as Category[],
      settings: makeSettings({ schemaVersion: 0 }),
    };
    const result = migrate(bundle);
    expect(result.expenses).toEqual([]);
    expect(result.categories).toEqual([]);
  });
});
