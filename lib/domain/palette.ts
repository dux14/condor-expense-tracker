export const CATEGORY_PALETTE = [
  '#C9B6FF',
  '#FF9EB1',
  '#FFD98A',
  '#9EC1FF',
  '#7EE8C9',
] as const;

/**
 * Returns the palette color for a given index, cycling via modulo.
 */
export function paletteColorFor(index: number): string {
  return CATEGORY_PALETTE[index % CATEGORY_PALETTE.length];
}
