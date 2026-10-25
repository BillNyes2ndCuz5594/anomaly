import { describe, expect, it } from 'vitest'
import * as THREE from 'three/webgpu'
import { limbGeometry } from './builder'
import { LAB_SPECIMENS, SCUTE_SEEDS, scuteAt, specimenGeo } from './creatures'
import { humanModel, ORGAN_LIST } from './human'
import { litSpecimen } from '../materials/tinted'

const SPECIMEN_IDS = [
  ...LAB_SPECIMENS,
  'largemouth-bass',
  'florida-panther',
  'barred-owl',
  'american-alligator',
  'grasshopper',
  'garden-spider',
]

/** Mean and 95th percentile of the worst angle (degrees) between a triangle's face normal and its vertex normals. */
function normalDeviation(geo: THREE.BufferGeometry): { mean: number; p95: number } {
  const pos = geo.getAttribute('position')
  const nor = geo.getAttribute('normal')
  const idx = geo.index!
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  const f = new THREE.Vector3()
  const n = new THREE.Vector3()
  const angles: number[] = []
  for (let i = 0; i < idx.count; i += 3) {
    const [ia, ib, ic] = [idx.getX(i), idx.getX(i + 1), idx.getX(i + 2)]
    a.fromBufferAttribute(pos, ia)
    b.fromBufferAttribute(pos, ib)
    c.fromBufferAttribute(pos, ic)
    f.copy(b).sub(a).cross(c.clone().sub(a))
    if (f.lengthSq() < 1e-14) continue
    f.normalize()
    let worst = 0
    for (const v of [ia, ib, ic]) {
      n.fromBufferAttribute(nor, v)
      worst = Math.max(worst, (Math.acos(Math.min(1, Math.max(-1, n.dot(f)))) * 180) / Math.PI)
    }
    angles.push(worst)
  }
  angles.sort((x, y) => x - y)
  return { mean: angles.reduce((s, x) => s + x, 0) / angles.length, p95: angles[Math.floor(angles.length * 0.95)] }
}

function expectSmooth(geo: THREE.BufferGeometry, label: string) {
  expect(geo.index, `${label} is indexed`).not.toBeNull()
  const verts = geo.getAttribute('position').count
  // Shared vertices: a flat shaded, non indexed mesh would have three vertices per triangle.
  expect(verts, `${label} shares vertices`).toBeLessThan(geo.index!.count * 0.7)
  const nor = geo.getAttribute('normal')
  const n = new THREE.Vector3()
  for (let i = 0; i < nor.count; i++) {
    n.fromBufferAttribute(nor, i)
    expect(Number.isFinite(n.x + n.y + n.z)).toBe(true)
    expect(Math.abs(n.length() - 1), `${label} normal ${i} is unit length`).toBeLessThan(1e-3)
  }
  const dev = normalDeviation(geo)
  // Smoothed normals lean away from the face normal (flat shading would give exactly 0), but stay sane.
  expect(dev.mean, `${label} is not flat shaded`).toBeGreaterThan(1)
  expect(dev.mean, `${label} mean normal deviation`).toBeLessThan(30)
  expect(dev.p95, `${label} p95 normal deviation`).toBeLessThan(80)
}

describe('limb builder', () => {
  it('makes a closed, indexed, smooth tube with outward normals', () => {
    const g = limbGeometry([[0, 0, 0], [0, 1, 0], [0, 2, 0]], [0.3, 0.5, 0.3])
    expectSmooth(g, 'limb')
    g.computeBoundingBox()
    const box = g.boundingBox!
    // Rounded caps extend past the end points; width follows the radii.
    expect(box.min.y).toBeLessThan(-0.2)
    expect(box.max.y).toBeGreaterThan(2.2)
    expect(box.max.x).toBeGreaterThan(0.45)
    expect(box.max.x).toBeLessThan(0.55)
    const pos = g.getAttribute('position')
    const nor = g.getAttribute('normal')
    for (let i = 0; i < pos.count; i++) {
      const out = new THREE.Vector3(pos.getX(i), 0, pos.getZ(i))
      if (out.length() < 0.05) continue
      expect(out.dot(new THREE.Vector3(nor.getX(i), 0, nor.getZ(i)))).toBeGreaterThan(0)
    }
  })

  it('keeps elliptical sections: width on the first axis, height on the second', () => {
    const g = limbGeometry([[-1, 0, 0], [0, 0, 0], [1, 0, 0]], [[0.8, 0.2], [0.8, 0.2], [0.8, 0.2]])
    g.computeBoundingBox()
    const s = g.boundingBox!.getSize(new THREE.Vector3())
    expect(s.z).toBeGreaterThan(1.5)
    expect(s.y).toBeLessThan(0.5)
  })
})

describe('specimen models', () => {
  for (const id of SPECIMEN_IDS) {
    it(`${id} is smooth, merged and sanely sized`, () => {
      const { geo, size } = specimenGeo(id)
      expectSmooth(geo, id)
      expect(geo.getAttribute('color')).toBeDefined()
      expect(geo.getAttribute('uv')).toBeDefined()
      const verts = geo.getAttribute('position').count
      expect(verts).toBeGreaterThan(800)
      expect(verts).toBeLessThan(40000)
      for (const d of size) {
        expect(d).toBeGreaterThan(0.3)
        expect(d).toBeLessThan(12)
      }
      // Grounded: lowest point at y = 0, and centered on x and z.
      geo.computeBoundingBox()
      expect(Math.abs(geo.boundingBox!.min.y)).toBeLessThan(1e-4)
      expect(Math.abs(geo.boundingBox!.min.x + geo.boundingBox!.max.x)).toBeLessThan(1e-3)
    })
  }

  it('builds the panther long and low and the crab wide and flat', () => {
    const [px, py] = specimenGeo('florida-panther').size
    expect(px).toBeGreaterThan(py * 2.2)
    const [cx, cy, cz] = specimenGeo('blue-crab').size
    expect(Math.max(cx, cz)).toBeGreaterThan(cy * 3)
  })

  it('finds scute plates and seams on the tortoise shell', () => {
    const [ax, az] = SCUTE_SEEDS[0]
    const mid = scuteAt(ax, az)
    expect(mid.id).toBe(0)
    expect(mid.center).toBeCloseTo(0, 6)
    expect(mid.edge).toBeGreaterThan(0.1)
    // Halfway between two plate centers sits on a seam.
    const [bx, bz] = SCUTE_SEEDS[1]
    const seam = scuteAt((ax + bx) / 2, (az + bz) / 2, [SCUTE_SEEDS[0], SCUTE_SEEDS[1]])
    expect(seam.edge).toBeCloseTo(0, 6)
    // Every point of the shell belongs to some plate.
    for (const [x, z] of [[0.9, 0.1], [-0.3, 0.8], [0, -0.95]]) expect(scuteAt(x, z).id).toBeGreaterThanOrEqual(0)
  })

  it('uses a smooth lit material with no flat shading', () => {
    const m = litSpecimen()
    expect(m.flatShading).toBe(false)
    expect(m.vertexColors).toBe(true)
  })
})

describe('human hologram model', () => {
  const model = humanModel()
  const skin = model.skin
  skin.computeBoundingBox()
  const sb = skin.boundingBox!

  it('has a smooth shell of natural height with arms angled away from the body', () => {
    expectSmooth(skin, 'skin')
    const h = sb.max.y - sb.min.y
    expect(h).toBeGreaterThan(6.2)
    expect(h).toBeLessThan(7.0)
    expect(Math.abs(sb.min.y)).toBeLessThan(0.05)
    // Hands hang clear of the hips (arms are not straight down against the torso).
    expect(sb.max.x).toBeGreaterThan(1.7)
    expect(sb.max.x).toBeLessThan(2.2)
  })

  it('has every organ target, smooth and inside the body', () => {
    const ids = ORGAN_LIST.filter((o) => o.id !== 'skin').map((o) => o.id)
    expect(ids.length).toBe(14)
    for (const id of ids) {
      const o = model.organs.get(id)
      expect(o, id).toBeDefined()
      expectSmooth(o!.geo, id)
      const [x, y, z] = o!.center
      expect(Math.abs(x), `${id} x`).toBeLessThan(sb.max.x * 0.5)
      expect(y, `${id} y`).toBeGreaterThan(sb.min.y + 2.3)
      expect(y, `${id} y`).toBeLessThan(sb.max.y)
      expect(z, `${id} z`).toBeGreaterThan(sb.min.z)
      expect(z, `${id} z`).toBeLessThan(sb.max.z)
    }
  })

  it('places organs where they belong', () => {
    const c = (id: string) => model.organs.get(id)!.center
    // Head organs above the neck, torso organs below it.
    for (const id of ['brain', 'eyes', 'ears', 'nose', 'tongue']) expect(c(id)[1], id).toBeGreaterThan(5.6)
    for (const id of ['lungs', 'heart', 'liver', 'stomach', 'pancreas', 'small-intestine', 'large-intestine', 'kidneys', 'bladder']) expect(c(id)[1], id).toBeLessThan(5.4)
    // Lungs above the liver, stomach and intestines; bladder lowest; brain above the eyes above the nose above the tongue.
    expect(c('lungs')[1]).toBeGreaterThan(c('liver')[1])
    expect(c('heart')[1]).toBeGreaterThan(c('stomach')[1])
    expect(c('stomach')[1]).toBeGreaterThan(c('small-intestine')[1])
    expect(c('bladder')[1]).toBeLessThan(c('small-intestine')[1])
    expect(c('brain')[1]).toBeGreaterThan(c('eyes')[1])
    expect(c('eyes')[1]).toBeGreaterThan(c('nose')[1])
    expect(c('nose')[1]).toBeGreaterThan(c('tongue')[1])
    // Liver on the body's right (screen left, -x), stomach and heart apex to the left (+x).
    expect(c('liver')[0]).toBeLessThan(0)
    expect(c('stomach')[0]).toBeGreaterThan(0)
    expect(c('heart')[0]).toBeGreaterThan(0)
    // Kidneys sit behind the front organs.
    expect(c('kidneys')[2]).toBeLessThan(c('stomach')[2])
  })

  it('keeps the head organs small and inside the face so the silhouette reads', () => {
    const size = (id: string) => {
      const g = model.organs.get(id)!.geo
      g.computeBoundingBox()
      return g.boundingBox!.getSize(new THREE.Vector3())
    }
    const head = (id: string) => {
      const o = model.organs.get(id)!
      o.geo.computeBoundingBox()
      return o.geo.boundingBox!.clone().translate(new THREE.Vector3(...o.center))
    }
    // Eyes: two small spheres, well under the head width. Ears: out at the sides of the head.
    expect(size('eyes').y).toBeLessThan(0.2)
    expect(size('eyes').x).toBeLessThan(0.6)
    expect(head('ears').max.x).toBeGreaterThan(0.4)
    expect(head('ears').max.x).toBeLessThan(0.55)
    // Brain stays under the skull top (head spine ends near 6.77) and inside its width.
    expect(head('brain').max.y).toBeLessThan(6.7)
    expect(size('brain').x).toBeLessThan(0.6)
  })

  it('keeps the model box that the camera fit uses around everything', () => {
    for (const o of model.organs.values()) {
      o.geo.computeBoundingBox()
      const b = o.geo.boundingBox!.clone().translate(new THREE.Vector3(...o.center))
      expect(b.min.x).toBeGreaterThanOrEqual(model.box.min[0] - 1e-3)
      expect(b.max.y).toBeLessThanOrEqual(model.box.max[1] + 1e-3)
    }
  })
})
