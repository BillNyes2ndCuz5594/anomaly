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
      fish(b, { body: '#6f9a4e', belly: '#dfe7bd', fin: '#587c3e', len: 1.4, depth: 1.25, stripe: '#3d5d2c' })
      b.box(0.5, 0.1, 0.5, { p: [1.65, -0.05, 0], c: '#34502a' })
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
      const t = '#b99a6b'
      b.capsule(0.5, 1.5, { p: [0, 1.25, 0], r: [0, 0, Math.PI / 2], s: [1, 1, 0.8], c: t }, 10)
        .sphere(0.45, { p: [1.55, 1.7, 0], s: [1.1, 0.95, 0.95], c: t }, 10, 8)
        .sphere(0.2, { p: [2.0, 1.6, 0], s: [1, 0.7, 1], c: '#e2d2b0' }, 8, 6)
        .sphere(0.07, { p: [2.17, 1.66, 0], c: '#3b2a24' }, 5, 4)
        .cone(0.16, 0.3, { p: [1.42, 2.15, 0.28], c: '#8f7550' }, 5)
        .cone(0.16, 0.3, { p: [1.42, 2.15, -0.28], c: '#8f7550' }, 5)
        .tube([[-1.15, 1.35, 0], [-1.7, 1.2, 0], [-2.2, 0.8, 0], [-2.55, 0.9, 0]], 0.09, { c: t }, 20, 6)
        .capsule(0.28, 0.5, { p: [1.15, 1.5, 0], r: [0, 0, -0.6], c: t }, 8)
      for (const x of [0.9, -0.85]) for (const k of mirrorZ) b.seg([x, 1.1, k * 0.3], [x, 0.18, k * 0.3], 0.17, t, 0.11).sphere(0.17, { p: [x + 0.08, 0.1, k * 0.3], s: [1.3, 0.6, 1], c: '#a78a5e' }, 6, 5)
      for (const k of mirrorZ) b.sphere(0.05, { p: [1.8, 1.82, k * 0.22], c: '#2a3c2a' }, 5, 4)
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
      const gr = '#50703f'
      b.capsule(0.45, 2.0, { p: [0, 0.6, 0], r: [0, 0, Math.PI / 2], s: [1, 1, 0.95], c: gr }, 9)
        .cone(0.42, 2.3, { p: [-2.7, 0.5, 0], r: [0, 0, Math.PI / 2], s: [1, 1, 0.65], c: '#46633a' }, 8)
        .box(1.3, 0.25, 0.5, { p: [2.25, 0.5, 0], r: [0, 0, -0.03], c: '#5b7d49' })
        .box(0.9, 0.2, 0.42, { p: [2.55, 0.4, 0], c: '#c7c79a' })
        .sphere(0.38, { p: [1.5, 0.7, 0], s: [1.2, 0.8, 1], c: gr }, 8, 6)
      for (const k of mirrorZ) {
        b.sphere(0.12, { p: [1.6, 0.95, k * 0.22], c: '#d8d36f' }, 6, 5).sphere(0.05, { p: [1.65, 1.0, k * 0.25], c: '#10161c' }, 5, 4)
        for (const x of [1.0, -0.9]) b.seg([x, 0.35, k * 0.5], [x + 0.1, 0.1, k * 1.0], 0.16, gr, 0.1).box(0.34, 0.05, 0.22, { p: [x + 0.25, 0.05, k * 1.0], c: '#3f5a32' })
      }
      for (let i = 0; i < 9; i++) b.cone(0.1, 0.2, { p: [1.1 - i * 0.55, 1.08 - Math.max(0, i - 4) * 0.12, 0], c: '#33472a' }, 4)
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
      b.sphere(0.58, { p: [-0.6, 0.62, 0], s: [1.15, 0.95, 0.95], c: '#e3b933' }, 10, 8)
        .sphere(0.3, { p: [0.2, 0.52, 0], s: [1, 0.8, 0.85], c: '#3b2f1e' }, 8, 6)
        .box(0.12, 0.05, 0.9, { p: [-0.62, 1.12, 0], c: '#3b2f1e' })
        .box(0.12, 0.05, 0.76, { p: [-0.3, 1.0, 0], r: [0, 0, -0.5], c: '#3b2f1e' })
        .box(0.12, 0.05, 0.76, { p: [-0.95, 1.0, 0], r: [0, 0, 0.5], c: '#3b2f1e' })
      for (const k of mirrorZ) {
        for (let i = 0; i < 4; i++) {
          const x = 0.34 - i * 0.14
          const sp = (i - 1.5) * 0.5
          b.seg([x, 0.52, k * 0.22], [x + sp * 0.9 + 0.1, 1.0, k * 0.85], 0.045, '#4a3a24')
            .seg([x + sp * 0.9 + 0.1, 1.0, k * 0.85], [x + sp * 1.5 + 0.15, 0.04, k * 1.45], 0.035, '#5a4830')
        }
        b.sphere(0.05, { p: [0.45, 0.62, k * 0.12], c: '#f0e8d0' }, 5, 4)
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
