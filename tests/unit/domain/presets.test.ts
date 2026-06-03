import { PRESET_CATEGORIES, OTROS_ID } from '@/lib/domain/presets';
import { ICON_KEYS } from '@/lib/domain/icons';

const EXPECTED_KEYS = [
  'comida',
  'transporte',
  'ocio',
  'entretenimiento',
  'turismo',
  'videojuegos',
  'mercado',
  'salud',
  'servicios',
  'otros',
] as const;

describe('PRESET_CATEGORIES', () => {
  it('has exactly 10 presets in the correct order', () => {
    expect(PRESET_CATEGORIES).toHaveLength(10);
    EXPECTED_KEYS.forEach((key, index) => {
      expect(PRESET_CATEGORIES[index].id).toBe(`preset-${key}`);
    });
  });

  it('every entry has isPreset === true', () => {
    PRESET_CATEGORIES.forEach((cat) => {
      expect(cat.isPreset).toBe(true);
    });
  });

  it('every entry has a non-empty hex color', () => {
    PRESET_CATEGORIES.forEach((cat) => {
      expect(cat.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });
  });

  it('every entry has an icon key that exists in ICON_KEYS', () => {
    PRESET_CATEGORIES.forEach((cat) => {
      expect(ICON_KEYS).toContain(cat.icon);
    });
  });

  it('ids are unique and stable', () => {
    const ids = PRESET_CATEGORIES.map((cat) => cat.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(10);
    // stable: re-importing should give same ids
    expect(ids).toEqual(EXPECTED_KEYS.map((k) => `preset-${k}`));
  });

  it('otros preset exists with id === OTROS_ID', () => {
    const otros = PRESET_CATEGORIES.find((cat) => cat.id === OTROS_ID);
    expect(otros).toBeDefined();
    expect(OTROS_ID).toBe('preset-otros');
  });
});
