import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCondorStore } from '@/lib/store/store';
import type { Repository } from '@/lib/data/repository';
import type { FxProvider } from '@/lib/fx/fx-provider';
import type { Expense, Category, Settings, ExportBundle } from '@/lib/domain/types';
import { SCHEMA_VERSION } from '@/lib/domain/types';
import { DEFAULT_SETTINGS } from '@/lib/data/local-storage-repository';
import { PRESET_CATEGORIES, OTROS_ID } from '@/lib/domain/presets';
import { roundToMinorUnits } from '@/lib/format/money';

// ---------- Fake Repository --------------------------------------------------

function makeFakeRepo(initial?: {
  expenses?: Expense[];
  categories?: Category[];
  settings?: Settings;
}): Repository {
  let expenses: Expense[] = initial?.expenses ? [...initial.expenses] : [];
  let categories: Category[] = initial?.categories ? [...initial.categories] : [...PRESET_CATEGORIES];
  let settings: Settings = initial?.settings ? { ...initial.settings } : { ...DEFAULT_SETTINGS };

  return {
    listExpenses: vi.fn(async () => [...expenses]),
    upsertExpense: vi.fn(async (e: Expense) => {
      const idx = expenses.findIndex(x => x.id === e.id);
      if (idx >= 0) expenses[idx] = e; else expenses.push(e);
      return e;
    }),
    deleteExpense: vi.fn(async (id: string) => {
      expenses = expenses.filter(x => x.id !== id);
    }),
    listCategories: vi.fn(async () => [...categories]),
    upsertCategory: vi.fn(async (c: Category) => {
      const idx = categories.findIndex(x => x.id === c.id);
      if (idx >= 0) categories[idx] = c; else categories.push(c);
      return c;
    }),
    deleteCategory: vi.fn(async (id: string, reassignTo?: string) => {
      const cat = categories.find(x => x.id === id);
      if (cat?.isPreset) throw new Error(`Cannot delete preset category "${id}"`);
      if (reassignTo !== undefined) {
        expenses = expenses.map(e => e.categoryId === id ? { ...e, categoryId: reassignTo } : e);
      }
      categories = categories.filter(x => x.id !== id);
    }),
    getSettings: vi.fn(async () => ({ ...settings })),
    putSettings: vi.fn(async (s: Settings) => { settings = { ...s }; return s; }),
    exportAll: vi.fn(async (): Promise<ExportBundle> => ({
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      expenses: [...expenses],
      categories: [...categories],
      settings: { ...settings },
    })),
    wipeAll: vi.fn(async () => {
      expenses = [];
      categories = [...PRESET_CATEGORIES];
      settings = { ...DEFAULT_SETTINGS };
    }),
  };
}

// ---------- Fake FxProvider --------------------------------------------------

function makeFakeFx(rate: number | null): FxProvider {
  return { getRate: vi.fn(async () => rate) };
}

// ---------- Tests ------------------------------------------------------------

describe('store — addExpense', () => {
  beforeEach(() => { localStorage.clear(); });

  it('base currency: fxRate=1, baseAmount===amount, fx.getRate NOT called', async () => {
    const repo = makeFakeRepo();
    const fx = makeFakeFx(1);
    const store = createCondorStore(repo, fx);
    await store.getState().hydrate();

    await store.getState().addExpense({
      amount: 10000,
      currency: 'COP',
      date: '2026-01-15',
      categoryId: OTROS_ID,
    });

    const { expenses } = store.getState();
    expect(expenses).toHaveLength(1);
    const exp = expenses[0];
    expect(exp.fxRate).toBe(1);
    expect(exp.baseAmount).toBe(10000);
    expect(fx.getRate).not.toHaveBeenCalled();
    expect(repo.upsertExpense).toHaveBeenCalledWith(exp);
  });

  it('non-base currency: fxRate and baseAmount computed from fx', async () => {
    const repo = makeFakeRepo();
    const fx = makeFakeFx(4000);
    const store = createCondorStore(repo, fx);
    await store.getState().hydrate();

    await store.getState().addExpense({
      amount: 10,
      currency: 'USD',
      date: '2026-01-15',
      categoryId: OTROS_ID,
    });

    const exp = store.getState().expenses[0];
    expect(exp.fxRate).toBe(4000);
    expect(exp.baseAmount).toBe(roundToMinorUnits(10 * 4000, 'COP'));
    expect(fx.getRate).toHaveBeenCalledWith('USD', 'COP', '2026-01-15');
    expect(repo.upsertExpense).toHaveBeenCalled();
  });

  it('offline (fx returns null): baseAmount=null, fxRate=null', async () => {
    const repo = makeFakeRepo();
    const fx = makeFakeFx(null);
    const store = createCondorStore(repo, fx);
    await store.getState().hydrate();

    await store.getState().addExpense({
      amount: 5,
      currency: 'USD',
      date: '2026-01-15',
      categoryId: OTROS_ID,
    });

    const exp = store.getState().expenses[0];
    expect(exp.fxRate).toBeNull();
    expect(exp.baseAmount).toBeNull();
  });
});

describe('store — updateExpense', () => {
  beforeEach(() => { localStorage.clear(); });

  it('updating only note does NOT call fx.getRate; baseAmount unchanged', async () => {
    const repo = makeFakeRepo();
    const fx = makeFakeFx(4000);
    const store = createCondorStore(repo, fx);
    await store.getState().hydrate();

    await store.getState().addExpense({
      amount: 10,
      currency: 'USD',
      date: '2026-01-15',
      categoryId: OTROS_ID,
    });
    vi.clearAllMocks(); // clear call count after add

    const id = store.getState().expenses[0].id;
    const originalBase = store.getState().expenses[0].baseAmount;

    await store.getState().updateExpense(id, { note: 'lunch' });

    expect(fx.getRate).not.toHaveBeenCalled();
    expect(store.getState().expenses[0].note).toBe('lunch');
    expect(store.getState().expenses[0].baseAmount).toBe(originalBase);
  });

  it('updating currency calls fx.getRate and recomputes baseAmount', async () => {
    const repo = makeFakeRepo();
    const fx = makeFakeFx(4000);
    const store = createCondorStore(repo, fx);
    await store.getState().hydrate();

    // Add expense in COP (same as base)
    await store.getState().addExpense({
      amount: 10000,
      currency: 'COP',
      date: '2026-01-15',
      categoryId: OTROS_ID,
    });
    vi.clearAllMocks();

    const id = store.getState().expenses[0].id;
    // Change to USD — fx should be called
    await store.getState().updateExpense(id, { currency: 'USD' });

    expect(fx.getRate).toHaveBeenCalledWith('USD', 'COP', '2026-01-15');
    const updated = store.getState().expenses[0];
    expect(updated.fxRate).toBe(4000);
    expect(updated.baseAmount).toBe(roundToMinorUnits(10000 * 4000, 'COP'));
  });
});

describe('store — deleteExpense', () => {
  beforeEach(() => { localStorage.clear(); });

  it('removes from state and calls repo.deleteExpense', async () => {
    const repo = makeFakeRepo();
    const fx = makeFakeFx(1);
    const store = createCondorStore(repo, fx);
    await store.getState().hydrate();

    await store.getState().addExpense({
      amount: 500,
      currency: 'COP',
      date: '2026-01-15',
      categoryId: OTROS_ID,
    });

    const id = store.getState().expenses[0].id;
    await store.getState().deleteExpense(id);

    expect(store.getState().expenses).toHaveLength(0);
    expect(repo.deleteExpense).toHaveBeenCalledWith(id);
  });
});

describe('store — categories', () => {
  beforeEach(() => { localStorage.clear(); });

  it('addCategory adds a custom category to state and repo', async () => {
    const repo = makeFakeRepo();
    const fx = makeFakeFx(1);
    const store = createCondorStore(repo, fx);
    await store.getState().hydrate();

    await store.getState().addCategory({ name: 'Gym', color: '#ff0000', icon: 'salud' });

    const cats = store.getState().categories;
    const gym = cats.find(c => c.name === 'Gym');
    expect(gym).toBeDefined();
    expect(gym?.isPreset).toBe(false);
    expect(repo.upsertCategory).toHaveBeenCalledWith(expect.objectContaining({ name: 'Gym' }));
  });

  it('deleteCategory(customId, OTROS_ID) reassigns expenses and removes category', async () => {
    const repo = makeFakeRepo();
    const fx = makeFakeFx(1);
    const store = createCondorStore(repo, fx);
    await store.getState().hydrate();

    // Add a custom category
    await store.getState().addCategory({ name: 'Custom', color: '#abc', icon: 'otros' });
    const customCat = store.getState().categories.find(c => c.name === 'Custom')!;
    expect(customCat).toBeDefined();

    // Add an expense under that custom category
    await store.getState().addExpense({
      amount: 1000,
      currency: 'COP',
      date: '2026-01-15',
      categoryId: customCat.id,
    });

    const expId = store.getState().expenses[0].id;

    // Delete the category, reassigning to OTROS_ID
    await store.getState().deleteCategory(customCat.id, OTROS_ID);

    // Category removed from state
    expect(store.getState().categories.find(c => c.id === customCat.id)).toBeUndefined();

    // Expense reassigned in state
    const exp = store.getState().expenses.find(e => e.id === expId);
    expect(exp?.categoryId).toBe(OTROS_ID);
  });

  it('deleteCategory on preset category throws', async () => {
    const repo = makeFakeRepo();
    const fx = makeFakeFx(1);
    const store = createCondorStore(repo, fx);
    await store.getState().hydrate();

    await expect(store.getState().deleteCategory('preset-comida')).rejects.toThrow();
  });
});

describe('store — setSettings', () => {
  beforeEach(() => { localStorage.clear(); });

  it('changing baseCurrency triggers recomputeAllBaseAmounts', async () => {
    const repo = makeFakeRepo();
    const fx = makeFakeFx(4000);
    const store = createCondorStore(repo, fx);
    await store.getState().hydrate();

    // Add a COP expense (base is COP)
    await store.getState().addExpense({
      amount: 10000,
      currency: 'COP',
      date: '2026-01-15',
      categoryId: OTROS_ID,
    });

    vi.clearAllMocks();

    // Change base currency to USD — COP expense now needs fx conversion
    await store.getState().setSettings({ baseCurrency: 'USD' });

    expect(store.getState().settings.baseCurrency).toBe('USD');
    // fx.getRate should be called for the COP→USD conversion
    expect(fx.getRate).toHaveBeenCalledWith('COP', 'USD', '2026-01-15');

    const exp = store.getState().expenses[0];
    expect(exp.baseAmount).toBe(roundToMinorUnits(10000 * 4000, 'USD'));
    expect(exp.fxRate).toBe(4000);
  });
});

describe('store — hydrate', () => {
  beforeEach(() => { localStorage.clear(); });

  it('loads pre-seeded repo data into state and sets hydrated=true', async () => {
    const expense: Expense = {
      id: 'e1',
      amount: 5000,
      currency: 'COP',
      baseAmount: 5000,
      fxRate: 1,
      date: '2026-01-10',
      categoryId: OTROS_ID,
      source: 'manual',
      createdAt: '2026-01-10T00:00:00.000Z',
      updatedAt: '2026-01-10T00:00:00.000Z',
    };
    const repo = makeFakeRepo({ expenses: [expense] });
    const fx = makeFakeFx(1);
    const store = createCondorStore(repo, fx);

    expect(store.getState().hydrated).toBe(false);

    await store.getState().hydrate();

    const state = store.getState();
    expect(state.hydrated).toBe(true);
    expect(state.expenses).toHaveLength(1);
    expect(state.expenses[0].id).toBe('e1');
    expect(state.categories.length).toBeGreaterThan(0);
    expect(state.settings).toMatchObject({ baseCurrency: 'COP' });
  });
});

describe('store — wipeAll', () => {
  beforeEach(() => { localStorage.clear(); });

  it('empties expenses, re-seeds categories from repo, sets hydrated=true', async () => {
    const repo = makeFakeRepo();
    const fx = makeFakeFx(1);
    const store = createCondorStore(repo, fx);
    await store.getState().hydrate();

    await store.getState().addExpense({
      amount: 1000,
      currency: 'COP',
      date: '2026-01-15',
      categoryId: OTROS_ID,
    });

    expect(store.getState().expenses).toHaveLength(1);

    await store.getState().wipeAll();

    expect(store.getState().expenses).toHaveLength(0);
    expect(store.getState().hydrated).toBe(true);
    // Categories should be re-seeded (presets)
    expect(store.getState().categories.length).toBeGreaterThan(0);
    expect(repo.wipeAll).toHaveBeenCalled();
  });
});
