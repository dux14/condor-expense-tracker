import type { LucideIcon } from 'lucide-react';
import {
  Utensils,
  Bus,
  Sparkles,
  Clapperboard,
  Plane,
  Gamepad2,
  ShoppingCart,
  HeartPulse,
  Receipt,
  CircleDot,
  PawPrint,
} from 'lucide-react';

export const ICON_KEYS = [
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
  'mascotas', // available for user categories; not a preset
] as const;

export type IconKey = (typeof ICON_KEYS)[number];

/** Type guard: returns true if `k` is a valid IconKey. */
export const isIconKey = (k: string): k is IconKey =>
  (ICON_KEYS as readonly string[]).includes(k);

export const ICONS: Record<string, LucideIcon> = {
  comida: Utensils,
  transporte: Bus,
  ocio: Sparkles,
  entretenimiento: Clapperboard,
  turismo: Plane,
  videojuegos: Gamepad2,
  mercado: ShoppingCart,
  salud: HeartPulse,
  servicios: Receipt,
  otros: CircleDot,
  mascotas: PawPrint,
};
