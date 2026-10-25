import type * as THREE from 'three/webgpu'
import { Builder, groundCenter, recenter, type V3 } from './builder'

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

// ---------- Lab C and item visuals: low poly specimens ----------

export interface SpecimenGeo {
  geo: THREE.BufferGeometry
  /** Bounding box size after grounding. */
  size: V3
}

const mirrorZ = [1, -1]

function fish(b: Builder, o: { body: string; belly: string; fin: string; len: number; depth: number; mouth?: boolean; stripe?: string }) {
  const L = o.len
  b.lathe(
    [[0, -L], [0.1, -L * 0.93], [0.22, -L * 0.6], [0.36, -L * 0.25], [0.5, L * 0.12], [0.52, L * 0.4], [0.44, L * 0.7], [0.26, L * 0.92], [0.1, L * 1.04], [0, L * 1.08]].map(([r, y]) => [r * o.depth, y] as [number, number]),
    { r: [0, 0, -Math.PI / 2], s: [1, 1, 0.78], c: o.body },
    10,
  )
  b.sphere(0.5, { p: [L * 0.1, -0.16 * o.depth, 0], s: [L * 0.9, 0.3 * o.depth, 0.55], c: o.belly }, 10, 6)
  b.cone(0.36 * o.depth, 0.8, { p: [L * 0.05, 0.62 * o.depth, 0], r: [0, 0, -0.5], s: [1, 1, 0.2], c: o.fin }, 6)
  b.cone(0.2 * o.depth, 0.45, { p: [-L * 0.55, 0.38 * o.depth, 0], r: [0, 0, 0.5], s: [1, 1, 0.2], c: o.fin }, 6)
  b.cone(0.3 * o.depth, 1.0, { p: [-L * 1.15, 0.38 * o.depth, 0], r: [0, 0, 1.9], s: [1, 1, 0.2], c: o.fin }, 6)
  b.cone(0.22 * o.depth, 0.75, { p: [-L * 1.12, -0.3 * o.depth, 0], r: [0, 0, 1.25], s: [1, 1, 0.2], c: o.fin }, 6)
  for (const k of mirrorZ) b.cone(0.26 * o.depth, 0.75, { p: [L * 0.28, -0.42 * o.depth, k * 0.4], r: [k * 0.35, 0, 2.0], s: [1, 1, 0.16], c: o.fin }, 5)
  for (const k of mirrorZ) b.sphere(0.06, { p: [L * 0.78, 0.14 * o.depth, k * 0.26], c: '#101820' }, 6, 5)
  if (o.stripe) b.box(L * 1.3, 0.07, 0.8, { p: [-L * 0.1, 0.08 * o.depth, 0], c: o.stripe })
}


/** Chain of tapered segments with round joints, used for tails and legs. Radii go from r[0] to r[n-1]. */
function chain(b: Builder, pts: V3[], radii: number[], c: string, sides = 7): void {
  for (let i = 0; i < pts.length - 1; i++) {
    b.seg(pts[i], pts[i + 1], radii[i], c, radii[i + 1], sides)
    b.sphere(radii[i + 1] * 1.02, { p: pts[i + 1], c }, sides + 1, 5)
  }
}

function bassModel(b: Builder): void {
  const body = '#6f9a4e'
  const belly = '#e3e9c2'
  const dark = '#2f4b25'
  const fin = '#5a8240'
  b.lathe(
    [[0, -1.95], [0.08, -1.9], [0.16, -1.5], [0.3, -0.9], [0.5, -0.3], [0.58, 0.25], [0.56, 0.8], [0.46, 1.3], [0.32, 1.65], [0.18, 1.9], [0.07, 2.05], [0, 2.1]],
    { r: [0, 0, -Math.PI / 2], s: [1, 1, 0.72], c: body },
    12,
  )
  // pale belly and cheek plate
  b.sphere(1, { p: [0.15, -0.27, 0], s: [1.75, 0.3, 0.55], c: belly }, 10, 6)
  b.sphere(0.4, { p: [0.95, 0.0, 0], s: [0.35, 1.0, 0.95], c: '#8db364' }, 8, 6)
  // dark lateral band
  for (const k of mirrorZ) b.sphere(1, { p: [0.0, 0.1, k * 0.37], s: [1.7, 0.09, 0.06], c: dark }, 10, 4)
  // big lower jaw and mouth line
  b.sphere(0.34, { p: [1.62, -0.1, 0], s: [1.5, 0.4, 0.78], c: '#cfd9a0' }, 8, 6)
  b.box(0.95, 0.03, 0.5, { p: [1.62, 0.02, 0], c: '#1f2c19' })
  // eyes
  for (const k of mirrorZ) {
    b.sphere(0.12, { p: [1.22, 0.28, k * 0.31], c: '#efe9c0' }, 8, 6)
    b.sphere(0.065, { p: [1.29, 0.29, k * 0.35], c: '#101820' }, 6, 5)
  }
  // spiny dorsal, soft dorsal
  for (let i = 0; i < 6; i++) b.cone(0.1, 0.42 - i * 0.025, { p: [0.75 - i * 0.2, 0.6 + 0.2 - i * 0.015, 0], r: [0, 0, 0.3], s: [1, 1, 0.3], c: dark }, 4)
  b.sphere(1, { p: [0.15, 0.7, 0], s: [0.65, 0.17, 0.04], r: [0, 0, 0.12], c: fin }, 8, 4)
  b.cone(0.3, 0.55, { p: [-0.75, 0.8, 0], r: [0, 0, 0.5], s: [1, 1, 0.12], c: fin }, 5)
  // forked tail
  b.cone(0.38, 0.95, { p: [-2.3, 0.3, 0], r: [0, 0, Math.PI / 2 - 0.4], s: [1, 1, 0.12], c: fin }, 5)
  b.cone(0.38, 0.95, { p: [-2.3, -0.3, 0], r: [0, 0, Math.PI / 2 + 0.4], s: [1, 1, 0.12], c: fin }, 5)
  b.cone(0.16, 0.6, { p: [-1.9, 0.0, 0], r: [0, 0, Math.PI / 2], s: [1, 1, 0.12], c: fin }, 5)
  // pelvic, anal and pectoral fins
  b.cone(0.2, 0.55, { p: [-0.75, -0.5, 0], r: [0, 0, -0.4], s: [1, 1, 0.12], c: fin }, 5)
  for (const k of mirrorZ) {
    b.cone(0.17, 0.5, { p: [0.45, -0.52, k * 0.15], r: [k * 0.2, 0, 0.5], s: [1, 1, 0.12], c: fin }, 5)
    b.sphere(0.3, { p: [0.65, -0.18, k * 0.4], s: [0.9, 0.55, 0.14], r: [k * 0.3, k * 0.3, -0.5], c: '#7fa65d' }, 6, 5)
  }
}

function buildSpecimen(id: string): THREE.BufferGeometry {
  const b = new Builder()
  switch (id) {
    case 'manatee': {
      const g = '#8b97a5'
      b.sphere(1, { p: [0, 0, 0], s: [1.5, 0.72, 0.78], c: g }, 12, 9)
        .sphere(1, { p: [0.05, -0.28, 0], s: [1.25, 0.4, 0.62], c: '#a9b3be' }, 10, 6)
        .cone(0.52, 1.1, { p: [-1.55, -0.02, 0], r: [0, 0, Math.PI / 2], c: g }, 8)
        .sphere(0.8, { p: [-2.15, -0.02, 0], s: [0.45, 0.09, 1], c: '#79858f' }, 10, 5)
        .sphere(0.52, { p: [1.4, -0.05, 0], s: [0.95, 0.85, 0.88], c: g }, 10, 8)
        .sphere(0.3, { p: [1.85, -0.16, 0], s: [0.8, 0.7, 1.1], c: '#a2adb8' }, 8, 6)
      for (const k of mirrorZ) {
        b.sphere(0.5, { p: [0.95, -0.5, k * 0.78], s: [0.6, 0.1, 0.32], r: [k * 0.5, k * -0.5, -0.4], c: '#76828d' }, 8, 5)
          .sphere(0.05, { p: [1.72, 0.12, k * 0.3], c: '#10161c' }, 6, 5)
          .sphere(0.04, { p: [2.04, -0.04, k * 0.12], c: '#2a2f35' }, 5, 4)
      }
      break
    }
    case 'brown-pelican': {
      b.sphere(0.75, { p: [0, 1.2, 0], s: [1.25, 0.8, 0.7], c: '#8a7a68' }, 10, 8)
        .cone(0.22, 0.8, { p: [-1.1, 1.0, 0], r: [0, 0, Math.PI / 2 + 0.2], s: [1, 1, 0.5], c: '#5e5347' }, 6)
        .capsule(0.14, 0.7, { p: [0.78, 1.9, 0], r: [0, 0, -0.55], c: '#efe9dc' }, 8)
        .sphere(0.24, { p: [1.08, 2.38, 0], c: '#f2e7a1' }, 10, 7)
        .box(1.05, 0.11, 0.14, { p: [1.72, 2.3, 0], r: [0, 0, -0.1], c: '#d9a35b' })
        .sphere(0.2, { p: [1.58, 2.16, 0], s: [2.5, 0.55, 0.8], r: [0, 0, -0.1], c: '#c78d63' }, 8, 5)
        .sphere(0.05, { p: [1.18, 2.46, 0.2], c: '#10161c' }, 5, 4)
        .sphere(0.05, { p: [1.18, 2.46, -0.2], c: '#10161c' }, 5, 4)
      for (const k of mirrorZ) {
        b.sphere(0.6, { p: [-0.1, 1.25, k * 0.5], s: [1.15, 0.5, 0.18], r: [0, 0, 0.1], c: '#6c6054' }, 9, 6)
          .seg([0.1, 0.65, k * 0.2], [0.1, 0.05, k * 0.2], 0.05, '#4b4036')
          .box(0.38, 0.04, 0.26, { p: [0.28, 0.03, k * 0.2], c: '#4b4036' })
      }
      break
    }
    case 'gopher-tortoise': {
      b.sphere(1, { p: [0, 0.62, 0], s: [1.2, 0.72, 0.95], c: '#8d7648' }, 9, 6).sphere(1, { p: [0, 0.2, 0], s: [1.15, 0.22, 0.92], c: '#5f5033' }, 9, 4)
      for (const [x, z] of [[0, 0], [0.55, 0], [-0.55, 0], [0, 0.45], [0, -0.45], [0.42, 0.38], [-0.42, -0.38]] as [number, number][]) {
        const f = 1 - (x / 1.2) ** 2 - (z / 0.95) ** 2
        b.cyl(0.26, 0.28, 0.07, { p: [x * 1.05, 0.62 + 0.72 * Math.sqrt(Math.max(f, 0)) * 1.02, z * 1.05], c: '#ad9560' }, 6)
      }
      b.sphere(0.3, { p: [1.42, 0.42, 0], s: [1.25, 0.9, 0.9], c: '#bba67c' }, 8, 6)
        .cyl(0.2, 0.24, 0.5, { p: [1.15, 0.38, 0], r: [0, 0, Math.PI / 2.6], c: '#a58f66' }, 6)
        .cone(0.12, 0.35, { p: [-1.35, 0.3, 0], r: [0, 0, Math.PI / 2], c: '#7a6844' }, 5)
      for (const x of [0.75, -0.75]) for (const k of mirrorZ) b.cyl(0.2, 0.24, 0.45, { p: [x, 0.22, k * 0.7], c: '#a58f66' }, 6).box(0.3, 0.07, 0.3, { p: [x + 0.06, 0.04, k * 0.7], c: '#8a7650' })
      for (const k of mirrorZ) b.sphere(0.04, { p: [1.6, 0.52, k * 0.14], c: '#10161c' }, 5, 4)
      break
    }
    case 'green-tree-frog': {
      const g = '#5cbd48'
      b.sphere(0.8, { p: [0, 0.72, 0], s: [1.1, 0.66, 0.82], c: g }, 11, 8)
        .sphere(0.6, { p: [0.05, 0.45, 0], s: [1, 0.4, 0.72], c: '#eaf3c4' }, 9, 5)
        .sphere(0.55, { p: [0.88, 0.86, 0], s: [1, 0.7, 0.92], c: g }, 10, 7)
        .box(1.05, 0.05, 0.06, { p: [0.15, 0.7, 0.68], r: [0, 0.15, 0], c: '#f4f1b0' })
        .box(1.05, 0.05, 0.06, { p: [0.15, 0.7, -0.68], r: [0, -0.15, 0], c: '#f4f1b0' })
      for (const k of mirrorZ) {
        b.sphere(0.22, { p: [1.02, 1.28, k * 0.36], c: '#e6f5a8' }, 8, 6)
          .sphere(0.1, { p: [1.2, 1.3, k * 0.42], c: '#10161c' }, 6, 5)
          .seg([0.55, 0.45, k * 0.5], [0.7, 0.05, k * 0.75], 0.1, g)
          .sphere(0.13, { p: [0.72, 0.06, k * 0.8], s: [1.1, 0.6, 1.1], c: '#8ee06e' }, 6, 5)
          .seg([-0.5, 0.85, k * 0.7], [0.0, 1.0, k * 1.0], 0.19, g, 0.13)
          .seg([0.0, 1.0, k * 1.0], [-0.3, 0.3, k * 1.15], 0.13, g, 0.08)
          .seg([-0.3, 0.3, k * 1.15], [0.45, 0.07, k * 1.2], 0.07, g)
          .sphere(0.12, { p: [0.55, 0.07, k * 1.22], s: [1.1, 0.6, 1.1], c: '#8ee06e' }, 6, 5)
      }
      break
    }
    case 'bull-shark':
      fish(b, { body: '#7e8b98', belly: '#e8eef0', fin: '#6a7784', len: 1.7, depth: 1 })
      for (const k of mirrorZ) b.box(0.03, 0.2, 0.05, { p: [0.62, 0.0, k * 0.4], c: '#3a4650' }).box(0.03, 0.2, 0.05, { p: [0.72, 0.0, k * 0.4], c: '#3a4650' })
      break
    case 'largemouth-bass':
      bassModel(b)
      break
    case 'blue-crab': {
      b.sphere(1, { p: [0, 0.55, 0], s: [0.8, 0.38, 1.3], c: '#4f88b9' }, 10, 6).sphere(1, { p: [0, 0.38, 0], s: [0.7, 0.2, 1.1], c: '#c9d6df' }, 8, 4)
      for (const k of mirrorZ) {
        b.cone(0.13, 0.5, { p: [0, 0.58, k * 1.42], r: [k * Math.PI / 2, 0, 0], c: '#2f6aa0' }, 5)
          .seg([0.75, 0.82, k * 0.4], [0.8, 1.02, k * 0.4], 0.04, '#d8e4ec')
          .sphere(0.08, { p: [0.8, 1.06, k * 0.4], c: '#10161c' }, 5, 4)
          .seg([0.55, 0.55, k * 0.95], [1.15, 0.6, k * 1.1], 0.1, '#4f88b9')
          .sphere(0.25, { p: [1.4, 0.6, k * 1.0], s: [1.5, 0.7, 0.65], c: '#4a82b5' }, 8, 5)
          .seg([1.65, 0.68, k * 0.88], [2.15, 0.62, k * 0.7], 0.09, '#e0674a', 0.02)
          .seg([1.65, 0.5, k * 1.1], [2.1, 0.5, k * 1.0], 0.08, '#e0674a', 0.02)
        for (let i = 0; i < 3; i++) {
          const x = 0.35 - i * 0.4
          b.seg([x, 0.5, k * 0.95], [x - 0.15, 0.7, k * 1.65], 0.07, '#5b8fbd').seg([x - 0.15, 0.7, k * 1.65], [x - 0.3, 0.05, k * 2.05], 0.055, '#6f9fc6')
        }
        b.sphere(0.3, { p: [-0.85, 0.4, k * 1.1], s: [1, 0.15, 0.7], c: '#6f9fc6' }, 6, 4)
      }
      break
    }
    case 'florida-panther': {
      const t = '#b8935f'
      const pale = '#dccaa6'
      const dk = '#47362a'
      // torso, chest and haunch masses
      b.capsule(0.46, 1.4, { p: [0, 1.38, 0], r: [0, 0, Math.PI / 2], s: [1, 1, 0.78], c: t }, 12)
        .sphere(0.52, { p: [0.78, 1.36, 0], s: [1, 1.1, 0.82], c: t }, 12, 8)
        .sphere(0.54, { p: [-0.82, 1.38, 0], s: [1.05, 1.05, 0.88], c: t }, 12, 8)
        .sphere(1, { p: [0.05, 1.06, 0], s: [1.5, 0.24, 0.3], c: pale }, 10, 5)
        .capsule(0.3, 0.45, { p: [1.28, 1.72, 0], r: [0, 0, -1.0], c: t }, 9)
      // head: skull, muzzle, chin, nose, ears, eyes
      b.sphere(0.4, { p: [1.78, 1.9, 0], s: [1.05, 0.92, 0.98], c: t }, 12, 9)
        .sphere(0.21, { p: [2.14, 1.8, 0], s: [1.15, 0.75, 1.0], c: '#d9c5a0' }, 10, 7)
        .sphere(0.15, { p: [2.08, 1.62, 0], s: [1.5, 0.45, 0.85], c: pale }, 8, 6)
        .sphere(0.075, { p: [2.34, 1.86, 0], s: [1, 0.8, 1.2], c: dk }, 6, 5)
        .box(0.3, 0.025, 0.02, { p: [2.2, 1.68, 0.0], c: dk })
      for (const k of mirrorZ) {
        b.sphere(0.15, { p: [1.62, 2.3, k * 0.24], s: [0.55, 1.1, 0.9], r: [k * 0.25, 0, 0], c: t }, 7, 5)
          .sphere(0.08, { p: [1.65, 2.28, k * 0.25], s: [0.4, 0.9, 0.7], c: dk }, 6, 4)
          .sphere(0.065, { p: [2.0, 2.0, k * 0.23], c: '#cdbf4f' }, 7, 5)
          .sphere(0.032, { p: [2.04, 2.0, k * 0.245], c: '#10161c' }, 5, 4)
          .sphere(0.14, { p: [1.98, 2.08, k * 0.22], s: [1.2, 0.45, 0.6], c: '#8d6e45' }, 6, 4)
      }
      // tail with dark tip
      chain(b, [[-1.3, 1.5, 0], [-1.95, 1.4, 0], [-2.55, 1.08, 0], [-3.0, 0.72, 0], [-3.25, 0.5, 0]], [0.16, 0.14, 0.12, 0.105, 0.1], t)
      b.sphere(0.115, { p: [-3.28, 0.46, 0], c: dk }, 8, 6)
      // front legs: shoulder, elbow, paw
      for (const k of mirrorZ) {
        chain(b, [[0.86, 1.2, k * 0.3], [0.8, 0.68, k * 0.3], [0.92, 0.18, k * 0.3]], [0.2, 0.15, 0.1], t)
        b.sphere(0.17, { p: [1.0, 0.09, k * 0.3], s: [1.4, 0.55, 1], c: '#a78558' }, 8, 5)
        // hind legs: thigh forward, shin back, long hock
        chain(b, [[-0.9, 1.3, k * 0.32], [-0.52, 0.82, k * 0.32], [-0.98, 0.42, k * 0.32], [-0.9, 0.16, k * 0.32]], [0.26, 0.17, 0.11, 0.09], t)
        b.sphere(0.17, { p: [-0.8, 0.09, k * 0.32], s: [1.4, 0.55, 1], c: '#a78558' }, 8, 5)
      }
      break
    }
    case 'barred-owl': {
      const br = '#7c6850'
      b.sphere(0.8, { p: [0, 1.15, 0], s: [0.85, 1.15, 0.78], c: br }, 10, 8)
        .sphere(0.58, { p: [0.0, 2.25, 0], s: [1, 0.95, 1.05], c: '#8a7458' }, 10, 8)
        .cone(0.07, 0.22, { p: [0.62, 2.08, 0], r: [0, 0, -Math.PI / 2], c: '#e0b84a' }, 5)
        .cone(0.3, 0.9, { p: [-0.55, 0.45, 0], r: [0, 0, Math.PI / 2 + 0.7], s: [1, 1, 0.45], c: '#60503c' }, 6)
      for (const y of [0.85, 1.1, 1.35, 1.6]) b.box(0.06, 0.07, 0.95 - (y - 0.85) * 0.2, { p: [0.62 - (y - 0.85) * 0.05, y, 0], c: '#d8c9a8' })
      for (const k of mirrorZ) {
        b.sphere(0.26, { p: [0.5, 2.28, k * 0.22], s: [0.2, 1, 1], c: '#e3d8be' }, 8, 6)
          .sphere(0.12, { p: [0.58, 2.3, k * 0.22], c: '#10161c' }, 7, 5)
          .sphere(0.7, { p: [-0.08, 1.15, k * 0.58], s: [0.55, 1.1, 0.2], r: [0, 0, 0.1], c: '#6c5b44' }, 8, 6)
          .cyl(0.06, 0.07, 0.3, { p: [0.15, 0.2, k * 0.25], c: '#e0b84a' }, 5)
          .box(0.28, 0.04, 0.2, { p: [0.25, 0.04, k * 0.25], c: '#e0b84a' })
      }
      break
    }
    case 'american-alligator': {
      const gr = '#4d6b3b'
      const dg = '#33482b'
      const belly = '#c8c697'
      const ridge = '#27381f'
      // body and tail
      b.capsule(0.58, 1.7, { p: [0, 0.74, 0], r: [0, 0, Math.PI / 2], s: [0.85, 1, 1.18], c: gr }, 12)
        .sphere(1, { p: [0, 0.42, 0], s: [1.9, 0.22, 0.75], c: belly }, 10, 5)
      const tail: V3[] = [[-1.4, 0.68, 0.0], [-2.3, 0.55, 0.22], [-3.3, 0.4, -0.15], [-4.3, 0.28, -0.4], [-5.1, 0.2, -0.2]]
      chain(b, tail, [0.46, 0.38, 0.28, 0.18, 0.06], dg, 8)
      // head: skull, long flat snout, pale lower jaw, eye ridges, nostrils
      b.sphere(0.52, { p: [1.62, 0.86, 0], s: [1.15, 0.62, 1.0], c: gr }, 12, 8)
        .cyl(0.17, 0.4, 1.7, { p: [2.7, 0.78, 0], r: [0, 0, -Math.PI / 2], s: [0.5, 1, 1.15], c: gr }, 10)
        .cyl(0.14, 0.34, 1.6, { p: [2.62, 0.56, 0], r: [0, 0, -Math.PI / 2], s: [0.4, 1, 1.05], c: belly }, 9)
        .sphere(0.17, { p: [3.55, 0.99, 0], s: [1, 0.6, 1.6], c: dg }, 7, 5)
      for (const k of mirrorZ) {
        b.sphere(0.2, { p: [1.72, 1.14, k * 0.3], s: [1.2, 0.8, 1], c: gr }, 8, 6)
          .sphere(0.075, { p: [1.78, 1.24, k * 0.34], c: '#e0cb4a' }, 6, 5)
          .sphere(0.035, { p: [1.82, 1.26, k * 0.37], s: [0.5, 1.6, 1], c: '#10161c' }, 5, 4)
          .sphere(0.05, { p: [3.5, 1.08, k * 0.1], c: '#10161c' }, 5, 4)
        // teeth along the upper jaw
        for (let i = 0; i < 7; i++) b.cone(0.028, 0.1, { p: [2.2 + i * 0.22, 0.58, k * (0.26 - i * 0.02)], r: [Math.PI, 0, 0], c: '#f1ecd6' }, 4)
        // splayed legs with toes
        for (const x of [0.95, -0.95]) {
          chain(b, [[x, 0.58, k * 0.62], [x + 0.12, 0.3, k * 1.05], [x + 0.2, 0.1, k * 1.15]], [0.2, 0.14, 0.1], gr)
          for (let i = -1; i <= 1; i++) b.box(0.28, 0.06, 0.07, { p: [x + 0.4, 0.04, k * (1.15 + i * 0.12)], r: [0, i * k * 0.3, 0], c: dg })
        }
      }
      // double row of osteoderm scutes down the back and tail
      for (let i = 0; i < 11; i++) {
        const x = 1.2 - i * 0.28
        for (const k of mirrorZ) b.cone(0.1, 0.17, { p: [x, 1.2 - Math.max(0, x < 0 ? -x * 0.08 : 0), k * 0.2], c: ridge }, 4)
      }
      for (let i = 0; i < tail.length - 1; i++) {
        const [x0, y0, z0] = tail[i]
        const [x1, y1, z1] = tail[i + 1]
        for (const f of [0.2, 0.7]) b.cone(0.12 - i * 0.02, 0.2 - i * 0.03, { p: [x0 + (x1 - x0) * f, y0 + (y1 - y0) * f + 0.4 - i * 0.07, z0 + (z1 - z0) * f], c: ridge }, 4)
      }
      break
    }
    case 'grasshopper': {
      const g = '#8fc13c'
      b.capsule(0.19, 0.95, { p: [-0.35, 0.68, 0], r: [0, 0, Math.PI / 2], c: g }, 8)
        .sphere(0.23, { p: [0.4, 0.72, 0], c: '#7fae34' }, 8, 6)
        .sphere(0.21, { p: [0.78, 0.76, 0], s: [1.1, 1.2, 1], c: g }, 8, 6)
        .seg([0.85, 0.9, 0.1], [1.4, 1.4, 0.25], 0.015, '#3a4a20')
        .seg([0.85, 0.9, -0.1], [1.4, 1.4, -0.25], 0.015, '#3a4a20')
      for (const k of mirrorZ) {
        b.sphere(0.09, { p: [0.9, 0.9, k * 0.14], c: '#10161c' }, 5, 4)
          .sphere(0.3, { p: [-0.35, 0.9, k * 0.13], s: [2.3, 0.05, 0.45], r: [0, k * 0.1, -0.05], c: '#b6d96b' }, 6, 4)
          .seg([-0.1, 0.8, k * 0.2], [-0.5, 1.25, k * 0.38], 0.09, '#6f9a2c', 0.07)
          .seg([-0.5, 1.25, k * 0.38], [-1.2, 0.05, k * 0.4], 0.04, '#6f9a2c')
          .seg([0.4, 0.6, k * 0.15], [0.6, 0.35, k * 0.4], 0.04, '#6f9a2c')
          .seg([0.6, 0.35, k * 0.4], [0.7, 0.04, k * 0.45], 0.035, '#6f9a2c')
          .seg([0.2, 0.62, k * 0.15], [0.2, 0.3, k * 0.45], 0.04, '#6f9a2c')
          .seg([0.2, 0.3, k * 0.45], [0.05, 0.04, k * 0.5], 0.035, '#6f9a2c')
      }
      break
    }
    case 'garden-spider': {
      const yel = '#e6bd2e'
      const blk = '#241c12'
      const silver = '#c3b697'
      // abdomen with black bands, cephalothorax, eyes, fangs
      b.sphere(0.7, { p: [-0.78, 0.98, 0], s: [1.3, 1.0, 0.95], c: yel }, 14, 10)
      for (const dx of [-0.62, -0.28, 0.06, 0.4]) {
        const f = Math.sqrt(Math.max(0, 1 - (dx / 0.91) ** 2))
        b.torus(0.7 * f * 1.01, 0.04, { p: [-0.78 + dx, 0.98, 0], r: [0, Math.PI / 2, 0], s: [0.95, 1, 1], c: blk }, 5, 22)
      }
      b.sphere(0.36, { p: [0.4, 0.82, 0], s: [1.15, 0.8, 0.88], c: silver }, 10, 8)
        .sphere(0.17, { p: [-0.06, 0.88, 0], c: blk }, 7, 5)
        .sphere(0.13, { p: [0.72, 0.85, 0], s: [0.8, 0.9, 1.1], c: '#8d7f63' }, 7, 5)
      for (const k of mirrorZ) {
        b.sphere(0.045, { p: [0.7, 0.98, k * 0.07], c: '#0b0b0b' }, 5, 4)
          .sphere(0.04, { p: [0.64, 1.02, k * 0.17], c: '#0b0b0b' }, 5, 4)
          .cone(0.035, 0.14, { p: [0.84, 0.74, k * 0.08], r: [0, 0, Math.PI + 0.3], c: '#3b2c1c' }, 5)
        // eight legs: yellow femur, dark banded tibia, ground tip
        for (let i = 0; i < 4; i++) {
          const x = 0.56 - i * 0.17
          const sp = (1.5 - i) * 0.5
          const knee: V3 = [x + sp * 0.5, 1.28, k * (0.98 + (i === 1 || i === 2 ? 0.1 : 0))]
          const tip: V3 = [x + sp * 1.6 + (i < 2 ? 0.3 : -0.2), 0.04, k * (1.7 + (i === 1 || i === 2 ? 0.2 : 0))]
          const mid: V3 = [knee[0] + (tip[0] - knee[0]) * 0.45, knee[1] + (tip[1] - knee[1]) * 0.45, knee[2] + (tip[2] - knee[2]) * 0.45]
          b.seg([x, 0.8, k * 0.2], knee, 0.075, yel, 0.06)
            .sphere(0.07, { p: knee, c: blk }, 7, 5)
            .seg(knee, mid, 0.06, blk, 0.055)
            .seg(mid, tip, 0.055, '#6a4f22', 0.025)
        }
      }
      break
    }
    default:
      b.sphere(0.8, { c: '#7fa9c0' })
  }
  return b.build()
}

const specimenCache = new Map<string, SpecimenGeo>()

/** Grounded, centered geometry for a specimen id (facing +x). */
export function specimenGeo(id: string): SpecimenGeo {
  let s = specimenCache.get(id)
  if (!s) {
    const geo = buildSpecimen(id)
    s = { geo, size: groundCenter(geo) }
    specimenCache.set(id, s)
  }
  return s
}

export const LAB_SPECIMENS = ['manatee', 'brown-pelican', 'gopher-tortoise', 'green-tree-frog', 'bull-shark', 'blue-crab'] as const
