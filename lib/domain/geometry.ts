// Pure geometry helpers for chart components.
// No side-effects, no imports — fully testable in isolation.

// ---------------------------------------------------------------------------
// RankedItem (shared chart item shape, mirrors selectors.RankedCategoryRow)
// ---------------------------------------------------------------------------

export interface RankedItem {
  categoryId: string
  name: string
  color: string
  icon: string
  totalBase: number
  pct: number
}

// ---------------------------------------------------------------------------
// barWidths
// ---------------------------------------------------------------------------

/**
 * Maps each value to a width percentage (0–100) relative to the MAX value.
 * The largest value → 100, others proportional.
 * Empty input → []. All-zero → all 0.
 */
export function barWidths(values: number[]): number[] {
  if (values.length === 0) return []
  const max = Math.max(...values)
  if (max === 0) return values.map(() => 0)
  return values.map((v) => (v / max) * 100)
}

// ---------------------------------------------------------------------------
// squarify
// ---------------------------------------------------------------------------

export interface SquarifyRect {
  x: number
  y: number
  w: number
  h: number
  index: number
}

/**
 * Squarified treemap algorithm.
 * Returns one rect per value, ordered by descending value.
 * Preserves original `index` into the input array.
 * Rects stay within [0, width] × [0, height].
 * Areas are proportional to values.
 */
export function squarify(
  values: number[],
  width: number,
  height: number,
): SquarifyRect[] {
  if (values.length === 0) return []
  if (width <= 0 || height <= 0) return []

  const total = values.reduce((s, v) => s + v, 0)
  if (total <= 0) {
    // All zero: split evenly
    return values.map((_, i) => {
      const cols = Math.ceil(Math.sqrt(values.length))
      const rows = Math.ceil(values.length / cols)
      const col = i % cols
      const row = Math.floor(i / cols)
      return {
        x: (col / cols) * width,
        y: (row / rows) * height,
        w: width / cols,
        h: height / rows,
        index: i,
      }
    })
  }

  // Pair values with original indices, sort descending
  const items = values.map((v, i) => ({ v, index: i })).sort((a, b) => b.v - a.v)

  const result: SquarifyRect[] = []

  _squarifyLayout(items, 0, 0, width, height, total, result)

  return result
}

function _squarifyLayout(
  items: { v: number; index: number }[],
  x: number,
  y: number,
  w: number,
  h: number,
  areaTotal: number,
  result: SquarifyRect[],
): void {
  if (items.length === 0) return
  if (areaTotal <= 0) {
    // Remaining items all have value 0 → zero-area rects (avoids 0*Infinity NaN).
    for (const item of items) {
      result.push({ x, y, w: 0, h: 0, index: item.index })
    }
    return
  }
  if (items.length === 1) {
    result.push({ x, y, w, h, index: items[0].index })
    return
  }

  const totalArea = w * h
  const scale = totalArea / areaTotal

  // Try to form a row with good aspect ratio
  const isHorizontal = w >= h

  let row: { v: number; index: number }[] = []
  let rowSum = 0
  let bestWorst = Infinity

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    row.push(item)
    rowSum += item.v

    const worst = _worstAspect(row, rowSum, isHorizontal, w, h, scale)

    if (worst <= bestWorst) {
      bestWorst = worst
    } else {
      // Remove last item — previous row was better
      row.pop()
      rowSum -= item.v
      break
    }
  }

  if (row.length === 0) {
    row = [items[0]]
    rowSum = items[0].v
  }

  // Place the row
  const rowFraction = rowSum / areaTotal
  let cursor: number

  if (isHorizontal) {
    const rowW = rowFraction * w
    cursor = y
    for (const item of row) {
      const frac = item.v / rowSum
      const rh = frac * h
      result.push({ x, y: cursor, w: rowW, h: rh, index: item.index })
      cursor += rh
    }
    const remaining = items.slice(row.length)
    if (remaining.length > 0) {
      _squarifyLayout(remaining, x + rowW, y, w - rowW, h, areaTotal - rowSum, result)
    }
  } else {
    const rowH = rowFraction * h
    cursor = x
    for (const item of row) {
      const frac = item.v / rowSum
      const rw = frac * w
      result.push({ x: cursor, y, w: rw, h: rowH, index: item.index })
      cursor += rw
    }
    const remaining = items.slice(row.length)
    if (remaining.length > 0) {
      _squarifyLayout(remaining, x, y + rowH, w, h - rowH, areaTotal - rowSum, result)
    }
  }
}

function _worstAspect(
  row: { v: number }[],
  rowSum: number,
  isHorizontal: boolean,
  w: number,
  h: number,
  scale: number, // area per unit value
): number {
  const rowArea = rowSum * scale
  const side = isHorizontal ? rowArea / h : rowArea / w

  let worst = 0
  for (const item of row) {
    const area = item.v * scale
    const other = area / side
    const aspect = Math.max(side / other, other / side)
    if (aspect > worst) worst = aspect
  }
  return worst
}

// ---------------------------------------------------------------------------
// donutArcs
// ---------------------------------------------------------------------------

export interface DonutArc {
  length: number
  offset: number
  fraction: number
}

/**
 * Computes strokeDasharray / strokeDashoffset parameters for each donut segment.
 * - fraction = value / sum
 * - length   = fraction * circumference
 * - offset   = cumulative sum of previous lengths (negated when used as strokeDashoffset)
 *
 * When sum === 0, all arcs are {length:0, offset:0, fraction:0}.
 * Sum of lengths ≈ circumference.
 */
export function donutArcs(values: number[], circumference: number): DonutArc[] {
  if (values.length === 0) return []
  const sum = values.reduce((s, v) => s + v, 0)
  if (sum === 0) return values.map(() => ({ length: 0, offset: 0, fraction: 0 }))

  const arcs: DonutArc[] = []
  let cumulative = 0
  for (const v of values) {
    const fraction = v / sum
    const length = fraction * circumference
    arcs.push({ length, offset: cumulative, fraction })
    cumulative += length
  }
  return arcs
}

// ---------------------------------------------------------------------------
// dayBarHeights
// ---------------------------------------------------------------------------

/**
 * Scales each day value so the MAX value maps to maxHeight, others proportional.
 * All-zero → all 0.
 * Empty → [].
 * Note: min-height for visible nonzero bars is the component's concern.
 */
export function dayBarHeights(values: number[], maxHeight: number): number[] {
  if (values.length === 0) return []
  const max = Math.max(...values)
  if (max === 0) return values.map(() => 0)
  return values.map((v) => (v / max) * maxHeight)
}
