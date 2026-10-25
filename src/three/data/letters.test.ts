import { describe, expect, it } from 'vitest'
import { GLYPHS, layoutWord } from './letters'

describe('logo glyphs', () => {
  it('every glyph is 5x7', () => {
    for (const rows of Object.values(GLYPHS)) {
      expect(rows).toHaveLength(7)
      for (const r of rows) expect(r).toHaveLength(5)
    }
  })
  it('has glyphs for every letter of ANOMALY', () => {
    for (const ch of 'ANOMALY') expect(GLYPHS[ch]).toBeDefined()
  })
  it('lays out a centered word', () => {
    const v = layoutWord('ANOMALY', 2)
    expect(v.length).toBeGreaterThan(100)
    const xs = v.map((p) => p.x)
    expect(Math.min(...xs)).toBeCloseTo(-Math.max(...xs), 5)
  })
})
