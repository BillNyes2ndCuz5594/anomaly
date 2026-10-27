import { describe, expect, it } from 'vitest'
import { animalParts, plantParts, type PartGeo } from './creatures'

const tris = (p: PartGeo) => (p.geo.index ? p.geo.index.count : p.geo.getAttribute('position').count) / 3

/** World-ish box of all parts (the geometry is recentered, so add each part center back). */
function box(parts: PartGeo[]): { min: number[]; max: number[] } {
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (const p of parts) {
    p.geo.computeBoundingBox()
    const b = p.geo.boundingBox!
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], b.min.getComponent(i) + p.center[i])
      max[i] = Math.max(max[i], b.max.getComponent(i) + p.center[i])
    }
  }
  return { min, max }
}

describe('Lab B holograms', () => {
  it('keeps the part ids and gives every part geometry with normals', () => {
    expect(animalParts().map((p) => p.id)).toEqual(['skin', 'skeleton'])
    expect(plantParts().map((p) => p.id)).toEqual(['root', 'stem', 'bark', 'leaf', 'flower', 'fruit', 'seed', 'spore'])
    for (const p of [...animalParts(), ...plantParts()]) {
      expect(tris(p), p.id).toBeGreaterThan(20)
      expect(p.geo.getAttribute('normal'), p.id).toBeDefined()
      expect(p.center.every(Number.isFinite), p.id).toBe(true)
    }
  })

  it('stays inside the frame the camera rig is fit to, and fills the pedestal', () => {
    const a = box(animalParts())
    const p = box(plantParts())
    console.log('animal', a.min.map((v) => v.toFixed(2)), a.max.map((v) => v.toFixed(2)))
    console.log('plant', p.min.map((v) => v.toFixed(2)), p.max.map((v) => v.toFixed(2)))
    // animal at x -3.4, plant at x 3.4; view box x -5.9..5.7, y -1.5..3.7, z -2.4..2.4
    expect(a.min[0] - 3.4).toBeGreaterThan(-5.8)
    expect(a.max[0] - 3.4).toBeLessThan(5.65)
    expect(a.max[1]).toBeLessThan(3.6)
    expect(a.min[1]).toBeGreaterThan(-0.05)
    expect(a.max[0] - a.min[0]).toBeGreaterThan(3.8)
    expect(p.min[0] + 3.4).toBeGreaterThan(-5.8)
    expect(p.max[0] + 3.4).toBeLessThan(5.65)
    expect(p.max[1]).toBeLessThan(3.6)
    expect(p.min[1]).toBeGreaterThan(-1.45)
    expect(p.max[0] - p.min[0]).toBeGreaterThan(3.6)
  })

  it('the skeleton sits inside the skin silhouette and the Low tier build is lighter', () => {
    const hi = animalParts().reduce((n, p) => n + tris(p), 0) + plantParts().reduce((n, p) => n + tris(p), 0)
    const lo = animalParts(0.6).reduce((n, p) => n + tris(p), 0) + plantParts(0.6).reduce((n, p) => n + tris(p), 0)
    console.log('tris hi/lo', hi, lo)
    expect(lo).toBeLessThan(hi)
    expect(hi).toBeLessThan(150000)
    const skin = animalParts()[0]
    const bones = animalParts()[1]
    skin.geo.computeBoundingBox()
    bones.geo.computeBoundingBox()
    // the skeleton's chest and spine live within the body's height (antlers may rise above the head)
    expect(bones.geo.boundingBox!.min.y + bones.center[1]).toBeGreaterThan(skin.geo.boundingBox!.min.y + skin.center[1] - 0.05)
  })
})
