import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three/webgpu'
import { acornSet, fitOrgan, kidneyPair, ORGAN_SCAN_IDS, sprigCluster } from './labScans'
import { humanModel } from './human'
import { oakLeafEnds, OAK_ACORNS } from './labB'

const shaded = (g: THREE.BufferGeometry) => {
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count * 3).fill(0.8), 3))
  for (const a of ['normal', 'uv']) g.deleteAttribute(a)
  return g
}

describe('lab scans', () => {
  it('ships both scan packs', () => {
    expect(existsSync(new URL('../../assets/scans/organ-scans.glb', import.meta.url))).toBe(true)
    expect(existsSync(new URL('../../assets/scans/oak-scans.glb', import.meta.url))).toBe(true)
  })

  it('every scanned organ has a procedural organ and fits exactly in its box', () => {
    const organs = humanModel(false).organs
    for (const id of ORGAN_SCAN_IDS.filter((o) => o !== 'kidneys')) {
      const def = organs.get(id)
      expect(def, id).toBeTruthy()
      const proc = def!.geo
      proc.computeBoundingBox()
      const fit = fitOrgan(shaded(new THREE.SphereGeometry(3, 8, 6).translate(5, 1, -2)), proc)
      const a = fit.boundingBox!
      const b = proc.boundingBox!
      for (const k of ['x', 'y', 'z'] as const) {
        expect(a.min[k]).toBeCloseTo(b.min[k], 4)
        expect(a.max[k]).toBeCloseTo(b.max[k], 4)
      }
      expect(fit.getAttribute('normal')).toBeTruthy()
    }
  })

  it('builds the kidney pair from one scan inside the procedural kidneys region', () => {
    const def = humanModel(false).organs.get('kidneys')!
    def.geo.computeBoundingBox()
    const b = def.geo.boundingBox!
    const scan = new THREE.SphereGeometry(1, 10, 8)
    scan.setAttribute('color', new THREE.BufferAttribute(new Float32Array(scan.getAttribute('position').count * 3).fill(0.8), 3))
    const pair = kidneyPair(scan, def.center)
    const a = pair.boundingBox!
    for (const k of ['x', 'y', 'z'] as const) {
      expect(a.min[k], k).toBeGreaterThan(b.min[k] - 0.08)
      expect(a.max[k], k).toBeLessThan(b.max[k] + 0.08)
    }
    // one kidney each side of the spine
    expect(a.min.x + def.center[0]).toBeLessThan(-0.5)
    expect(a.max.x + def.center[0]).toBeGreaterThan(0.5)
  })

  it('grows sprigs from every leaf cluster and keeps them near it', () => {
    const ends = oakLeafEnds()
    const sprig = shaded(new THREE.BoxGeometry(0.1, 1, 0.05))
    const geo = sprigCluster(sprig, ends, 3)
    expect(geo.getAttribute('position').count).toBe(sprig.getAttribute('position').count * ends.length * 3)
    geo.computeBoundingBox()
    const span = new THREE.Box3()
    for (const [c, r] of ends) span.expandByPoint(new THREE.Vector3(...c).addScalar(r * 1.6)).expandByPoint(new THREE.Vector3(...c).addScalar(-r * 1.6))
    expect(span.containsBox(geo.boundingBox!)).toBe(true)
  })

  it('puts one acorn and stalk on every acorn spot', () => {
    const geo = acornSet(shaded(new THREE.SphereGeometry(1, 8, 6)))
    geo.computeBoundingBox()
    const ys = OAK_ACORNS.map((p) => p[1])
    expect(geo.boundingBox!.min.y).toBeCloseTo(Math.min(...ys) - 0.15, 2)
    expect(geo.getAttribute('color').itemSize).toBe(3)
  })
})
