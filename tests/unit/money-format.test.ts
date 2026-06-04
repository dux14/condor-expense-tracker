import { describe, it, expect } from 'vitest'
import { formatAmountTyping, parseAmount } from '@/lib/format/money'

describe('formatAmountTyping', () => {
  it('groups thousands while typing (es → dots)', () => {
    expect(formatAmountTyping('1', 'es')).toBe('1')
    expect(formatAmountTyping('1450', 'es')).toBe('1.450')
    expect(formatAmountTyping('1450000', 'es')).toBe('1.450.000')
  })

  it('groups thousands while typing (en → commas)', () => {
    expect(formatAmountTyping('1450000', 'en')).toBe('1,450,000')
  })

  it('re-groups text that already contains separators', () => {
    expect(formatAmountTyping('1.4500.00', 'es')).toBe('1.450.000')
    expect(formatAmountTyping('1,45,0000', 'en')).toBe('1,450,000')
  })

  it('preserves the decimal part as typed, including trailing separator', () => {
    expect(formatAmountTyping('1234,', 'es')).toBe('1.234,')
    expect(formatAmountTyping('1234,5', 'es')).toBe('1.234,5')
    expect(formatAmountTyping('1234.56', 'en')).toBe('1,234.56')
  })

  it('ignores a second decimal separator and invalid characters', () => {
    expect(formatAmountTyping('12,3,4', 'es')).toBe('12,34')
    expect(formatAmountTyping('abc12x3', 'es')).toBe('123')
  })

  it('handles leading zeros and bare separator', () => {
    expect(formatAmountTyping('007', 'es')).toBe('7')
    expect(formatAmountTyping(',', 'es')).toBe('0,')
    expect(formatAmountTyping('', 'es')).toBe('')
  })

  it('round-trips through parseAmount', () => {
    expect(parseAmount(formatAmountTyping('1450000', 'es'), 'es')).toBe(1450000)
    expect(parseAmount(formatAmountTyping('1234.56', 'en'), 'en')).toBe(1234.56)
  })
})
