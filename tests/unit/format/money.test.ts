import { formatMoney, parseAmount, roundToMinorUnits } from '@/lib/format/money'

describe('formatMoney', () => {
  it('delegates to Intl.NumberFormat with mapped locale tag for es/COP', () => {
    const amount = 2847500
    const currency = 'COP'
    const locale = 'es' as const
    const expected = new Intl.NumberFormat('es-CO', { style: 'currency', currency }).format(amount)
    expect(formatMoney(amount, currency, locale)).toBe(expected)
  })

  it('delegates to Intl.NumberFormat with mapped locale tag for en/USD', () => {
    const amount = 1234.56
    const currency = 'USD'
    const locale = 'en' as const
    const expected = new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
    expect(formatMoney(amount, currency, locale)).toBe(expected)
  })

  it('COP output contains grouped digits for es locale', () => {
    const result = formatMoney(2847500, 'COP', 'es')
    // The number 2,847,500 in es-CO grouping uses dots: 2.847.500
    expect(result).toContain('2.847.500')
  })

  it('USD output contains decimal digits for en locale', () => {
    const result = formatMoney(12.5, 'USD', 'en')
    expect(result).toContain('12.50')
  })

  it('COP output has no fraction digits', () => {
    const result = formatMoney(2847500, 'COP', 'es')
    // Should not contain a decimal separator followed by digits for COP
    // COP has 0 minor units
    expect(result).not.toMatch(/[,.](\d{2})$/)
  })

  it('USD output has exactly 2 fraction digits', () => {
    const result = formatMoney(12.5, 'USD', 'en')
    expect(result).toMatch(/12\.50/)
  })
})

describe('parseAmount', () => {
  it('parses es locale thousands-dot separated number', () => {
    expect(parseAmount('2.847.500', 'es')).toBe(2847500)
  })

  it('parses es locale decimal-comma number', () => {
    expect(parseAmount('12,50', 'es')).toBe(12.5)
  })

  it('parses en locale comma-grouped number with decimal', () => {
    expect(parseAmount('1,234.56', 'en')).toBe(1234.56)
  })

  it('parses en locale simple decimal number', () => {
    expect(parseAmount('12.50', 'en')).toBe(12.5)
  })

  it('returns NaN for unparseable input', () => {
    expect(Number.isNaN(parseAmount('abc', 'es'))).toBe(true)
  })

  it('strips currency symbols and spaces', () => {
    // Should handle strings with currency symbols like "$1,234.56"
    expect(parseAmount('$1,234.56', 'en')).toBe(1234.56)
  })
})

describe('roundToMinorUnits', () => {
  it('rounds COP to 0 decimal places (strips fractional part)', () => {
    // COP has 0 minor units; Math.round(2847500.7) = 2847501
    expect(roundToMinorUnits(2847500.7, 'COP')).toBe(2847501)
    // A value that rounds down
    expect(roundToMinorUnits(2847500.2, 'COP')).toBe(2847500)
  })

  it('rounds USD to 2 decimal places', () => {
    expect(roundToMinorUnits(12.349, 'USD')).toBe(12.35)
  })

  it('handles USD half-up rounding', () => {
    // 12.345 rounds to 12.35 (half-up)
    expect(roundToMinorUnits(12.345, 'USD')).toBe(12.35)
  })

  it('returns a Number (not string)', () => {
    const result = roundToMinorUnits(12.349, 'USD')
    expect(typeof result).toBe('number')
  })
})
