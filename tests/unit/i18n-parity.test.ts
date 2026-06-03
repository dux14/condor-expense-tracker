import { describe, it, expect } from 'vitest'
import esMessages from '@/messages/es.json'
import enMessages from '@/messages/en.json'

// ---------------------------------------------------------------------------
// Flatten a nested object to dot-separated keys.
// e.g. { Common: { save: "…" } } → ["Common.save"]
// ---------------------------------------------------------------------------
function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      return flattenKeys(value as Record<string, unknown>, fullKey)
    }
    return [fullKey]
  })
}

describe('i18n key parity', () => {
  it('es.json and en.json have identical fully-flattened key sets', () => {
    const esKeys = new Set(flattenKeys(esMessages as unknown as Record<string, unknown>))
    const enKeys = new Set(flattenKeys(enMessages as unknown as Record<string, unknown>))

    const onlyInEs = [...esKeys].filter((k) => !enKeys.has(k))
    const onlyInEn = [...enKeys].filter((k) => !esKeys.has(k))

    const hasDrift = onlyInEs.length > 0 || onlyInEn.length > 0

    if (hasDrift) {
      const lines: string[] = ['i18n key parity failure:']
      if (onlyInEs.length > 0) {
        lines.push(`\nKeys present in es.json but NOT in en.json (${onlyInEs.length}):`)
        onlyInEs.sort().forEach((k) => lines.push(`  + ${k}`))
      }
      if (onlyInEn.length > 0) {
        lines.push(`\nKeys present in en.json but NOT in es.json (${onlyInEn.length}):`)
        onlyInEn.sort().forEach((k) => lines.push(`  + ${k}`))
      }
      expect.fail(lines.join('\n'))
    }

    expect(onlyInEs).toEqual([])
    expect(onlyInEn).toEqual([])
  })
})
