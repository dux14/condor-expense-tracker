import type { Expense, Category, Settings } from '@/lib/domain/types';
import { SCHEMA_VERSION } from '@/lib/domain/types';
import { DEFAULT_SETTINGS } from '@/lib/data/local-storage-repository';

export interface PersistedBundle {
  schemaVersion: number;
  expenses: Expense[];
  categories: Category[];
  settings: Settings;
}

export function migrate(bundle: PersistedBundle): PersistedBundle {
  if (bundle.schemaVersion === SCHEMA_VERSION) {
    return bundle;
  }

  // Older / unknown version — normalize to current shape.
  // SCHEMA_VERSION is 1, so no field-level transforms yet; just ensure all keys exist.
  return {
    schemaVersion: SCHEMA_VERSION,
    expenses: bundle.expenses ?? [],
    categories: bundle.categories ?? [],
    settings: { ...DEFAULT_SETTINGS, ...bundle.settings, schemaVersion: SCHEMA_VERSION },
  };
}
