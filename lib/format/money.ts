type AppLocale = 'es' | 'en'

const LOCALE_TAG: Record<AppLocale, string> = {
  es: 'es-CO',
  en: 'en-US',
}

export function formatMoney(amount: number, currency: string, locale: AppLocale): string {
  const tag = LOCALE_TAG[locale]
  return new Intl.NumberFormat(tag, { style: 'currency', currency }).format(amount)
}

// Memoized per locale: getSeparators runs on every keystroke in AmountInput,
// and Intl.NumberFormat + formatToParts are not cheap on mobile.
const separatorsCache = new Map<AppLocale, { group: string; decimal: string }>()

/** Group and decimal separators for an app locale (es → '.'/',', en → ','/'.'). */
export function getSeparators(locale: AppLocale): { group: string; decimal: string } {
  let seps = separatorsCache.get(locale)
  if (!seps) {
    const parts = new Intl.NumberFormat(LOCALE_TAG[locale]).formatToParts(11111.1)
    seps = {
      group: parts.find((p) => p.type === 'group')?.value ?? ',',
      decimal: parts.find((p) => p.type === 'decimal')?.value ?? '.',
    }
    separatorsCache.set(locale, seps)
  }
  return seps
}

/**
 * Live-format a partially typed amount: strip invalid characters, re-group
 * the integer part in thousands, and preserve the decimal part exactly as
 * typed (including a trailing separator like "12," mid-typing).
 */
export function formatAmountTyping(raw: string, locale: AppLocale): string {
  const { group, decimal } = getSeparators(locale)
  let cleaned = ''
  let seenDecimal = false
  for (const ch of raw) {
    if (ch >= '0' && ch <= '9') cleaned += ch
    else if (ch === decimal && !seenDecimal) {
      cleaned += decimal
      seenDecimal = true
    }
  }
  if (cleaned === '') return ''

  const di = cleaned.indexOf(decimal)
  const intPart = di === -1 ? cleaned : cleaned.slice(0, di)
  const decPart = di === -1 ? null : cleaned.slice(di + 1)
  const intDigits = intPart.replace(/^0+(?=\d)/, '')

  let grouped = ''
  for (let i = 0; i < intDigits.length; i++) {
    grouped += intDigits[i]
    const fromEnd = intDigits.length - 1 - i
    if (fromEnd > 0 && fromEnd % 3 === 0) grouped += group
  }
  return decPart === null ? grouped : `${grouped || '0'}${decimal}${decPart}`
}

// Memoized per locale: rebuilt-per-call RegExps add up on the typing hot path.
const stripRegexCache = new Map<AppLocale, RegExp>()

function getStripRegex(locale: AppLocale): RegExp {
  let re = stripRegexCache.get(locale)
  if (!re) {
    const { group, decimal } = getSeparators(locale)
    const escapedGroup = group.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const escapedDecimal = decimal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // Everything that's not a digit, group sep, or decimal sep
    re = new RegExp(`[^0-9${escapedGroup}${escapedDecimal}]`, 'g')
    stripRegexCache.set(locale, re)
  }
  return re
}

export function parseAmount(input: string, locale: AppLocale): number {
  const { group: groupSep, decimal: decimalSep } = getSeparators(locale)

  // Strip currency symbols, currency codes, and leading/trailing whitespace.
  // Keep digits, group separators, and decimal separator.
  let cleaned = input.trim().replace(getStripRegex(locale), '')

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
