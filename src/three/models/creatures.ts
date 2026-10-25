import * as THREE from 'three/webgpu'
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'
import { Builder, countershade, getBuilderLod, setBuilderLod, groundCenter, lerpHex, mottle, paintWith, recenter, smooth, spineAt, type V3 } from './builder'

import { alignX, bassModel, DARK, crabModel, eye, fin, frogModel, gatorModel, manateeModel, mirrorZ, pantherModel, paw, pelicanModel, sharkModel, spiderModel, toes } from './animals'

// ---------- Lab B: dog-like mammal and flowering tree ----------

export interface PartGeo {
  id: string
  geo: THREE.BufferGeometry
  /** Center of the part, for light bridges. Geometry is recentered on the origin. */
  center: V3
}

function finish(id: string, b: Builder): PartGeo {
  const geo = b.build()
  return { id, geo, center: recenter(geo) }
}

function buildAnimal(): PartGeo[] {
  const skin = new Builder()
  skin
    .capsule(0.55, 1.3, { p: [0, 1.55, 0], r: [0, 0, Math.PI / 2], s: [1, 1, 0.85] }, 14)
    .sphere(0.6, { p: [0.55, 1.6, 0], s: [1, 1.05, 0.85] }, 12, 8)
    .sphere(0.56, { p: [-0.6, 1.55, 0], s: [1, 1, 0.9] }, 12, 8)
    .capsule(0.3, 0.4, { p: [1.15, 2.0, 0], r: [0, 0, -0.9] }, 10)
    .sphere(0.43, { p: [1.5, 2.35, 0], s: [1.1, 0.95, 0.9] }, 12, 8)
    .capsule(0.2, 0.35, { p: [1.98, 2.24, 0], r: [0, 0, Math.PI / 2], s: [1, 1, 0.9] }, 8)
    .sphere(0.09, { p: [2.22, 2.28, 0] }, 8, 6)
    .cone(0.17, 0.42, { p: [1.36, 2.82, 0.3], r: [0.25, 0, 0.35] }, 6)
    .cone(0.17, 0.42, { p: [1.36, 2.82, -0.3], r: [-0.25, 0, 0.35] }, 6)
    .capsule(0.1, 0.7, { p: [-1.3, 2.05, 0], r: [0, 0, 0.95] }, 6)
  for (const x of [0.85, -0.85]) {
    for (const z of [0.32, -0.32]) {
      skin
        .capsule(0.18, 0.5, { p: [x, 0.95, z] }, 8)
        .capsule(0.14, 0.4, { p: [x, 0.38, z] }, 8)
        .sphere(0.2, { p: [x + 0.08, 0.1, z], s: [1.3, 0.6, 1] }, 8, 6)
    }
  }

  const bones = new Builder()
  bones
    .sphere(0.3, { p: [1.5, 2.35, 0], s: [1.15, 0.9, 0.8] }, 10, 7)
    .capsule(0.1, 0.3, { p: [1.92, 2.22, 0], r: [0, 0, Math.PI / 2] }, 6)
    .tube([[1.3, 2.1, 0], [0.6, 1.95, 0], [-0.5, 1.9, 0], [-1.15, 1.95, 0]], 0.06, {}, 24, 6)
    .tube([[-1.15, 1.95, 0], [-1.45, 2.2, 0], [-1.7, 2.5, 0]], 0.04, {}, 10, 5)
    .sphere(0.26, { p: [-0.85, 1.75, 0], s: [0.8, 1, 0.9] }, 8, 6)
  for (const x of [0.65, 0.35, 0.05, -0.25, -0.5]) bones.torus(0.42, 0.04, { p: [x, 1.6, 0], r: [0, Math.PI / 2, 0], s: [1, 1, 1] }, 5, 14)
  for (const x of [0.85, -0.85]) {
    for (const z of [0.32, -0.32]) {
      bones.seg([x, 1.4, z], [x, 0.7, z], 0.07, undefined, 0.05).seg([x, 0.7, z], [x, 0.14, z], 0.05, undefined, 0.05)
    }
  }
  return [finish('skin', skin), finish('skeleton', bones)]
}

function buildPlant(): PartGeo[] {
  const root = new Builder()
  root
    .tube([[0, 0, 0], [0, -0.5, 0], [0.05, -1.3, 0]], 0.07, {}, 12, 5)
    .tube([[0, -0.1, 0], [-0.45, -0.5, 0.1], [-0.95, -0.85, 0.1]], 0.06, {}, 12, 5)
    .tube([[0, -0.1, 0], [0.45, -0.5, -0.1], [0.95, -0.9, 0]], 0.06, {}, 12, 5)
    .tube([[0, -0.3, 0], [-0.3, -0.8, -0.2], [-0.55, -1.2, -0.2]], 0.04, {}, 10, 5)
    .tube([[0, -0.3, 0], [0.3, -0.85, 0.2], [0.5, -1.25, 0.25]], 0.04, {}, 10, 5)

  const stem = new Builder()
  stem
    .cyl(0.13, 0.19, 2.7, { p: [0, 1.35, 0] }, 8)
    .tube([[0, 1.9, 0], [-0.4, 2.35, 0.05], [-0.95, 2.75, 0.1]], 0.07, {}, 14, 5)
    .tube([[0, 2.0, 0], [0.45, 2.4, -0.05], [0.95, 2.7, 0]], 0.07, {}, 14, 5)
    .tube([[0, 2.5, 0], [0.1, 2.9, 0.3], [0.25, 3.2, 0.55]], 0.05, {}, 12, 5)
    .tube([[0, 2.5, 0], [-0.15, 2.95, -0.25], [-0.3, 3.3, -0.45]], 0.05, {}, 12, 5)

  const bark = new Builder()
  bark.cyl(0.22, 0.32, 1.5, { p: [0, 0.75, 0] }, 7).torus(0.27, 0.035, { p: [0, 0.55, 0], r: [Math.PI / 2, 0, 0] }, 4, 7).torus(0.25, 0.035, { p: [0, 1.0, 0], r: [Math.PI / 2, 0, 0] }, 4, 7)

  const leaf = new Builder()
  const leaves: [V3, number][] = [
    [[-1.15, 2.85, 0.1], 0.35],
    [[-0.75, 3.05, 0.35], -0.2],
    [[1.15, 2.8, 0], -0.35],
    [[0.75, 3.0, -0.3], 0.2],
    [[0.35, 3.4, 0.6], -0.3],
    [[-0.45, 3.45, -0.5], 0.3],
    [[0, 3.1, 0.5], 0],
    [[-0.5, 2.35, 0.4], 0.15],
    [[0.55, 2.4, -0.35], -0.15],
    [[0.2, 3.3, -0.3], 0.1],
  ]
  for (const [p, rz] of leaves) leaf.sphere(0.4, { p, s: [1.1, 0.17, 0.6], r: [0.2, rz * 2, rz] }, 8, 5)

  const flower = new Builder()
  flower.sphere(0.13, { p: [0.28, 3.3, 0.58] }, 8, 6)
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    flower.sphere(0.17, { p: [0.28 + Math.cos(a) * 0.27, 3.3 + Math.sin(a) * 0.27, 0.58], s: [1, 0.55, 0.3], r: [0, 0, a] }, 8, 5)
  }

  const fruit = new Builder()
  const fruitPos: V3[] = [[0.9, 2.55, 0.18], [-0.85, 2.6, 0.3], [0.25, 2.65, 0.5]]
  for (const p of fruitPos) fruit.sphere(0.2, { p }, 10, 8)

  const seed = new Builder()
  for (const p of fruitPos) {
    seed.sphere(0.045, { p: [p[0] - 0.05, p[1] + 0.03, p[2]] }, 5, 4).sphere(0.045, { p: [p[0] + 0.06, p[1] - 0.03, p[2] + 0.02] }, 5, 4)
  }

  const spore = new Builder()
  for (const [p] of [leaves[0], leaves[2], leaves[7]]) {
    for (let i = 0; i < 4; i++) spore.sphere(0.035, { p: [p[0] - 0.25 + i * 0.17, p[1] - 0.08, p[2] + (i % 2) * 0.1] }, 5, 4)
  }

  return [finish('root', root), finish('stem', stem), finish('bark', bark), finish('leaf', leaf), finish('flower', flower), finish('fruit', fruit), finish('seed', seed), finish('spore', spore)]
}

let animalCache: PartGeo[] | null = null
let plantCache: PartGeo[] | null = null
export const animalParts = () => (animalCache ??= buildAnimal())
export const plantParts = () => (plantCache ??= buildPlant())

// ---------- Tortoise shell ----------

/** Seeds of the scute plates in shell space (x along the body, z across), both in -1..1: 5 vertebral, 4 pairs of costal, a marginal ring. */
export const SCUTE_SEEDS: [number, number][] = (() => {
  const out: [number, number][] = []
  for (const x of [-0.7, -0.35, 0, 0.35, 0.7]) out.push([x, 0])
  for (const x of [-0.6, -0.2, 0.2, 0.6]) out.push([x, 0.47], [x, -0.47])
  for (let i = 0; i < 12; i++) out.push([Math.cos((i / 12) * Math.PI * 2 + 0.26) * 0.93, Math.sin((i / 12) * Math.PI * 2 + 0.26) * 0.93])
  return out
})()

/**
 * Nearest scute plate for a point in shell space, with the distance to the seam shared with the next plate
 * (0 on a seam, growing toward the middle of a plate) and the distance to the plate center.
 */
export function scuteAt(x: number, z: number, seeds: [number, number][] = SCUTE_SEEDS): { id: number; edge: number; center: number } {
  let d1 = Infinity
  let d2 = Infinity
  let id = 0
  for (let i = 0; i < seeds.length; i++) {
    const d = Math.hypot(x - seeds[i][0], z - seeds[i][1])
    if (d < d1) {
      d2 = d1
      d1 = d
      id = i
    } else if (d < d2) d2 = d
  }
  return { id, edge: (d2 - d1) / 2, center: d1 }
}

/** Domed shell with plates raised a little above dark seams, one smooth indexed surface. */
function scuteShell(b: Builder, c: V3, r: V3): void {
  let g: THREE.BufferGeometry = new THREE.SphereGeometry(1, Math.max(40, Math.round(72 * getBuilderLod())), Math.max(18, Math.round(30 * getBuilderLod())), 0, Math.PI * 2, 0, Math.PI / 2)
  g.deleteAttribute('normal')
  g.deleteAttribute('uv')
  g = mergeVertices(g, 1e-4)
  const pos = g.getAttribute('position') as THREE.BufferAttribute
  const paint = new Float32Array(pos.count * 3)
  const uv = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const sc = scuteAt(x, z)
    const raise = smooth(0.0, 0.06, sc.edge)
    const k = 1 + 0.05 * raise * smooth(0, 0.12, y + 0.02)
    pos.setXYZ(i, x * k, y * k, z * k)
    // t = plate shade 0..1, cs = seam darkness, sn = growth ring
    paint[i * 3] = (Math.sin(sc.id * 12.9898) * 43758.5453) % 1
    paint[i * 3 + 1] = 1 - raise
    paint[i * 3 + 2] = 0.5 + 0.5 * Math.sin(sc.center * 55)
  }
  g.setAttribute('paint', new THREE.BufferAttribute(paint, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  g.computeVertexNormals()
  const lo = new THREE.Color('#5b4527')
  const hi = new THREE.Color('#8e7545')
  const seam = new THREE.Color('#2a1f12')
  b.geo(g, { p: c, s: r }, (t, cs, sn, out) => {
    out.copy(lo).lerp(hi, Math.abs(t % 1) * 0.8 + sn * 0.12).lerp(seam, cs * 0.85)
  })
}

// ---------- Lab C and item visuals: stylized specimens ----------
//
// Every specimen is built from smooth, variable radius tubes (limb), ellipsoids and a few fins, merged into one
// indexed geometry with smooth normals. Colors live in the vertices: countershading, stripes and banding come from
// paint functions, so one lit material (and one draw call) covers the whole animal.

export interface SpecimenGeo {
  geo: THREE.BufferGeometry
  /** Bounding box size after grounding. */
  size: V3
}

function buildSpecimen(id: string): THREE.BufferGeometry {
  const b = new Builder()
  switch (id) {
    case 'manatee':
      manateeModel(b)
      break
    case 'brown-pelican':
      pelicanModel(b)
      break
    case 'gopher-tortoise': {
      const [rx, ry, rz, y0] = [1.4, 0.84, 1.08, 0.46]
      scuteShell(b, [0, y0, 0], [rx, ry, rz])
      // bridge and plastron rim under the shell
      b.ell([0, y0 - 0.02, 0], [rx * 1.03, 0.11, rz * 1.03], '#c6b184', [0, 0, 0], 40, 8)
      b.ell([0, y0 - 0.14, 0], [rx * 0.9, 0.17, rz * 0.88], '#9d8758', [0, 0, 0], 28, 8)
      const hide = mottle(countershade('#a89877', '#c9bb98', 0, 0.7), 0.07, 1.5, 2)
      // short thick neck into a blunt, beaked head
      b.limb([[1.05, 0.52, 0], [1.42, 0.6, 0], [1.7, 0.66, 0]], [[0.36, 0.32], [0.24, 0.22], [0.2, 0.19]], {}, { paint: hide, radial: 24, seg: 8, cap: 5 })
      b.ell([1.82, 0.67, 0], [0.26, 0.21, 0.22], '#b8a373', [0, 0, -0.1], 24, 16)
      b.ell([2.03, 0.6, 0], [0.12, 0.08, 0.14], '#8d7a50', [0, 0, -0.2], 14, 10)
      b.limb([[-1.2, 0.34, 0], [-1.6, 0.28, 0], [-1.85, 0.22, 0]], [0.15, 0.09, 0.03], { c: '#7a6844' }, { radial: 10, seg: 4, cap: 3 })
      for (const k of mirrorZ) {
        eye(b, [1.9, 0.72, k * 0.15], 0.045, [0.3, 0.3, k], '#3b3426', false, DARK, '#8d7a50')
        // forelimb: broad and flattened, armored with overlapping scales, four blunt claws
        const foreLimb: V3[] = [[0.95, 0.62, k * 0.62], [1.14, 0.36, k * 0.92], [1.28, 0.1, k * 1.0]]
        b.limb(foreLimb, [[0.3, 0.26], [0.24, 0.17], [0.25, 0.09]], {}, { paint: hide, radial: 20, seg: 7, cap: 4 })
        for (let i = 0; i < 5; i++) {
          const { p, tan } = spineAt(foreLimb, 0.14 + i * 0.17)
          b.ell([p[0] + 0.15, p[1] + 0.03, p[2] + k * 0.05], [0.045, 0.07, 0.1], i % 2 ? '#9a8658' : '#8c784d', alignX(tan), 10, 8)
        }
        toes(b, [1.36, 0.06, k * 1.0], [-0.5, -0.17, 0.17, 0.5], 0.14, 0.05, '#7a6a47', '#3d3325', k)
        // hindlimb: stout and columnar like an elephant's
        b.limb([[-0.92, 0.58, k * 0.7], [-0.98, 0.32, k * 0.9], [-1.0, 0.1, k * 0.95]], [[0.42, 0.36], [0.32, 0.28], [0.3, 0.22]], {}, { paint: hide, radial: 20, seg: 7, cap: 4 })
        paw(b, [-0.9, 0, k * 0.97], 0.24, '#8f7b52')
      }
      break
    }
    case 'green-tree-frog':
      frogModel(b)
      break
    case 'bull-shark':
      sharkModel(b)
      break
    case 'largemouth-bass':
      bassModel(b)
      break
    case 'blue-crab':
      crabModel(b)
      break
    case 'florida-panther':
      pantherModel(b)
      break
    case 'barred-owl': {
      const feather = paintWith(countershade('#6f5b45', '#d9ccb0', -0.1, 0.5), (t, cs, _sn, out) => {
        // pale bars across the chest, spots on the back
        const front = smooth(0.0, 0.5, -cs)
        const bar = smooth(0.0, 0.3, 0.5 - Math.abs(((t * 11) % 1) - 0.5)) * front
        lerpHex(out, '#e6dcc2', 0)
        lerpHex(out, '#5b4a37', bar * 0.5 * smooth(0.2, 0.9, t))
      })
      b.limb([[0, 0.35, 0], [0, 1.15, 0], [0.03, 1.95, 0]], [[0.3, 0.3], [0.6, 0.7], [0.5, 0.6]], {}, { paint: feather, radial: 24, seg: 10, cap: 6 })
      // head, facial discs, beak, eyes
      b.ell([0.06, 2.22, 0], [0.5, 0.45, 0.58], '#85705a', [0, 0, 0], 24, 16)
      for (const k of mirrorZ) {
        b.ell([0.4, 2.24, k * 0.26], [0.13, 0.34, 0.3], '#d8cbb0', [0, k * 0.1, 0], 18, 12)
        eye(b, [0.5, 2.28, k * 0.25], 0.105, [0.7, 0.1, k * 0.5], '#2a2018')
        // folded wing and a pale scapular edge
        b.limb([[0.0, 1.75, k * 0.6], [-0.15, 1.15, k * 0.68], [-0.3, 0.6, k * 0.55], [-0.5, 0.2, k * 0.4]], [[0.4, 0.1], [0.42, 0.11], [0.28, 0.08], [0.06, 0.03]], { c: '#6a5842' }, { radial: 12, seg: 6, cap: 5 })
        b.limb([[0.15, 0.4, k * 0.22], [0.16, 0.18, k * 0.22]], 0.07, { c: '#d8b44a' }, { radial: 8, seg: 3, cap: 3 })
        b.ell([0.3, 0.06, k * 0.22], [0.22, 0.05, 0.12], '#d8b44a', [0, 0, 0], 10, 6)
      }
      b.limb([[0.6, 2.18, 0], [0.74, 2.12, 0], [0.8, 2.02, 0]], [0.075, 0.06, 0.02], { c: '#e2b84c' }, { radial: 10, seg: 4, cap: 4 })
      fin(b, [[-0.35, 0.7, 0], [-0.55, 0.35, 0], [-0.75, 0.05, 0]], [0.32, 0.27, 0.06], 0.06, '#5f4e3a', 'xy')
      break
    }
    case 'american-alligator':
      gatorModel(b)
      break
    case 'grasshopper': {
      const green = paintWith(countershade('#8cc03a', '#d5e48a', -0.1, 0.5), (_t, _cs, sn, out) => lerpHex(out, '#e7e07a', smooth(0, 0.15, 0.1 - Math.abs(sn - 0.4)) * 0.8))
      b.limb([[-1.3, 0.78, 0], [-0.5, 0.8, 0], [0.3, 0.8, 0], [0.7, 0.82, 0]], [[0.06, 0.06], [0.16, 0.18], [0.18, 0.2], [0.14, 0.15]], {}, { paint: green, radial: 14, seg: 8, cap: 5 })
      b.ell([1.0, 0.83, 0], [0.26, 0.28, 0.22], '#86b838', [0, 0, 0], 16, 12)
      b.ell([0.95, 0.66, 0], [0.18, 0.1, 0.14], '#c6d86e', [0, 0, 0], 10, 8)
      for (const k of mirrorZ) {
        eye(b, [1.05, 0.95, k * 0.15], 0.1, [0.4, 0.3, k], '#e6d46e')
        b.limb([[1.15, 1.05, k * 0.06], [1.5, 1.5, k * 0.25], [1.9, 1.75, k * 0.4]], [0.025, 0.02, 0.012], { c: '#3a4a20' }, { radial: 6, seg: 5, cap: 2 })
        fin(b, [[0.4, 1.0, k * 0.1], [-0.4, 1.02, k * 0.18], [-1.1, 0.92, k * 0.2], [-1.5, 0.82, k * 0.18]], [0.1, 0.13, 0.1, 0.02], 0.015, '#b3d56a', 'xz')
        // big jumping hind leg: heavy femur, thin tibia, foot
        b.limb([[-0.15, 0.7, k * 0.2], [-0.6, 1.2, k * 0.34], [-1.3, 0.6, k * 0.36]], [0.1, 0.11, 0.045], { c: '#7da82e' }, { radial: 10, seg: 6, cap: 4 })
        b.limb([[-1.3, 0.6, k * 0.36], [-1.55, 0.25, k * 0.38], [-1.45, 0.05, k * 0.38]], [0.04, 0.03, 0.03], { c: '#587a22' }, { radial: 8, seg: 4, cap: 3 })
        b.limb([[0.5, 0.65, k * 0.15], [0.75, 0.38, k * 0.4], [0.9, 0.04, k * 0.46]], [0.05, 0.035, 0.03], { c: '#7da82e' }, { radial: 8, seg: 5, cap: 3 })
        b.limb([[0.2, 0.65, k * 0.15], [0.3, 0.32, k * 0.42], [0.18, 0.04, k * 0.5]], [0.05, 0.035, 0.03], { c: '#7da82e' }, { radial: 8, seg: 5, cap: 3 })
      }
      break
    }
    case 'garden-spider':
      spiderModel(b)
      break
    default:
      b.sphere(0.8, { c: '#7fa9c0' })
  }
  const geo = b.build()
  // The crab faces mostly toward the camera in the resting view, so its wide shell and forward claws show.
  if (id === 'blue-crab') geo.rotateY(-Math.PI / 2 + 0.42)
  return geo
}

const specimenCache = new Map<string, SpecimenGeo>()

/** Grounded, centered geometry for a specimen id (facing +x). `lod` below 1 builds a lighter mesh (Low tier). */
export function specimenGeo(id: string, lod = 1): SpecimenGeo {
  const key = `${id}@${lod}`
  let s = specimenCache.get(key)
  if (!s) {
    const prev = getBuilderLod()
    setBuilderLod(lod)
    try {
      const geo = buildSpecimen(id)
      s = { geo, size: groundCenter(geo) }
    } finally {
      setBuilderLod(prev)
    }
    specimenCache.set(key, s)
  }
  return s
}

export const LAB_SPECIMENS = ['manatee', 'brown-pelican', 'gopher-tortoise', 'green-tree-frog', 'bull-shark', 'blue-crab'] as const
