import type { Category } from './types';
import { paletteColorFor } from './palette';
import { ICON_KEYS, isIconKey } from './icons';

export const OTROS_ID = 'preset-otros';

const PRESET_DEFS: Array<{ key: string; name: string }> = [
  { key: 'comida', name: 'Comida' },
  { key: 'transporte', name: 'Transporte' },
  { key: 'ocio', name: 'Ocio' },
  { key: 'entretenimiento', name: 'Entretenimiento' },
  { key: 'turismo', name: 'Turismo' },
  { key: 'videojuegos', name: 'Videojuegos' },
  { key: 'mercado', name: 'Mercado' },
  { key: 'salud', name: 'Salud' },
  { key: 'servicios', name: 'Servicios' },
  { key: 'otros', name: 'Otros' },
];

export const PRESET_CATEGORIES: Category[] = PRESET_DEFS.map((def, index) => ({
  id: `preset-${def.key}`,
  name: def.name,
  color: paletteColorFor(index),
  icon: isIconKey(def.key) ? def.key : ICON_KEYS[0],
  isPreset: true,
}));
