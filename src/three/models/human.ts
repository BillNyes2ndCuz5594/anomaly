import type * as THREE from 'three/webgpu'
import { Builder, recenter, type V3 } from './builder'

export interface OrganDef {
  id: string
  label: string
  /** Okabe-Ito tint (or close). */
  tint: string
  kind: 'organ' | 'sense'
  /** World position of the organ center on the figure. */
  center: V3
  geo: THREE.BufferGeometry
}

import { ORGAN_LIST } from './humanList'
export { ORGAN_LIST }

const mirror = (x: number): number[] => [-x, x]

function coil(): V3[] {
  const pts: V3[] = []
  const rows = 6
  for (let k = 0; k < rows; k++) {
    const y = 2.5 - k * 0.1
    const dir = k % 2 === 0 ? 1 : -1
    const z = 0.06 + (k % 2) * 0.05
    pts.push([-0.4 * dir, y, z], [-0.12 * dir, y + 0.03, z + 0.03], [0.12 * dir, y - 0.02, z], [0.4 * dir, y, z + 0.02])
  }
  return pts
}

function build(id: string): THREE.BufferGeometry {
  const b = new Builder()
  switch (id) {
    case 'brain':
      for (const x of mirror(0.17)) b.sphere(0.3, { p: [x, 4.58, -0.02], s: [1, 0.82, 1.1] }, 10, 8)
      b.sphere(0.17, { p: [0, 4.34, -0.27], s: [1.3, 0.8, 1] }).cyl(0.07, 0.09, 0.22, { p: [0, 4.18, -0.12] })
      break
    case 'heart':
      b.sphere(0.27, { p: [0.16, 3.32, 0.12], s: [1, 1.1, 0.9] }, 10, 8)
        .cone(0.25, 0.45, { p: [0.2, 3.02, 0.12], r: [0, 0, Math.PI + 0.35] })
        .cyl(0.07, 0.07, 0.34, { p: [0.04, 3.62, 0.08], r: [0, 0, 0.2] })
        .cyl(0.07, 0.07, 0.34, { p: [0.3, 3.6, 0.1], r: [0, 0, -0.25] })
      break
    case 'lungs':
      for (const x of mirror(0.56)) {
        const sx = x < 0 ? 1.05 : 0.92
        b.sphere(0.3, { p: [x, 3.78, 0], s: [0.9 * sx, 1.3, 0.9] }, 9, 7).sphere(0.32, { p: [x, 3.3, 0.02], s: [sx, 1.25, 0.9] }, 9, 7)
      }
      b.cyl(0.07, 0.07, 0.55, { p: [0, 3.85, 0] }).cyl(0.05, 0.05, 0.6, { p: [-0.25, 3.45, 0], r: [0, 0, 1.1] })
        .cyl(0.05, 0.05, 0.6, { p: [0.25, 3.45, 0], r: [0, 0, -1.1] })
      break
    case 'liver':
      b.sphere(0.5, { p: [-0.36, 2.96, 0.1], s: [1.2, 0.55, 0.62], r: [0, 0, 0.14] }, 10, 8).sphere(0.4, { p: [0.04, 2.9, 0.16], s: [1, 0.55, 0.7] })
      break
    case 'stomach':
      b.sphere(0.3, { p: [0.36, 2.88, 0.12], s: [1, 1.2, 0.75], r: [0, 0, -0.7] }, 10, 8)
        .cyl(0.07, 0.07, 0.55, { p: [0.14, 3.32, 0.08], r: [0, 0, -0.35] })
        .cyl(0.08, 0.08, 0.4, { p: [-0.02, 2.66, 0.12], r: [0, 0, Math.PI / 2] })
      break
    case 'pancreas':
      b.capsule(0.1, 0.55, { p: [0.12, 2.62, -0.04], r: [0, 0, Math.PI / 2 + 0.12], s: [1, 1, 1.35] }, 8)
      break
    case 'small-intestine':
      b.tube(coil(), 0.08, {}, 140, 6)
      break
    case 'large-intestine':
      b.tube(
        [[-0.56, 1.92, 0.02], [-0.58, 2.3, 0.02], [-0.5, 2.62, 0.02], [-0.2, 2.72, 0.02], [0.2, 2.72, 0.02], [0.5, 2.62, 0.02], [0.58, 2.3, 0.02], [0.56, 1.92, 0.02], [0.38, 1.76, 0.04], [0.14, 1.82, 0.04], [0, 1.9, 0.04]],
        0.1,
        {},
        90,
        7,
      )
      break
    case 'kidneys':
      for (const x of mirror(0.42)) b.sphere(0.22, { p: [x, 2.78, -0.3], s: [0.72, 1.15, 0.65], r: [0, 0, x < 0 ? 0.25 : -0.25] }, 9, 7)
      break
    case 'bladder':
      b.sphere(0.21, { p: [0, 1.76, 0.1], s: [1.05, 0.95, 0.9] }, 9, 7).cone(0.1, 0.22, { p: [0, 1.56, 0.1], r: [0, 0, Math.PI] })
      break
    case 'eyes':
      for (const x of mirror(0.22)) b.sphere(0.11, { p: [x, 4.56, 0.54] }, 8, 6)
      break
    case 'ears':
      for (const x of mirror(0.62)) b.sphere(0.13, { p: [x, 4.44, 0], s: [0.55, 1.1, 0.85] }, 8, 6)
      break
    case 'nose':
      b.cone(0.11, 0.24, { p: [0, 4.4, 0.62], r: [Math.PI / 2, 0, 0] }, 8)
      break
    case 'tongue':
      b.capsule(0.07, 0.2, { p: [0, 4.2, 0.54], r: [0, 0, Math.PI / 2], s: [1, 0.6, 1.3] }, 6)
      break
  }
  return b.build()
}

/** Whole body outer shell. Chunky, readable silhouette, built from simple solids. */
function buildSkin(): THREE.BufferGeometry {
  const b = new Builder()
  b.sphere(0.6, { p: [0, 4.45, 0], s: [0.95, 1.05, 1] }, 16, 12)
    .cyl(0.23, 0.27, 0.4, { p: [0, 3.95, 0] }, 12)
    .capsule(0.8, 0.9, { p: [0, 2.85, 0], s: [1.08, 1, 0.66] }, 16)
    .sphere(0.8, { p: [0, 1.65, 0], s: [1.0, 0.58, 0.64] }, 14, 8)
  for (const x of mirror(1)) {
    const k = Math.sign(x)
    b.sphere(0.42, { p: [x, 3.62, 0] }, 12, 8)
      .capsule(0.27, 0.75, { p: [k * 1.2, 3.0, 0], r: [0, 0, -k * 0.12] }, 10)
      .capsule(0.23, 0.7, { p: [k * 1.32, 2.0, 0], r: [0, 0, -k * 0.07] }, 10)
      .sphere(0.27, { p: [k * 1.38, 1.36, 0] }, 10, 8)
      .capsule(0.38, 0.6, { p: [k * 0.42, 1.2, 0] }, 12)
      .capsule(0.3, 0.3, { p: [k * 0.42, 0.45, 0] }, 10)
      .sphere(0.3, { p: [k * 0.42, 0.13, 0.2], s: [0.95, 0.5, 1.5] }, 10, 8)
  }
  return b.build()
}

/** General muscle bulk shown on the figure when an item asks about muscles. */
function buildMuscles(): THREE.BufferGeometry {
  const b = new Builder()
  for (const k of [-1, 1]) {
    b.capsule(0.3, 0.7, { p: [k * 1.2, 3.0, 0], r: [0, 0, -k * 0.12], s: [1, 1, 1.05] }, 8)
      .capsule(0.26, 0.6, { p: [k * 1.32, 2.0, 0], r: [0, 0, -k * 0.07] }, 8)
      .capsule(0.42, 0.55, { p: [k * 0.42, 1.2, 0] }, 8)
      .capsule(0.33, 0.28, { p: [k * 0.42, 0.45, 0] }, 8)
      .sphere(0.46, { p: [k * 0.4, 3.45, 0.36], s: [1, 0.7, 0.4] }, 8, 6)
      .sphere(0.4, { p: [k * 0.34, 2.55, 0.42], s: [0.9, 1.1, 0.3] }, 8, 6)
  }
  return b.build()
}

let cache: { organs: Map<string, OrganDef>; skin: THREE.BufferGeometry; muscles: THREE.BufferGeometry } | null = null

/** CPU side geometry cache shared by Lab A, the briefing and the item visuals. */
export function humanModel() {
  if (cache) return cache
  const organs = new Map<string, OrganDef>()
  for (const o of ORGAN_LIST) {
    if (o.id === 'skin') continue
    const geo = build(o.id)
    const center = recenter(geo)
    organs.set(o.id, { ...o, center, geo })
  }
  cache = { organs, skin: buildSkin(), muscles: buildMuscles() }
  return cache
}

export const BODY_CENTER: V3 = [0, 2.55, 0]
