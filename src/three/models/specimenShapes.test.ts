import { describe, expect, it } from 'vitest'
import { HERO_SPECIMENS } from './heroSpecimens'
import { SPECIMEN_SHAPES } from './specimenShapes'
import { specimenGeo } from './creatures'
import { DISPLAY_YAW } from './specimenBox'
import { meanProjectedArea, outlinePoints } from '../fit'

function computeFreshTable(): Record<string, { size: [number, number, number]; area: number }> {
  const fresh: Record<string, { size: [number, number, number]; area: number }> = {}
  for (const id of Object.keys(HERO_SPECIMENS).sort()) {
    const g = specimenGeo(id, 1)
    const points = outlinePoints(g.geo.getAttribute('position').array as ArrayLike<number>, 128)
    const area = meanProjectedArea(points, DISPLAY_YAW, 0.6, 0.24)
    fresh[id] = {
      size: [g.size[0], g.size[1], g.size[2]],
      area,
    }
  }
  return fresh
}

function relativeDiff(actual: number, expected: number): number {
  return Math.abs(actual - expected) / Math.max(Math.abs(expected), 1e-9)
}

describe('specimen shapes table', () => {
  it('table keys equal Object.keys(HERO_SPECIMENS) sorted and match live procedural models', () => {
    const tableKeys = Object.keys(SPECIMEN_SHAPES)
    const expectedKeys = Object.keys(HERO_SPECIMENS).sort()

    if (tableKeys.length !== expectedKeys.length || tableKeys.some((k, i) => k !== expectedKeys[i])) {
      console.log(JSON.stringify(computeFreshTable(), null, 2))
    }
    expect(tableKeys).toEqual(expectedKeys)

    for (const id of expectedKeys) {
      const entry = SPECIMEN_SHAPES[id]
      const g = specimenGeo(id, 1)
      const points = outlinePoints(g.geo.getAttribute('position').array as ArrayLike<number>, 128)
      const area = meanProjectedArea(points, DISPLAY_YAW, 0.6, 0.24)

      const sizeDiff = Math.max(
        relativeDiff(g.size[0], entry.size[0]),
        relativeDiff(g.size[1], entry.size[1]),
        relativeDiff(g.size[2], entry.size[2]),
      )
      const areaDiff = relativeDiff(area, entry.area)

      if (sizeDiff > 1e-6 || areaDiff > 1e-6) {
        console.log(JSON.stringify(computeFreshTable(), null, 2))
      }

      expect(sizeDiff).toBeLessThanOrEqual(1e-6)
      expect(areaDiff).toBeLessThanOrEqual(1e-6)
    }
  }, 20000)
})
