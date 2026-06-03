import type { ThemePref } from '@/lib/domain/types';

/**
 * Resolve a ThemePref to an actual class name ('dark' | 'light').
 * - 'dark'  → always 'dark'
 * - 'light' → always 'light'
 * - 'auto'  → 'dark' if prefersDark, else 'light'
 */
export function resolveThemeClass(
  theme: ThemePref,
  prefersDark: boolean,
): 'dark' | 'light' {
  if (theme === 'dark') return 'dark';
  if (theme === 'light') return 'light';
  return prefersDark ? 'dark' : 'light';
}
