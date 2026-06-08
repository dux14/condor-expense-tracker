import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LocalStorageRepository } from '@/lib/data/local-storage-repository';
import { hasLocalDataToImport, importLocalToCloud } from '@/lib/data/import-local';
import type { Repository } from '@/lib/data/repository';
import type { Expense, Category, Settings, ExportBundle, CategoryRule } from '@/lib/domain/types';
import { SCHEMA_VERSION } from '@/lib/domain/types';

// ---- Helpers ---------------------------------------------------------------

function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 'exp-1',
    amount: 10000,
    currency: 'COP',
    baseAmount: 10000,
    fxRate: 1,
    date: '2026-01-01',
    categoryId: 'preset-comida',
    source: 'manual',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    baseCurrency: 'USD',
    locale: 'en',
    theme: 'dark',
    dashboardView: 'donut',
    schemaVersion: SCHEMA_VERSION,
    ...overrides,
  };
}

// ---- In-memory fake cloud Repository ---------------------------------------

class FakeCloudRepository implements Repository {
  private expenses: Expense[] = [];
  private categories: Category[] = [];
  private rules: CategoryRule[] = [];
  private settings: Settings = {
    baseCurrency: 'COP',
    locale: 'es',
    theme: 'auto',
    dashboardView: 'bars',
    schemaVersion: SCHEMA_VERSION,
  };

  upsertExpense = vi.fn(async (e: Expense): Promise<Expense> => {
    const idx = this.expenses.findIndex((x) => x.id === e.id);
    if (idx >= 0) this.expenses[idx] = e;
    else this.expenses.push(e);
    return e;
  });

  upsertCategory = vi.fn(async (c: Category): Promise<Category> => {
    const idx = this.categories.findIndex((x) => x.id === c.id);
    if (idx >= 0) this.categories[idx] = c;
    else this.categories.push(c);
    return c;
  });

  putSettings = vi.fn(async (s: Settings): Promise<Settings> => {
    this.settings = s;
    return s;
  });

  listCategories = vi.fn(async (): Promise<Category[]> => []);

  async listExpenses(): Promise<Expense[]> { return [...this.expenses]; }
  async deleteExpense(_id: string): Promise<void> {}
  async deleteCategory(_id: string, _reassignTo?: string): Promise<void> {}
  async listCategoryRules(): Promise<CategoryRule[]> { return [...this.rules]; }
  async upsertCategoryRule(r: CategoryRule): Promise<CategoryRule> {
    const i = this.rules.findIndex(x => x.id === r.id);
    if (i >= 0) this.rules[i] = r; else this.rules.push(r);
    return r;
  }
  async getSettings(): Promise<Settings> { return { ...this.settings }; }

  async exportAll(): Promise<ExportBundle> {
    return {
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      expenses: [...this.expenses],
      categories: [...this.categories],
      settings: { ...this.settings },
    };
  }

  async wipeAll(): Promise<void> {
    this.expenses = [];
    this.categories = [];
  }
}

// ---- Tests -----------------------------------------------------------------

describe('hasLocalDataToImport', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns false on empty storage', () => {
    expect(hasLocalDataToImport()).toBe(false);
  });

  it('returns true when condor:expenses exists and condor:imported is absent', () => {
    localStorage.setItem('condor:expenses', JSON.stringify([]));
    expect(hasLocalDataToImport()).toBe(true);
  });

  it('returns true when condor:categories exists and condor:imported is absent', () => {
    localStorage.setItem('condor:categories', JSON.stringify([]));
    expect(hasLocalDataToImport()).toBe(true);
  });

  it('returns true when condor:settings exists and condor:imported is absent', () => {
    localStorage.setItem('condor:settings', JSON.stringify({}));
    expect(hasLocalDataToImport()).toBe(true);
  });

  it('returns false once condor:imported is set (even with local data present)', () => {
    localStorage.setItem('condor:expenses', JSON.stringify([]));
    localStorage.setItem('condor:imported', new Date().toISOString());
    expect(hasLocalDataToImport()).toBe(false);
  });
});

describe('importLocalToCloud', () => {
  let localRepo: LocalStorageRepository;
  let cloudRepo: FakeCloudRepository;

  beforeEach(async () => {
    localStorage.clear();
    localRepo = new LocalStorageRepository();
    cloudRepo = new FakeCloudRepository();

    // Seed 2 expenses
    await localRepo.upsertExpense(makeExpense({ id: 'exp-1' }));
    await localRepo.upsertExpense(makeExpense({ id: 'exp-2', amount: 20000 }));

    // Seed 1 custom category (upsertCategory triggers listCategories which seeds presets first,
    // so stored list will contain presets + the custom; import must filter !isPreset)
    await localRepo.upsertCategory({
      id: 'cat-custom-1',
      name: 'Custom',
      color: '#ffffff',
      icon: 'comida',
      isPreset: false,
    });

    // Seed custom settings
    await localRepo.putSettings(makeSettings());
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('imports expenses, custom categories, and settings; marks condor:imported', async () => {
    const result = await importLocalToCloud(localRepo, cloudRepo);

    expect(result.imported).toBe(true);
    expect(result.expenses).toBe(2);
    expect(result.categories).toBe(1); // only the custom one

    // cloud received upsertExpense ×2
    expect(cloudRepo.upsertExpense).toHaveBeenCalledTimes(2);

    // cloud presets are seeded (listCategories) once, BEFORE any custom upload
    expect(cloudRepo.listCategories).toHaveBeenCalledTimes(1);
    expect(cloudRepo.listCategories.mock.invocationCallOrder[0]).toBeLessThan(
      cloudRepo.upsertCategory.mock.invocationCallOrder[0],
    );

    // cloud received upsertCategory ×1 (presets filtered out)
    expect(cloudRepo.upsertCategory).toHaveBeenCalledTimes(1);
    expect(cloudRepo.upsertCategory).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'cat-custom-1', isPreset: false }),
    );

    // cloud received putSettings ×1
    expect(cloudRepo.putSettings).toHaveBeenCalledTimes(1);

    // localStorage condor:imported is set
    expect(localStorage.getItem('condor:imported')).not.toBeNull();
  });

  it('is idempotent: second call is a no-op (no additional cloud writes)', async () => {
    // First call
    const first = await importLocalToCloud(localRepo, cloudRepo);
    expect(first.imported).toBe(true);

    const expenseCallsAfterFirst = cloudRepo.upsertExpense.mock.calls.length;
    const categoryCallsAfterFirst = cloudRepo.upsertCategory.mock.calls.length;
    const settingsCallsAfterFirst = cloudRepo.putSettings.mock.calls.length;

    // Second call
    const second = await importLocalToCloud(localRepo, cloudRepo);
    expect(second.imported).toBe(false);
    expect(second.expenses).toBe(0);
    expect(second.categories).toBe(0);

    // No new cloud calls
    expect(cloudRepo.upsertExpense).toHaveBeenCalledTimes(expenseCallsAfterFirst);
    expect(cloudRepo.upsertCategory).toHaveBeenCalledTimes(categoryCallsAfterFirst);
    expect(cloudRepo.putSettings).toHaveBeenCalledTimes(settingsCallsAfterFirst);
  });
});
