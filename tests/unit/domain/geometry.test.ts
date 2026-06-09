import { describe, it, expect } from 'vitest'
import {
  barWidths,
  squarify,
  donutArcs,
  dayBarHeights,
  median,
  mad,
  linePoints,
} from '@/lib/domain/geometry'

// ---------------------------------------------------------------------------
// barWidths
// ---------------------------------------------------------------------------

describe('barWidths', () => {
  it('returns [] for empty input', () => {
    expect(barWidths([])).toEqual([])
  })

  it('all-zero → all 0', () => {
    expect(barWidths([0, 0, 0])).toEqual([0, 0, 0])
  })

  it('single value → 100', () => {
    expect(barWidths([42])).toEqual([100])
  })

  it('largest value becomes 100', () => {
    const result = barWidths([50, 100, 25])
    expect(result[1]).toBe(100) // max is at index 1
  })

  it('relative scaling: [200, 100, 50] → [100, 50, 25]', () => {
    expect(barWidths([200, 100, 50])).toEqual([100, 50, 25])
  })

  it('mixed zeros: zeros stay 0, non-zeros scale correctly', () => {
    const result = barWidths([0, 80, 40, 0])
    expect(result[0]).toBe(0)
    expect(result[3]).toBe(0)
    expect(result[1]).toBe(100)
    expect(result[2]).toBe(50)
  })

  it('returns same length as input', () => {
    expect(barWidths([10, 20, 30, 40]).length).toBe(4)
  })
})

// ---------------------------------------------------------------------------
// squarify
// ---------------------------------------------------------------------------

describe('squarify', () => {
  it('returns [] for empty input', () => {
    expect(squarify([], 400, 300)).toEqual([])
  })

  it('single item fills the whole canvas', () => {
    const [r] = squarify([1], 400, 300)
    expect(r.x).toBeCloseTo(0)
    expect(r.y).toBeCloseTo(0)
    expect(r.w).toBeCloseTo(400)
    expect(r.h).toBeCloseTo(300)
    expect(r.index).toBe(0)
  })

  it('preserves original indices', () => {
    // values sorted desc means index ordering changes
    const rects = squarify([10, 30, 20], 400, 300)
    expect(rects.length).toBe(3)
    const indices = rects.map((r) => r.index).sort()
    expect(indices).toEqual([0, 1, 2])
  })

  it('all rects stay within bounds', () => {
    const W = 400
    const H = 300
    const rects = squarify([100, 80, 60, 40, 20, 10], W, H)
    for (const r of rects) {
      expect(r.x).toBeGreaterThanOrEqual(-0.01)
      expect(r.y).toBeGreaterThanOrEqual(-0.01)
      expect(r.x + r.w).toBeLessThanOrEqual(W + 0.01)
      expect(r.y + r.h).toBeLessThanOrEqual(H + 0.01)
    }
  })

  it('total area equals W*H (area proportionality)', () => {
    const W = 400
    const H = 300
    const values = [100, 80, 60, 40, 20]
    const rects = squarify(values, W, H)
    const totalArea = rects.reduce((s, r) => s + r.w * r.h, 0)
    expect(totalArea).toBeCloseTo(W * H, 0)
  })

  it('areas proportional to values', () => {
    const W = 300
    const H = 300
    const values = [3, 1, 2]
    const rects = squarify(values, W, H)
    const totalArea = W * H
    const totalValue = 6

    // Build a map from index to rect
    const byIndex = new Map(rects.map((r) => [r.index, r]))

    for (let i = 0; i < values.length; i++) {
      const r = byIndex.get(i)!
      const expectedArea = (values[i] / totalValue) * totalArea
      const actualArea = r.w * r.h
      expect(actualArea).toBeCloseTo(expectedArea, 0)
    }
  })

  it('no overlapping rects (pairwise overlap check for small set)', () => {
    const rects = squarify([50, 30, 20, 15, 10], 400, 300)
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i]
        const b = rects[j]
        const overlap =
          a.x < b.x + b.w - 0.01 &&
          a.x + a.w > b.x + 0.01 &&
          a.y < b.y + b.h - 0.01 &&
          a.y + a.h > b.y + 0.01
        expect(overlap).toBe(false)
      }
    }
  })

  it('handles zero-dimension canvas without crashing', () => {
    expect(squarify([1, 2, 3], 0, 300)).toEqual([])
    expect(squarify([1, 2, 3], 400, 0)).toEqual([])
  })

  it('two equal values → two non-overlapping rects with equal area', () => {
    const rects = squarify([5, 5], 100, 100)
    expect(rects.length).toBe(2)
    const areaA = rects[0].w * rects[0].h
    const areaB = rects[1].w * rects[1].h
    expect(areaA).toBeCloseTo(areaB, 1)
    // total area = 100*100
    expect(areaA + areaB).toBeCloseTo(10000, 0)
  })

  it('mixed nonzero + trailing zero values produce no NaN rects', () => {
    const rects = squarify([4, 0, 0], 100, 100)
    expect(rects.length).toBe(3)
    for (const r of rects) {
      expect(Number.isNaN(r.w)).toBe(false)
      expect(Number.isNaN(r.h)).toBe(false)
      expect(Number.isNaN(r.x)).toBe(false)
      expect(Number.isNaN(r.y)).toBe(false)
    }
    // zero-value items get zero area; the nonzero item fills the canvas
    const byIndex = (i: number) => rects.find((r) => r.index === i)!
    expect(byIndex(0).w * byIndex(0).h).toBeCloseTo(10000, 0)
    expect(byIndex(1).w * byIndex(1).h).toBe(0)
    expect(byIndex(2).w * byIndex(2).h).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// donutArcs
// ---------------------------------------------------------------------------

describe('donutArcs', () => {
  it('returns [] for empty input', () => {
    expect(donutArcs([], 100)).toEqual([])
  })

  it('sum === 0 → all zeros', () => {
    const arcs = donutArcs([0, 0, 0], 200)
    for (const a of arcs) {
      expect(a.length).toBe(0)
      expect(a.offset).toBe(0)
      expect(a.fraction).toBe(0)
    }
  })

  it('fractions sum to ~1', () => {
    const arcs = donutArcs([30, 20, 50], 314.16)
    const fracSum = arcs.reduce((s, a) => s + a.fraction, 0)
    expect(fracSum).toBeCloseTo(1, 10)
  })

  it('lengths sum to ~circumference', () => {
    const C = 314.16
    const arcs = donutArcs([30, 20, 50], C)
    const lenSum = arcs.reduce((s, a) => s + a.length, 0)
    expect(lenSum).toBeCloseTo(C, 5)
  })

  it('offsets are cumulative', () => {
    const arcs = donutArcs([50, 30, 20], 100)
    expect(arcs[0].offset).toBeCloseTo(0)
    expect(arcs[1].offset).toBeCloseTo(arcs[0].length)
    expect(arcs[2].offset).toBeCloseTo(arcs[0].length + arcs[1].length)
  })

  it('single value → fraction 1, length = circumference, offset = 0', () => {
    const C = 250
    const [arc] = donutArcs([42], C)
    expect(arc.fraction).toBeCloseTo(1)
    expect(arc.length).toBeCloseTo(C)
    expect(arc.offset).toBeCloseTo(0)
  })

  it('equal values → equal fractions and lengths', () => {
    const C = 300
    const arcs = donutArcs([1, 1, 1], C)
    for (const a of arcs) {
      expect(a.fraction).toBeCloseTo(1 / 3)
      expect(a.length).toBeCloseTo(C / 3)
    }
  })

  it('fraction is proportional to value', () => {
    const arcs = donutArcs([75, 25], 100)
    expect(arcs[0].fraction).toBeCloseTo(0.75)
    expect(arcs[1].fraction).toBeCloseTo(0.25)
  })
})

// ---------------------------------------------------------------------------
// dayBarHeights
// ---------------------------------------------------------------------------

describe('dayBarHeights', () => {
  it('returns [] for empty input', () => {
    expect(dayBarHeights([], 60)).toEqual([])
  })

  it('all-zero → all 0', () => {
    expect(dayBarHeights([0, 0, 0], 60)).toEqual([0, 0, 0])
  })

  it('max value maps to maxHeight', () => {
    const result = dayBarHeights([100, 50, 25], 60)
    expect(result[0]).toBe(60)
  })

  it('others scale proportionally', () => {
    const result = dayBarHeights([100, 50, 25], 60)
    expect(result[1]).toBeCloseTo(30)
    expect(result[2]).toBeCloseTo(15)
  })

  it('single non-zero value → maxHeight', () => {
    expect(dayBarHeights([7], 48)).toEqual([48])
  })

  it('returns same length as input', () => {
    expect(dayBarHeights([10, 20, 30], 50).length).toBe(3)
  })

  it('nonzero value that is not max is between 0 and maxHeight', () => {
    const result = dayBarHeights([400, 200, 100], 80)
    for (const h of result) {
      expect(h).toBeGreaterThanOrEqual(0)
      expect(h).toBeLessThanOrEqual(80)
    }
  })
})

// ---------------------------------------------------------------------------
// median
// ---------------------------------------------------------------------------

describe('median', () => {
  it('returns 0 for empty input', () => {
    expect(median([])).toBe(0)
  })
  it('returns the middle value for odd-length sorted-or-not input', () => {
    expect(median([3, 1, 2])).toBe(2)
  })
  it('averages the two middle values for even-length input', () => {
    expect(median([4, 1, 3, 2])).toBe(2.5)
  })
  it('does not mutate the input array', () => {
    const arr = [3, 1, 2]
    median(arr)
    expect(arr).toEqual([3, 1, 2])
  })
})

// ---------------------------------------------------------------------------
// mad
// ---------------------------------------------------------------------------

describe('mad', () => {
  it('returns 0 for empty input', () => {
    expect(mad([])).toBe(0)
  })
  it('returns 0 when all values are identical', () => {
    expect(mad([5, 5, 5])).toBe(0)
  })
  it('computes the median of absolute deviations from the median', () => {
    // values [1,2,3,4,5] → median 3 → deviations [2,1,0,1,2] → median of those = 1
    expect(mad([1, 2, 3, 4, 5])).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// linePoints
// ---------------------------------------------------------------------------

describe('linePoints', () => {
  it('returns [] for empty input', () => {
    expect(linePoints([], 100, 40)).toEqual([])
  })
  it('maps a single value to a centered point', () => {
    const pts = linePoints([5], 100, 40)
    expect(pts).toEqual([{ x: 0, y: 20 }])
  })
  it('spreads x evenly across width and inverts y (max at top)', () => {
    const pts = linePoints([0, 10], 100, 40)
    expect(pts[0]).toEqual({ x: 0, y: 40 }) // min → bottom
    expect(pts[1]).toEqual({ x: 100, y: 0 }) // max → top
  })
  it('flat series sits on the vertical midline', () => {
    const pts = linePoints([7, 7, 7], 100, 40)
    expect(pts.map((p) => p.y)).toEqual([20, 20, 20])
  })
})
