import { describe, it, expect } from 'vitest';
import { resolveThemeClass } from '@/lib/theme';

describe('resolveThemeClass', () => {
  it('dark → always "dark" regardless of system preference', () => {
    expect(resolveThemeClass('dark', false)).toBe('dark');
    expect(resolveThemeClass('dark', true)).toBe('dark');
  });

  it('light → always "light" regardless of system preference', () => {
    expect(resolveThemeClass('light', false)).toBe('light');
    expect(resolveThemeClass('light', true)).toBe('light');
  });

  it('auto + prefersDark=true → "dark"', () => {
    expect(resolveThemeClass('auto', true)).toBe('dark');
  });

  it('auto + prefersDark=false → "light"', () => {
    expect(resolveThemeClass('auto', false)).toBe('light');
  });
});
