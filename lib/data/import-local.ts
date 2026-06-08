import type { Repository } from './repository';
import { LocalStorageRepository } from './local-storage-repository';

const IMPORTED_KEY = 'condor:imported';
const LOCAL_KEYS = ['condor:expenses', 'condor:categories', 'condor:settings'] as const;

/** True when there is un-imported local data worth offering to migrate. */
export function hasLocalDataToImport(): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  if (localStorage.getItem(IMPORTED_KEY) !== null) return false;
  return LOCAL_KEYS.some((k) => localStorage.getItem(k) !== null);
}

/**
 * One-time, idempotent migration of local data into the cloud repo.
 * Guarded by condor:imported. Presets are NOT re-uploaded (the cloud seeds its
 * own on first listCategories); only user-created categories are migrated.
 */
export async function importLocalToCloud(
  local: Repository,
  cloud: Repository,
): Promise<{ imported: boolean; expenses: number; categories: number }> {
  if (!hasLocalDataToImport()) return { imported: false, expenses: 0, categories: 0 };

  const bundle = await local.exportAll();

  // Ensure cloud presets exist before referencing them / uploading customs.
  await cloud.listCategories();

  const customCats = bundle.categories.filter((c) => !c.isPreset);
  for (const c of customCats) await cloud.upsertCategory(c);
  for (const e of bundle.expenses) await cloud.upsertExpense(e);
  await cloud.putSettings(bundle.settings);

  localStorage.setItem(IMPORTED_KEY, new Date().toISOString());
  return { imported: true, expenses: bundle.expenses.length, categories: customCats.length };
}

/** Convenience: build a local repo + run the import against a given cloud repo. */
export async function runFirstSignInImport(cloud: Repository) {
  return importLocalToCloud(new LocalStorageRepository(), cloud);
}
