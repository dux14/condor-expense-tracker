import type { Locale } from '@/lib/domain/types';
import es from '@/messages/es.json';
import en from '@/messages/en.json';

export type Messages = typeof es;

export function getMessages(locale: Locale): Messages {
  return locale === 'en' ? en : es;
}
