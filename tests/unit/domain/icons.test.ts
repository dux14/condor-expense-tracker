import { describe, it, expect } from 'vitest'
import {
  Utensils, Bus, Sparkles, Clapperboard, Plane, Gamepad2,
  ShoppingCart, HeartPulse, Receipt, CircleDot, PawPrint,
} from 'lucide-react'
import { ICON_KEYS, ICONS, ICON_GROUPS } from '@/lib/domain/icons'

describe('icons pool', () => {
  it('every key in ICON_KEYS resolves to a defined component in ICONS', () => {
    for (const k of ICON_KEYS) {
      expect(typeof ICONS[k]).not.toBe('undefined')
    }
  })

  it('keeps the 11 original keys mapped to their original components', () => {
    expect(ICONS['comida']).toBe(Utensils)
    expect(ICONS['transporte']).toBe(Bus)
    expect(ICONS['ocio']).toBe(Sparkles)
    expect(ICONS['entretenimiento']).toBe(Clapperboard)
    expect(ICONS['turismo']).toBe(Plane)
    expect(ICONS['videojuegos']).toBe(Gamepad2)
    expect(ICONS['mercado']).toBe(ShoppingCart)
    expect(ICONS['salud']).toBe(HeartPulse)
    expect(ICONS['servicios']).toBe(Receipt)
    expect(ICONS['otros']).toBe(CircleDot)
    expect(ICONS['mascotas']).toBe(PawPrint)
  })

  it('ICON_GROUPS keys are a permutation of ICON_KEYS (no missing, extra, or dup)', () => {
    const grouped = ICON_GROUPS.flatMap((g) => g.keys)
    // no duplicates across groups
    expect(new Set(grouped).size).toBe(grouped.length)
    // same multiset as ICON_KEYS
    expect([...grouped].sort()).toEqual([...ICON_KEYS].sort())
  })

  it('ICON_KEYS holds the expanded themed pool (~55+, in 50–70 range)', () => {
    // Plan B1 mandates the exact key list verbatim, which totals 69 keys.
    expect(ICON_KEYS.length).toBe(69)
  })
})
