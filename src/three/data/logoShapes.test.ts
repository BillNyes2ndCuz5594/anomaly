import { describe, expect, it } from 'vitest'
import { layoutLogo, type Pt } from './logoShapes'

function area(p: Pt[]): number {
  let a = 0
  for (let i = 0; i < p.length; i++) {
    const [x1, y1] = p[i]
    const [x2, y2] = p[(i + 1) % p.length]
    a += x1 * y2 - x2 * y1
  }
  return a / 2
}

describe('logo outline glyphs', () => {
  const { glyphs, width } = layoutLogo('ANOMALY')
  it('spells ANOMALY and is centered', () => {
    expect(glyphs.map((g) => g.ch).join('')).toBe('ANOMALY')
    expect(glyphs[0].x).toBeCloseTo(-width / 2)
    const last = glyphs[glyphs.length - 1]
    expect(last.x + last.w).toBeCloseTo(width / 2)
  })
  it('keeps every point inside its glyph box', () => {
    for (const g of glyphs)
      for (const [x, y] of [...g.outline, ...g.holes.flat()]) {
        expect(x).toBeGreaterThanOrEqual(-1e-9)
        expect(x).toBeLessThanOrEqual(g.w + 1e-9)
        expect(y).toBeGreaterThanOrEqual(-1e-9)
        expect(y).toBeLessThanOrEqual(1 + 1e-9)
      }
  })
  it('holes sit inside their outline and have positive area', () => {
    for (const g of glyphs) {
      expect(Math.abs(area(g.outline))).toBeGreaterThan(0.05)
      for (const h of g.holes) expect(Math.abs(area(h))).toBeLessThan(Math.abs(area(g.outline)))
    }
    expect(glyphs.filter((g) => g.holes.length > 0).map((g) => g.ch).join('')).toBe('AOA')
  })
})
