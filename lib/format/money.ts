type AppLocale = 'es' | 'en'

const LOCALE_TAG: Record<AppLocale, string> = {
  es: 'es-CO',
  en: 'en-US',
}

export function formatMoney(amount: number, currency: string, locale: AppLocale): string {
  const tag = LOCALE_TAG[locale]
  return new Intl.NumberFormat(tag, { style: 'currency', currency }).format(amount)
}

export function parseAmount(input: string, locale: AppLocale): number {
  const tag = LOCALE_TAG[locale]

  // Derive group and decimal separators from Intl for the locale
  const parts = new Intl.NumberFormat(tag).formatToParts(11111.1)
  const groupSep = parts.find((p) => p.type === 'group')?.value ?? ','
  const decimalSep = parts.find((p) => p.type === 'decimal')?.value ?? '.'

  // Strip currency symbols, currency codes, and leading/trailing whitespace
  // Keep digits, group separators, and decimal separator
  let cleaned = input.trim()

  // Remove any characters that are not digits, group separators, or decimal separators
  // First escape the separators for use in regex
  const escapedGroup = groupSep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const escapedDecimal = decimalSep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  // Strip everything that's not a digit, group sep, or decimal sep
  cleaned = cleaned.replace(new RegExp(`[^0-9${escapedGroup}${escapedDecimal}]`, 'g'), '')

  if (cleaned === '') return NaN

  // Remove group separators
  cleaned = cleaned.split(groupSep).join('')

  // Normalize decimal separator to '.'
  if (decimalSep !== '.') {
    cleaned = cleaned.replace(decimalSep, '.')
  }

  const result = Number(cleaned)
  return Number.isFinite(result) ? result : NaN
}

export function roundToMinorUnits(amount: number, currency: string): number {
  const digits = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).resolvedOptions().maximumFractionDigits ?? 2

  const factor = Math.pow(10, digits)
  return Math.round(amount * factor) / factor
}
