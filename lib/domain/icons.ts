import type { LucideIcon } from 'lucide-react';
import {
  // existing 11 (do not change keys or components)
  Utensils, Bus, Sparkles, Clapperboard, Plane, Gamepad2,
  ShoppingCart, HeartPulse, Receipt, CircleDot, PawPrint,
  // comida / bebida
  Coffee, Pizza, Beer, Wine, Apple, Soup, Salad, Drumstick, IceCream, CupSoda,
  // transporte
  Car, CarTaxiFront, TramFront, Train, Bike, Fuel, Plane as PlaneTravel,
  // hogar
  House, Lightbulb, Wrench, Sofa, WashingMachine,
  // compras
  ShoppingBag, Shirt, Gift, Store, Tag,
  // salud
  Pill, Stethoscope, Dumbbell, Syringe,
  // ocio
  Music, Film, Ticket, PartyPopper, Trophy,
  // finanzas
  Wallet, CreditCard, Landmark, PiggyBank, Banknote, Coins,
  // viajes
  MapPin, Luggage, Hotel, Mountain, Globe,
  // educacion
  GraduationCap, BookOpen, Pencil,
  // tech
  Laptop, Smartphone, Wifi, Monitor,
  // otros
  Star, Heart, Briefcase, MoreHorizontal,
} from 'lucide-react';

export const ICON_KEYS = [
  // ── existing 11 (back-compat — DO NOT rename) ──
  'comida', 'transporte', 'ocio', 'entretenimiento', 'turismo',
  'videojuegos', 'mercado', 'salud', 'servicios', 'otros', 'mascotas',
  // ── food/drink ──
  'food-coffee', 'food-pizza', 'food-beer', 'food-wine', 'food-apple',
  'food-soup', 'food-salad', 'food-meat', 'food-icecream', 'food-soda',
  // ── transport ──
  'trans-car', 'trans-taxi', 'trans-tram', 'trans-train', 'trans-bike', 'trans-fuel', 'trans-plane',
  // ── home ──
  'home-house', 'home-light', 'home-tools', 'home-sofa', 'home-laundry',
  // ── shopping ──
  'shop-bag', 'shop-clothes', 'shop-gift', 'shop-store', 'shop-tag',
  // ── health ──
  'health-pill', 'health-doctor', 'health-gym', 'health-shot',
  // ── leisure ──
  'fun-music', 'fun-film', 'fun-ticket', 'fun-party', 'fun-trophy',
  // ── finance ──
  'fin-wallet', 'fin-card', 'fin-bank', 'fin-piggy', 'fin-cash', 'fin-coins',
  // ── travel ──
  'travel-pin', 'travel-luggage', 'travel-hotel', 'travel-mountain', 'travel-globe',
  // ── education ──
  'edu-cap', 'edu-book', 'edu-pencil',
  // ── tech ──
  'tech-laptop', 'tech-phone', 'tech-wifi', 'tech-monitor',
  // ── other ──
  'other-star', 'other-heart', 'other-work', 'other-more',
] as const;

export type IconKey = (typeof ICON_KEYS)[number];

/** Type guard: returns true if `k` is a valid IconKey. */
export const isIconKey = (k: string): k is IconKey =>
  (ICON_KEYS as readonly string[]).includes(k);

export const ICONS: Record<IconKey, LucideIcon> = {
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
  'food-coffee': Coffee,
  'food-pizza': Pizza,
  'food-beer': Beer,
  'food-wine': Wine,
  'food-apple': Apple,
  'food-soup': Soup,
  'food-salad': Salad,
  'food-meat': Drumstick,
  'food-icecream': IceCream,
  'food-soda': CupSoda,
  'trans-car': Car,
  'trans-taxi': CarTaxiFront,
  'trans-tram': TramFront,
  'trans-train': Train,
  'trans-bike': Bike,
  'trans-fuel': Fuel,
  'trans-plane': PlaneTravel,
  'home-house': House,
  'home-light': Lightbulb,
  'home-tools': Wrench,
  'home-sofa': Sofa,
  'home-laundry': WashingMachine,
  'shop-bag': ShoppingBag,
  'shop-clothes': Shirt,
  'shop-gift': Gift,
  'shop-store': Store,
  'shop-tag': Tag,
  'health-pill': Pill,
  'health-doctor': Stethoscope,
  'health-gym': Dumbbell,
  'health-shot': Syringe,
  'fun-music': Music,
  'fun-film': Film,
  'fun-ticket': Ticket,
  'fun-party': PartyPopper,
  'fun-trophy': Trophy,
  'fin-wallet': Wallet,
  'fin-card': CreditCard,
  'fin-bank': Landmark,
  'fin-piggy': PiggyBank,
  'fin-cash': Banknote,
  'fin-coins': Coins,
  'travel-pin': MapPin,
  'travel-luggage': Luggage,
  'travel-hotel': Hotel,
  'travel-mountain': Mountain,
  'travel-globe': Globe,
  'edu-cap': GraduationCap,
  'edu-book': BookOpen,
  'edu-pencil': Pencil,
  'tech-laptop': Laptop,
  'tech-phone': Smartphone,
  'tech-wifi': Wifi,
  'tech-monitor': Monitor,
  'other-star': Star,
  'other-heart': Heart,
  'other-work': Briefcase,
  'other-more': MoreHorizontal,
};

/** Ordered theme groups for the picker. `id` resolves to an i18n label. */
export interface IconGroup {
  id: string;
  keys: IconKey[];
}

export const ICON_GROUPS: IconGroup[] = [
  { id: 'food', keys: ['comida', 'food-coffee', 'food-pizza', 'food-beer', 'food-wine', 'food-apple', 'food-soup', 'food-salad', 'food-meat', 'food-icecream', 'food-soda'] },
  { id: 'transport', keys: ['transporte', 'trans-car', 'trans-taxi', 'trans-tram', 'trans-train', 'trans-bike', 'trans-fuel', 'trans-plane'] },
  { id: 'home', keys: ['servicios', 'home-house', 'home-light', 'home-tools', 'home-sofa', 'home-laundry'] },
  { id: 'shopping', keys: ['mercado', 'shop-bag', 'shop-clothes', 'shop-gift', 'shop-store', 'shop-tag'] },
  { id: 'health', keys: ['salud', 'health-pill', 'health-doctor', 'health-gym', 'health-shot'] },
  { id: 'leisure', keys: ['ocio', 'entretenimiento', 'videojuegos', 'fun-music', 'fun-film', 'fun-ticket', 'fun-party', 'fun-trophy'] },
  { id: 'finance', keys: ['fin-wallet', 'fin-card', 'fin-bank', 'fin-piggy', 'fin-cash', 'fin-coins'] },
  { id: 'travel', keys: ['turismo', 'travel-pin', 'travel-luggage', 'travel-hotel', 'travel-mountain', 'travel-globe'] },
  { id: 'pets', keys: ['mascotas'] },
  { id: 'education', keys: ['edu-cap', 'edu-book', 'edu-pencil'] },
  { id: 'tech', keys: ['tech-laptop', 'tech-phone', 'tech-wifi', 'tech-monitor'] },
  { id: 'other', keys: ['otros', 'other-star', 'other-heart', 'other-work', 'other-more'] },
];
