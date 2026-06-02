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

export const ICON_KEYS: string[] = [
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
  'mascotas',
];

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
