import {
  addMonths,
  format,
  getDaysInMonth,
  parseISO,
  startOfMonth,
  subMonths,
} from 'date-fns'
import { es, enUS } from 'date-fns/locale'

type AppLocale = 'es' | 'en'

const DATE_FNS_LOCALE = {
  es,
  en: enUS,
}

/** '2026-06-15' → '2026-06' */
export function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7)
}

/** Today as 'yyyy-MM-dd' in local time */
export function todayKey(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

/** Today as 'yyyy-MM' in local time */
export function todayMonthKey(): string {
  return format(new Date(), 'yyyy-MM')
}

/** Number of days in the month identified by 'yyyy-MM' */
export function daysInMonth(mk: string): number {
  // Parse as the first day of that month
  const date = parseISO(`${mk}-01`)
  return getDaysInMonth(date)
}

/** '2026-06' → '2026-05'; '2026-01' → '2025-12' */
export function prevMonthKey(mk: string): string {
  const date = parseISO(`${mk}-01`)
  const prev = subMonths(date, 1)
  return format(prev, 'yyyy-MM')
}

/** '2026-06' → '2026-07'; '2026-12' → '2027-01' */
export function nextMonthKey(mk: string): string {
  const date = parseISO(`${mk}-01`)
  const next = addMonths(date, 1)
  return format(next, 'yyyy-MM')
}

/** Whether a date string falls within the given month key */
export function isInMonth(dateStr: string, mk: string): boolean {
  return dateStr.startsWith(mk + '-')
}

/** Human-readable month label, e.g. 'Junio 2026' (es) or 'June 2026' (en) */
export function formatMonthLabel(mk: string, locale: AppLocale): string {
  const date = parseISO(`${mk}-01`)
  const dateFnsLocale = DATE_FNS_LOCALE[locale]
  const label = format(startOfMonth(date), 'LLLL yyyy', { locale: dateFnsLocale })
  // Capitalize first letter (date-fns may return lowercase for some locales)
  return label.charAt(0).toUpperCase() + label.slice(1)
}
