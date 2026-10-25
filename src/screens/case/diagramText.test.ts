import { describe, expect, it } from 'vitest'
import { content } from '../../content/schema'
import { TEXT_SCALE } from '../../state/settings'
import { sceneLabelSpecs } from './diagramLabels'
import { BASE_H, BASE_W, MIN_LABEL_PX, baseScale, intersects, labelSize, layoutLabels, textWidth, viewBoxFor, wrapText } from './diagramText'

describe('diagram label sizing', () => {
  it('renders Normal text at no less than the minimum px size', () => {
    for (const scale of [0.8, 1, 1.35, 1.7, 2.4]) {
      const size = labelSize(scale, 1)
      expect(size * scale).toBeGreaterThanOrEqual(MIN_LABEL_PX - 0.01)
    }
  })
  it('scales rendered size with the text scale setting', () => {
    const base = labelSize(1.5, 1) * 1.5
    expect(labelSize(1.5, 1.15) * 1.5).toBeCloseTo(base * 1.15, 1)
    expect(labelSize(1.5, 1.3) * 1.5).toBeCloseTo(base * 1.3, 1)
  })
  it('base scale is the meet scale of the 400x220 art', () => {
    expect(baseScale(800, 440)).toBe(2)
    expect(baseScale(800, 800)).toBe(2)
    expect(baseScale(2000, 220)).toBe(1)
    expect(baseScale(0, 0)).toBe(1)
  })
  it('viewBox matches the panel aspect and still contains the base art', () => {
    for (const [w, h] of [[675, 421], [900, 400], [400, 400], [1000, 300]]) {
      const vb = viewBoxFor(w, h)
      expect(vb.w / vb.h).toBeCloseTo(w / h, 3)
      expect(vb.x).toBeLessThanOrEqual(0)
      expect(vb.y).toBeLessThanOrEqual(0)
      expect(vb.x + vb.w).toBeGreaterThanOrEqual(BASE_W)
      expect(vb.y + vb.h).toBeGreaterThanOrEqual(BASE_H)
    }
  })
})

describe('wrapText', () => {
  it('breaks at the colon and at spaces', () => {
    expect(wrapText('Group 1: water only', 10, 999)).toEqual(['Group 1', 'water only'])
    expect(wrapText('water + plant food', 10, textWidth('water + plant', 10))).toEqual(['water + plant', 'food'])
    expect(wrapText('Sun', 10, 5)).toEqual(['Sun'])
  })
})

describe('every scene diagram label layout', () => {
  const scenes = content.items.filter((i) => i.visual.kind === 'scene').map((i) => (i.visual.kind === 'scene' ? i.visual : null)!)
  const defaults = [...scenes, { id: 'ocean-evaporation', labels: [] as string[] }]
  // rendered px per viewBox unit from a narrow laptop panel to a big one, with the panel aspect varying
  const boxes: [number, number][] = [[560, 340], [675, 421], [900, 520], [1100, 560]]
  for (const ts of Object.values(TEXT_SCALE)) {
    for (const [w, h] of boxes) {
      it(`keeps labels inside the view and apart at text x${ts} in ${w}x${h}`, () => {
        const vb = viewBoxFor(w, h)
        const size = labelSize(baseScale(w, h), ts)
        for (const v of defaults) {
          const placed = layoutLabels(sceneLabelSpecs(v.id, v.labels), size, vb)
          for (const p of placed) {
            expect(p.box.x0, `${v.id}/${p.key}`).toBeGreaterThanOrEqual(vb.x)
            expect(p.box.x1, `${v.id}/${p.key}`).toBeLessThanOrEqual(vb.x + vb.w)
            expect(p.box.y0, `${v.id}/${p.key}`).toBeGreaterThanOrEqual(vb.y)
            expect(p.box.y1, `${v.id}/${p.key}`).toBeLessThanOrEqual(vb.y + vb.h)
          }
          for (let i = 0; i < placed.length; i++)
            for (let j = i + 1; j < placed.length; j++) expect(intersects(placed[i].box, placed[j].box), `${v.id}: ${placed[i].key} vs ${placed[j].key}`).toBe(false)
        }
      })
    }
  }
})
