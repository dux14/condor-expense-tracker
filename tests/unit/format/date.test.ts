import {
  monthKey,
  todayKey,
  todayMonthKey,
  daysInMonth,
  prevMonthKey,
  isInMonth,
  formatMonthLabel,
} from '@/lib/format/date'
import { format } from 'date-fns'

describe('monthKey', () => {
  it('extracts yyyy-MM from a full date string', () => {
    expect(monthKey('2026-06-15')).toBe('2026-06')
  })

  it('works for end-of-month dates', () => {
    expect(monthKey('2026-06-30')).toBe('2026-06')
  })

  it('works for start-of-month dates', () => {
    expect(monthKey('2026-01-01')).toBe('2026-01')
  })
})

describe('todayKey', () => {
  it('returns today in yyyy-MM-dd format', () => {
    const expected = format(new Date(), 'yyyy-MM-dd')
    expect(todayKey()).toBe(expected)
  })

  it('matches the pattern yyyy-MM-dd', () => {
    expect(todayKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('todayMonthKey', () => {
  it('returns today month in yyyy-MM format', () => {
    const expected = format(new Date(), 'yyyy-MM')
    expect(todayMonthKey()).toBe(expected)
  })

  it('matches the pattern yyyy-MM', () => {
    expect(todayMonthKey()).toMatch(/^\d{4}-\d{2}$/)
  })
})

describe('daysInMonth', () => {
  it('returns 30 for June 2026', () => {
    expect(daysInMonth('2026-06')).toBe(30)
  })

  it('returns 28 for February 2026 (non-leap year)', () => {
    expect(daysInMonth('2026-02')).toBe(28)
  })

  it('returns 29 for February 2024 (leap year)', () => {
    expect(daysInMonth('2024-02')).toBe(29)
  })

  it('returns 31 for January', () => {
    expect(daysInMonth('2026-01')).toBe(31)
  })

  it('returns 31 for December', () => {
    expect(daysInMonth('2026-12')).toBe(31)
  })
})

describe('prevMonthKey', () => {
  it('goes from June to May', () => {
    expect(prevMonthKey('2026-06')).toBe('2026-05')
  })

  it('wraps from January to previous December', () => {
    expect(prevMonthKey('2026-01')).toBe('2025-12')
  })

  it('handles mid-year', () => {
    expect(prevMonthKey('2026-07')).toBe('2026-06')
  })
})

describe('isInMonth', () => {
  it('returns true for a date in the given month', () => {
    expect(isInMonth('2026-06-30', '2026-06')).toBe(true)
  })

  it('returns false for a date in the next month', () => {
    expect(isInMonth('2026-07-01', '2026-06')).toBe(false)
  })

  it('returns true for start of month', () => {
    expect(isInMonth('2026-06-01', '2026-06')).toBe(true)
  })

  it('returns false for prior month', () => {
    expect(isInMonth('2026-05-31', '2026-06')).toBe(false)
  })
})

describe('formatMonthLabel', () => {
  it('contains "junio" for es locale June 2026 (case-insensitive)', () => {
    const result = formatMonthLabel('2026-06', 'es')
    expect(result.toLowerCase()).toContain('junio')
  })

  it('contains "june" for en locale June 2026 (case-insensitive)', () => {
    const result = formatMonthLabel('2026-06', 'en')
    expect(result.toLowerCase()).toContain('june')
  })

  it('contains the year in the label', () => {
    expect(formatMonthLabel('2026-06', 'es')).toContain('2026')
    expect(formatMonthLabel('2026-06', 'en')).toContain('2026')
  })

  it('starts with an uppercase letter for es locale', () => {
    const result = formatMonthLabel('2026-06', 'es')
    expect(result[0]).toBe(result[0].toUpperCase())
  })
})
