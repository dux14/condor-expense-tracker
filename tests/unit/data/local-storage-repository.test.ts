import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStorageRepository, DEFAULT_SETTINGS } from '@/lib/data/local-storage-repository';
import { PRESET_CATEGORIES } from '@/lib/domain/presets';
import { SCHEMA_VERSION } from '@/lib/domain/types';
import type { Expense, Category, CategoryRule, Budget } from '@/lib/domain/types';

// Helper to create a minimal valid Expense
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

// Helper to create a minimal valid CategoryRule
function makeRule(overrides: Partial<CategoryRule> = {}): CategoryRule {
  return {
    id: 'r1',
    pattern: 'UBER',
    categoryId: 'preset-transporte',
    ...overrides,
  };
}

// Helper to create a minimal valid Category (custom)
function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: 'cat-custom-1',
    name: 'Custom',
    color: '#ff0000',
    icon: 'comida',
    isPreset: false,
    ...overrides,
  };
}

describe('DEFAULT_SETTINGS', () => {
  it('has the correct shape and defaults', () => {
    expect(DEFAULT_SETTINGS).toMatchObject({
      baseCurrency: 'COP',
      locale: 'es',
      theme: 'auto',
      dashboardView: 'bars',
      schemaVersion: SCHEMA_VERSION,
    });
  });
});

describe('LocalStorageRepository', () => {
  let repo: LocalStorageRepository;

  beforeEach(() => {
    localStorage.clear();
    repo = new LocalStorageRepository();
  });

  // ---- Expenses ----

  describe('expenses', () => {
    it('listExpenses returns [] on fresh storage', async () => {
      const result = await repo.listExpenses();
      expect(result).toEqual([]);
    });

    it('upsertExpense persists and returns the expense', async () => {
      const e = makeExpense();
      const returned = await repo.upsertExpense(e);
      expect(returned).toEqual(e);
      const list = await repo.listExpenses();
      expect(list).toHaveLength(1);
      expect(list[0]).toEqual(e);
    });

    it('upsertExpense with same id updates in place (not duplicate)', async () => {
      const e = makeExpense({ amount: 5000 });
      await repo.upsertExpense(e);
      const updated = { ...e, amount: 9999 };
      await repo.upsertExpense(updated);
      const list = await repo.listExpenses();
      expect(list).toHaveLength(1);
      expect(list[0].amount).toBe(9999);
    });

    it('upsertExpense appends a new expense', async () => {
      await repo.upsertExpense(makeExpense({ id: 'a' }));
      await repo.upsertExpense(makeExpense({ id: 'b' }));
      const list = await repo.listExpenses();
      expect(list).toHaveLength(2);
    });

    it('deleteExpense removes the expense', async () => {
      await repo.upsertExpense(makeExpense({ id: 'to-del' }));
      await repo.upsertExpense(makeExpense({ id: 'keep' }));
      await repo.deleteExpense('to-del');
      const list = await repo.listExpenses();
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe('keep');
    });

    it('deleteExpense on non-existent id is a no-op', async () => {
      await repo.upsertExpense(makeExpense({ id: 'keep' }));
      await repo.deleteExpense('ghost');
      expect(await repo.listExpenses()).toHaveLength(1);
    });

    it('corrupted JSON in condor:expenses → listExpenses returns []', async () => {
      localStorage.setItem('condor:expenses', '{ BROKEN JSON !!!');
      const result = await repo.listExpenses();
      expect(result).toEqual([]);
    });
  });

  // ---- Categories ----

  describe('categories', () => {
    it('listCategories on fresh storage seeds with PRESET_CATEGORIES', async () => {
      const result = await repo.listCategories();
      expect(result).toEqual(PRESET_CATEGORIES);
    });

    it('listCategories: second call returns same without re-seeding', async () => {
      await repo.listCategories();
      // Mutate the stored value to verify it is NOT overwritten on second call
      const stored = JSON.parse(localStorage.getItem('condor:categories')!);
      stored[0].name = 'MODIFIED';
      localStorage.setItem('condor:categories', JSON.stringify(stored));
      const second = await repo.listCategories();
      // Should return the stored (mutated) value, not re-seeded presets
      expect(second[0].name).toBe('MODIFIED');
    });

    it('an explicitly-set empty array is returned as empty (no re-seed)', async () => {
      localStorage.setItem('condor:categories', JSON.stringify([]));
      const result = await repo.listCategories();
      expect(result).toEqual([]);
    });

    it('upsertCategory adds a new custom category', async () => {
      const c = makeCategory();
      const returned = await repo.upsertCategory(c);
      expect(returned).toEqual(c);
      const list = await repo.listCategories();
      expect(list.find(x => x.id === c.id)).toEqual(c);
    });

    it('upsertCategory with same id updates in place', async () => {
      const c = makeCategory({ id: 'cat-1', name: 'Old' });
      await repo.upsertCategory(c);
      const updated = { ...c, name: 'New' };
      await repo.upsertCategory(updated);
      const list = await repo.listCategories();
      const found = list.filter(x => x.id === 'cat-1');
      expect(found).toHaveLength(1);
      expect(found[0].name).toBe('New');
    });

    it('deleteCategory(customId, reassignTo) reassigns expenses then removes category', async () => {
      // Seed a custom category
      const custom = makeCategory({ id: 'cat-custom', isPreset: false });
      // Seed some expenses under that category
      const e1 = makeExpense({ id: 'e1', categoryId: 'cat-custom' });
      const e2 = makeExpense({ id: 'e2', categoryId: 'cat-custom' });
      const e3 = makeExpense({ id: 'e3', categoryId: 'preset-comida' }); // unrelated
      await repo.upsertCategory(custom);
      await repo.upsertExpense(e1);
      await repo.upsertExpense(e2);
      await repo.upsertExpense(e3);

      await repo.deleteCategory('cat-custom', 'preset-otros');

      // Category is removed
      const cats = await repo.listCategories();
      expect(cats.find(x => x.id === 'cat-custom')).toBeUndefined();

      // Expenses are reassigned
      const expenses = await repo.listExpenses();
      expect(expenses.find(x => x.id === 'e1')!.categoryId).toBe('preset-otros');
      expect(expenses.find(x => x.id === 'e2')!.categoryId).toBe('preset-otros');
      expect(expenses.find(x => x.id === 'e3')!.categoryId).toBe('preset-comida'); // unchanged
    });

    it('deleteCategory on a preset THROWS', async () => {
      // Seed so presets exist
      await repo.listCategories();
      await expect(repo.deleteCategory('preset-comida')).rejects.toThrow();
    });

    it('deleteCategory without reassignTo removes category without reassigning', async () => {
      const custom = makeCategory({ id: 'cat-no-reassign', isPreset: false });
      const e = makeExpense({ id: 'e-nr', categoryId: 'cat-no-reassign' });
      await repo.upsertCategory(custom);
      await repo.upsertExpense(e);

      await repo.deleteCategory('cat-no-reassign');

      const cats = await repo.listCategories();
      expect(cats.find(x => x.id === 'cat-no-reassign')).toBeUndefined();
      // Expense still exists with old categoryId (not reassigned)
      const expenses = await repo.listExpenses();
      expect(expenses.find(x => x.id === 'e-nr')!.categoryId).toBe('cat-no-reassign');
    });
  });

  // ---- Settings ----

  describe('settings', () => {
    it('getSettings returns DEFAULT_SETTINGS on fresh storage', async () => {
      const s = await repo.getSettings();
      expect(s).toEqual(DEFAULT_SETTINGS);
    });

    it('putSettings then getSettings round-trips', async () => {
      const newSettings = { ...DEFAULT_SETTINGS, baseCurrency: 'USD', locale: 'en' as const };
      const returned = await repo.putSettings(newSettings);
      expect(returned).toEqual(newSettings);
      const loaded = await repo.getSettings();
      expect(loaded).toEqual(newSettings);
    });

    it('partial stored settings merge over defaults', async () => {
      // Only store a subset of settings
      localStorage.setItem('condor:settings', JSON.stringify({ baseCurrency: 'EUR' }));
      const s = await repo.getSettings();
      expect(s.baseCurrency).toBe('EUR');
      expect(s.locale).toBe(DEFAULT_SETTINGS.locale);
      expect(s.theme).toBe(DEFAULT_SETTINGS.theme);
      expect(s.dashboardView).toBe(DEFAULT_SETTINGS.dashboardView);
      expect(s.schemaVersion).toBe(DEFAULT_SETTINGS.schemaVersion);
    });
  });

  // ---- exportAll ----

  describe('exportAll', () => {
    it('returns a well-formed ExportBundle', async () => {
      const e = makeExpense();
      await repo.upsertExpense(e);
      const bundle = await repo.exportAll();

      expect(bundle.schemaVersion).toBe(SCHEMA_VERSION);
      expect(typeof bundle.exportedAt).toBe('string');
      // Should parse as a valid ISO date
      expect(new Date(bundle.exportedAt).toISOString()).toBe(bundle.exportedAt);
      expect(bundle.expenses).toHaveLength(1);
      expect(bundle.expenses[0]).toEqual(e);
      expect(bundle.categories).toEqual(PRESET_CATEGORIES); // fresh storage → presets
      expect(bundle.settings).toEqual(DEFAULT_SETTINGS);
    });
  });

  // ---- CategoryRules ----

  describe('categoryRules', () => {
    it('listCategoryRules returns [] on empty storage', async () => {
      expect(await repo.listCategoryRules()).toEqual([]);
    });

    it('upsertCategoryRule persists a rule and listCategoryRules returns it', async () => {
      const r = makeRule();
      const returned = await repo.upsertCategoryRule(r);
      expect(returned).toEqual(r);
      expect(await repo.listCategoryRules()).toEqual([r]);
    });

    it('upserting same id replaces (no duplicate)', async () => {
      await repo.upsertCategoryRule(makeRule({ id: 'r1', pattern: 'UBER' }));
      await repo.upsertCategoryRule(makeRule({ id: 'r1', pattern: 'UBER_EATS' }));
      const list = await repo.listCategoryRules();
      expect(list).toHaveLength(1);
      expect(list[0].pattern).toBe('UBER_EATS');
    });

    it('upserting a different id appends', async () => {
      await repo.upsertCategoryRule(makeRule({ id: 'r1' }));
      await repo.upsertCategoryRule(makeRule({ id: 'r2', pattern: 'RAPPI' }));
      expect(await repo.listCategoryRules()).toHaveLength(2);
    });
  });

  // ---- Budgets ----

  function makeBudget(overrides: Partial<Budget> = {}) {
    return {
      id: 'bud-1', categoryId: 'preset-comida', amountBase: 300000, period: 'monthly' as const,
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', ...overrides,
    };
  }

  describe('budgets', () => {
    it('listBudgets returns [] on fresh storage', async () => {
      expect(await repo.listBudgets()).toEqual([]);
    });

    it('upsertBudget persists and returns the budget', async () => {
      const b = makeBudget();
      expect(await repo.upsertBudget(b)).toEqual(b);
      expect(await repo.listBudgets()).toEqual([b]);
    });

    it('upsertBudget with the same id updates in place (no duplicate)', async () => {
      await repo.upsertBudget(makeBudget({ amountBase: 100 }));
      await repo.upsertBudget(makeBudget({ amountBase: 999 }));
      const list = await repo.listBudgets();
      expect(list).toHaveLength(1);
      expect(list[0].amountBase).toBe(999);
    });

    it('deleteBudget removes the budget', async () => {
      await repo.upsertBudget(makeBudget({ id: 'b-del' }));
      await repo.upsertBudget(makeBudget({ id: 'b-keep' }));
      await repo.deleteBudget('b-del');
      expect((await repo.listBudgets()).map((b) => b.id)).toEqual(['b-keep']);
    });

    it('corrupted JSON in condor:budgets → listBudgets returns []', async () => {
      localStorage.setItem('condor:budgets', '{ BROKEN');
      expect(await repo.listBudgets()).toEqual([]);
    });
  });

  // ---- wipeAll ----

  describe('wipeAll', () => {
    it('clears all condor: keys including condor:fxcache, leaves unrelated keys', async () => {
      // Populate condor keys
      await repo.upsertExpense(makeExpense());
      await repo.listCategories(); // seeds categories
      await repo.putSettings({ ...DEFAULT_SETTINGS, baseCurrency: 'USD' });
      localStorage.setItem('condor:fxcache', JSON.stringify({ 'USD-COP': 4000 }));
      // Set an unrelated key
      localStorage.setItem('other:foo', 'bar');

      await repo.wipeAll();

      expect(localStorage.getItem('condor:expenses')).toBeNull();
      expect(localStorage.getItem('condor:categories')).toBeNull();
      expect(localStorage.getItem('condor:settings')).toBeNull();
      expect(localStorage.getItem('condor:fxcache')).toBeNull();
      // Unrelated key must survive
      expect(localStorage.getItem('other:foo')).toBe('bar');
    });

    it('after wipeAll, fresh reads return defaults again', async () => {
      await repo.upsertExpense(makeExpense());
      await repo.wipeAll();
      expect(await repo.listExpenses()).toEqual([]);
      expect(await repo.getSettings()).toEqual(DEFAULT_SETTINGS);
    });

    it('wipeAll clears category rules too', async () => {
      await repo.upsertCategoryRule(makeRule());
      await repo.wipeAll();
      expect(await repo.listCategoryRules()).toEqual([]);
    });
  });
});
