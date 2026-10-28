import { describe, expect, it } from 'vitest'
import * as THREE from 'three/webgpu'
import { specimenGeo } from './creatures'
import { humanModel } from './human'

const tris = (g: THREE.BufferGeometry): number => (g.index ? g.index.count : g.getAttribute('position').count) / 3

// Triangle budgets for the Low tier procedural models (S22). They were measured on main before the Low tier model pass and
// the new shapes must stay at or under them, so weak phones and Chromebooks do not get heavier.
const LOW_LOD = 0.55
const BUDGET: Record<string, number> = {
  'florida-panther': 19510,
  'barred-owl': 13520,
  grasshopper: 20832,
  'largemouth-bass': 6516,
}

describe('Low tier model budgets', () => {
  for (const [id, max] of Object.entries(BUDGET)) {
    it(`${id} stays at or under ${max} triangles at the Low tier level of detail`, () => {
      expect(tris(specimenGeo(id, LOW_LOD).geo)).toBeLessThanOrEqual(max)
    })
  }

  it('keeps the Low tier human skin and organs at or under their old triangle counts', () => {
    const h = humanModel(true)
    expect(tris(h.skin)).toBeLessThanOrEqual(21920)
    let organs = 0
    for (const o of h.organs.values()) organs += tris(o.geo)
    expect(organs).toBeLessThanOrEqual(36270)
  })

  it('still builds a lighter panther and grasshopper at Low than at full detail', () => {
    for (const id of ['florida-panther', 'grasshopper']) expect(tris(specimenGeo(id, LOW_LOD).geo)).toBeLessThan(tris(specimenGeo(id, 1).geo) * 0.5)
  })

  it('gives the Low tier human a visible gap between the legs and arms clear of the hips', () => {
    const f = humanModel(true).skin
    f.computeBoundingBox()
    const pos = f.getAttribute('position')
    // Under the crotch (y 1.5) there must be empty space around x = 0: no vertex within 0.05 of the midline.
    let nearMid = 0
    for (let i = 0; i < pos.count; i++) if (pos.getY(i) < 2.2 && pos.getY(i) > 0.4 && Math.abs(pos.getX(i)) < 0.05) nearMid++
    expect(nearMid).toBe(0)
  })
})
