import { describe, expect, it } from 'vitest'
import { MIN_PAIR_RATIO, MIN_ROW_RATIO, SPECIMEN_LENGTH_M, pairRatios } from './specimenSizes'
import { LAB_SPECIMENS, specimenGeo } from './creatures'
import { SCAN_HEIGHT, pairSizing, placeEvidence, shapeReach, specimenScale } from './specimenBox'
import { fitPoints, projectPoints, type V3 } from '../fit'
import raw from '../../content/anomaly-content.json'

const pairs: string[][] = []
;(function walk(o: unknown) {
  if (o && typeof o === 'object') {
    const v = (o as { visual?: { kind?: string; ids?: string[] } }).visual
    if (v?.kind === 'specimen' && v.ids) pairs.push(v.ids)
    for (const k of Object.keys(o)) walk((o as Record<string, unknown>)[k])
  }
})(raw)

describe('specimen sizes', () => {
  it('has a real length for every specimen used in content and the lab', () => {
    for (const id of [...pairs.flat(), ...LAB_SPECIMENS]) expect(SPECIMEN_LENGTH_M[id], id).toBeGreaterThan(0)
  })

  it('keeps the true ratio when it is above the cap and no tag is needed', () => {
    const r = pairRatios(['manatee', 'bull-shark'])
    expect(r.ratios[0]).toBe(1)
    expect(r.ratios[1]).toBeCloseTo(2.4 / 3.0, 5)
    expect(r.notToScale).toBe(false)
    expect(pairRatios(['grasshopper', 'garden-spider']).notToScale).toBe(false)
  })

  it('lifts a very small animal to the cap and flags it', () => {
    const r = pairRatios(['manatee', 'largemouth-bass'])
    expect(r.ratios).toEqual([1, MIN_PAIR_RATIO])
    expect(r.notToScale).toBe(true)
    const four = pairRatios(['bull-shark', 'blue-crab', 'gopher-tortoise', 'manatee'])
    expect(four.ratios[3]).toBe(1)
    expect(four.ratios[0]).toBeCloseTo(0.8, 5)
    expect(MIN_PAIR_RATIO).toBeGreaterThanOrEqual(0.35)
    expect(MIN_PAIR_RATIO).toBeLessThanOrEqual(0.5)
    expect(four.ratios[1]).toBe(MIN_ROW_RATIO)
    expect(four.ratios[2]).toBe(MIN_ROW_RATIO)
    expect(four.notToScale).toBe(true)
  })

  it('never reorders sizes: a truly larger animal is never drawn smaller', () => {
    for (const ids of pairs) {
      const { ratios } = pairRatios(ids)
      ids.forEach((a, i) => ids.forEach((b, j) => SPECIMEN_LENGTH_M[a] > SPECIMEN_LENGTH_M[b] && expect(ratios[i]).toBeGreaterThanOrEqual(ratios[j])))
    }
  })

  it('leaves a single specimen alone', () => {
    expect(pairRatios(['largemouth-bass'])).toEqual({ ratios: [1], notToScale: false })
    expect(pairSizing(['largemouth-bass'], 3).fits).toEqual([1])
  })

  it('draws every content pair at the capped ratio of its drawn lengths', () => {
    for (const ids of pairs.filter((p) => p.length > 1)) {
      const { fits } = pairSizing(ids, 3)
      expect(Math.max(...fits)).toBeCloseTo(1, 6)
      const { ratios } = pairRatios(ids)
      const drawn = ids.map((id, i) => shapeReach(id) * specimenScale(id, 3 * fits[i]))
      const anchor = ratios.indexOf(1)
      ids.forEach((_, i) => expect(drawn[i] / drawn[anchor], ids.join()).toBeCloseTo(ratios[i], 4))
    }
  })

  it('fits every pair tallest specimen inside the canvas margin', () => {
    // Same margin and elevation rule as the evidence canvas. 1.7 to 1.85 is the wide panel where a tall scan used to touch the top.
    const aspects = [0.55, 1.7, 1.85, 2.2]
    const views = [
      { yaw: -0.62, sway: 0.02 },
      { yaw: -0.55, sway: 0.3 },
    ]
    expect(SCAN_HEIGHT).toBeGreaterThanOrEqual(1.05)
    // Procedural reach, and the narrow horizontal reach of a tall scan (the pelican's bill stands above a short footprint).
    const reaches = [undefined, (id: string) => Math.min(specimenGeo(id).size[0], specimenGeo(id).size[2])] as const
    for (const ids of pairs.filter((p) => p.length > 1)) {
      for (const view of views) {
        for (const reachOf of reaches) {
          const { placed, points } = placeEvidence(ids, 3, view.yaw, view.sway, reachOf)
          let tallest = placed[0]
          let tallH = 0
          for (const s of placed) {
            const h = specimenGeo(s.id).size[1] * specimenScale(s.id, s.fit)
            if (h >= tallH) {
              tallH = h
              tallest = s
            }
          }
          const head: V3 = [tallest.x, tallH * SCAN_HEIGHT, 0]
          for (const aspect of aspects) {
            const elevation = aspect < 1.9 ? 0.42 : 0.28
            const pose = fitPoints(points, { fovDeg: 35, aspect, margin: 0.14, elevation })
            const e = projectPoints([head], pose.position, pose.target, 35, aspect)
            const over = Math.max(e.maxX - 1, -1 - e.minX, e.maxY - 1, -1 - e.minY)
            expect(over, `${ids.join('+')} @ ${aspect}`).toBeLessThanOrEqual(-0.02)
          }
        }
      }
    }
  })
})
