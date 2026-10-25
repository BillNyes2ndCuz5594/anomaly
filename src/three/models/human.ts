import * as THREE from 'three/webgpu'
import { Builder, recenter, type V3 } from './builder'
import { translateBox, unionBox, type Box } from '../fit'

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

/**
 * Whole body outer shell. A clean stylized adult: neck, sloped shoulders, tapered limbs, hands and feet.
 * Feet at y = 0, about 6.5 units tall, facing +z. Torso organs sit in the 3.0 to 5.3 band, head organs in the head.
 */
function buildSkin(): THREE.BufferGeometry {
  const b = new Builder()
  // Trunk as one lathe (smooth), squashed front to back.
  b.lathe(
    [[0.0, 3.0], [0.42, 3.03], [0.66, 3.12], [0.78, 3.34], [0.78, 3.7], [0.75, 4.0], [0.76, 4.3], [0.82, 4.62], [0.88, 4.9], [0.94, 5.08], [0.8, 5.22], [0.46, 5.3], [0.22, 5.36], [0.0, 5.4]],
    { s: [1, 1, 0.62] },
    28,
  )
  // Neck and head: a longer jaw under a rounder skull so the head reads as a face, not a ball.
  b.cyl(0.19, 0.23, 0.5, { p: [0, 5.52, 0.03] }, 16)
    .sphere(0.5, { p: [0, 6.02, 0], s: [1.02, 1.0, 1.1] }, 24, 18)
    .sphere(0.38, { p: [0, 5.74, 0.13], s: [0.98, 0.9, 0.92] }, 18, 12)
  for (const k of [-1, 1]) {
    const x = k * 0.97
    // Arm: shoulder cap, upper arm, elbow, forearm, hand with four fingers and a thumb.
    b.sphere(0.27, { p: [x, 5.0, 0], s: [1, 1.05, 1] }, 16, 12)
      .seg([x, 5.0, 0], [k * 1.1, 4.0, 0.02], 0.22, undefined, 0.17, 14)
      .sphere(0.17, { p: [k * 1.1, 4.0, 0.02] }, 12, 10)
      .seg([k * 1.1, 4.0, 0.02], [k * 1.24, 3.1, 0.08], 0.16, undefined, 0.11, 14)
      .sphere(0.115, { p: [k * 1.24, 3.1, 0.08] }, 12, 10)
      .sphere(0.13, { p: [k * 1.26, 2.95, 0.09], s: [0.62, 1.0, 0.36] }, 12, 10)
    for (let f = 0; f < 4; f++) {
      const fx = k * (1.26 + (f - 1.5) * 0.045)
      b.capsule(0.032, 0.17 - Math.abs(f - 1.5) * 0.015, { p: [fx, 2.74 - Math.abs(f - 1.5) * 0.008, 0.1], r: [0.08, 0, k * -0.03] }, 6)
    }
    b.capsule(0.036, 0.13, { p: [k * 1.38, 2.9, 0.13], r: [0.3, 0, k * 0.7] }, 6)
    // Leg: thigh, knee, shin, ankle, foot.
    const lx = k * 0.4
    b.seg([lx, 3.12, 0], [k * 0.42, 1.7, 0.02], 0.34, undefined, 0.21, 16)
      .sphere(0.21, { p: [k * 0.42, 1.7, 0.02] }, 12, 10)
      .seg([k * 0.42, 1.7, 0.02], [k * 0.42, 0.3, 0], 0.2, undefined, 0.12, 14)
      .sphere(0.115, { p: [k * 0.42, 0.28, 0] }, 10, 8)
      .sphere(0.17, { p: [k * 0.42, 0.11, 0.2], s: [0.82, 0.62, 2.4] }, 14, 10)
  }
  return b.build()
}

/** General muscle bulk shown on the figure when an item asks about muscles. */
function buildMuscles(): THREE.BufferGeometry {
  const b = new Builder()
  for (const k of [-1, 1]) {
    b.sphere(0.3, { p: [k * 0.98, 5.0, 0.02], s: [1, 1.1, 1.05] }, 12, 10)
      .seg([k * 1.0, 4.85, 0.05], [k * 1.1, 4.1, 0.05], 0.2, undefined, 0.15, 12)
      .seg([k * 1.1, 3.9, 0.06], [k * 1.22, 3.2, 0.09], 0.17, undefined, 0.11, 12)
      .seg([k * 0.4, 2.95, 0.06], [k * 0.42, 1.95, 0.08], 0.33, undefined, 0.23, 12)
      .seg([k * 0.42, 1.5, 0.05], [k * 0.42, 0.55, 0.04], 0.2, undefined, 0.13, 12)
      .sphere(0.4, { p: [k * 0.4, 4.78, 0.3], s: [1, 0.62, 0.38] }, 12, 8)
      .sphere(0.3, { p: [k * 0.32, 4.1, 0.34], s: [1, 1.05, 0.3] }, 10, 8)
  }
  return b.build()
}

const HEAD_ORGANS = new Set(['brain', 'eyes', 'ears', 'nose', 'tongue'])

/**
 * The organ shapes were authored for a short chunky body. This maps them onto the natural proportion body:
 * torso organs are narrowed and lifted into the trunk, head organs are moved up into the head.
 */
function adapt(id: string, geo: THREE.BufferGeometry) {
  const m = new THREE.Matrix4()
  if (HEAD_ORGANS.has(id)) m.makeTranslation(0, 1.46, 0).multiply(new THREE.Matrix4().makeScale(0.92, 1, 0.9))
  else m.makeTranslation(0, 1.872, 0).multiply(new THREE.Matrix4().makeScale(0.78, 0.8, 0.9))
  geo.applyMatrix4(m)
}

let cache: { organs: Map<string, OrganDef>; skin: THREE.BufferGeometry; muscles: THREE.BufferGeometry; box: Box } | null = null

/** CPU side geometry cache shared by Lab A, the briefing and the item visuals. */
export function humanModel() {
  if (cache) return cache
  const organs = new Map<string, OrganDef>()
  for (const o of ORGAN_LIST) {
    if (o.id === 'skin') continue
    const geo = build(o.id)
    adapt(o.id, geo)
    const center = recenter(geo)
    organs.set(o.id, { ...o, center, geo })
  }
  const skin = buildSkin()
  skin.computeBoundingBox()
  const bb = skin.boundingBox!
  let box: Box = { min: [bb.min.x, bb.min.y, bb.min.z], max: [bb.max.x, bb.max.y, bb.max.z] }
  for (const o of organs.values()) {
    o.geo.computeBoundingBox()
    const ob = o.geo.boundingBox!
    box = unionBox(box, translateBox({ min: [ob.min.x, ob.min.y, ob.min.z], max: [ob.max.x, ob.max.y, ob.max.z] }, o.center))
  }
  cache = { organs, skin, muscles: buildMuscles(), box }
  return cache
}

export const BODY_CENTER: V3 = [0, 3.25, 0]
