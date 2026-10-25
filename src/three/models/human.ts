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

const mx = (k: number, p: V3): V3 => [p[0] * k, p[1], p[2]]

/** Spine of one arm, shoulder to wrist, relaxed and angled slightly out and forward with a soft elbow. */
const ARM: V3[] = [[0.62, 5.16, 0], [1.0, 4.96, 0], [1.17, 4.5, 0.0], [1.34, 4.0, 0.03], [1.5, 3.58, 0.17], [1.64, 3.15, 0.3]]
const ARM_R = [0.3, 0.3, 0.235, 0.185, 0.155, 0.1]
const LEG: V3[] = [[0.32, 3.12, 0], [0.34, 2.45, 0.02], [0.36, 1.75, 0.05], [0.35, 1.05, 0.0], [0.33, 0.45, -0.01], [0.33, 0.2, 0]]
const LEG_R = [0.4, 0.35, 0.26, 0.24, 0.15, 0.12]

/** The sensory and organ shapes, authored directly in body space (feet at y = 0, facing +z). */
function build(id: string): THREE.BufferGeometry {
  const b = new Builder()
  switch (id) {
    case 'brain':
      for (const k of [-1, 1]) {
        b.ell([k * 0.11, 6.36, 0.0], [0.19, 0.2, 0.3], '#fff', [0, 0, 0], 28, 18)
          .ell([k * 0.12, 6.4, 0.17], [0.17, 0.17, 0.14], '#fff', [0, 0, 0], 20, 14)
          .ell([k * 0.17, 6.22, -0.02], [0.12, 0.1, 0.22], '#fff', [0, 0, k * 0.2], 20, 14)
          .ell([k * 0.1, 6.42, -0.17], [0.15, 0.15, 0.14], '#fff', [0, 0, 0], 20, 14)
      }
      b.ell([0, 6.14, -0.27], [0.19, 0.09, 0.11], '#fff', [0, 0, 0], 20, 14).limb([[0, 6.2, -0.1], [0, 6.08, -0.1], [0, 6.0, -0.08]], [0.07, 0.055, 0.04], {}, { radial: 10 })
      break
    case 'heart':
      b.limb([[0.06, 4.62, 0.12], [0.15, 4.4, 0.14], [0.26, 4.15, 0.15]], [[0.3, 0.25], [0.3, 0.26], [0.07, 0.07]], {}, { radial: 18 })
        .ell([-0.05, 4.66, 0.06], [0.15, 0.13, 0.13], '#fff', [0, 0, 0.3])
        .limb([[0.04, 4.7, 0.1], [0.04, 4.95, 0.1], [-0.08, 5.07, 0.08], [-0.2, 5.0, 0.06]], 0.075, {}, { radial: 12 })
        .limb([[0.2, 4.68, 0.2], [0.26, 4.9, 0.18], [0.3, 4.96, 0.1]], 0.06, {}, { radial: 10 })
      break
    case 'lungs':
      for (const k of [-1, 1]) {
        const w = k < 0 ? 1 : 0.9
        b.limb([[k * 0.38, 4.3, 0.04], [k * 0.4, 4.7, 0.04], [k * 0.3, 5.15, 0.02]], [[0.3 * w, 0.26], [0.3 * w, 0.27], [0.12, 0.13]], {}, { radial: 18, seg: 8 })
      }
      b.limb([[0, 5.5, 0.0], [0, 5.2, 0.0], [0, 4.92, 0.0]], 0.065, {}, { radial: 10 })
        .limb([[0, 4.92, 0], [-0.1, 4.78, 0], [-0.22, 4.62, 0]], 0.05, {}, { radial: 8 })
        .limb([[0, 4.92, 0], [0.1, 4.78, 0], [0.22, 4.62, 0]], 0.05, {}, { radial: 8 })
      break
    case 'liver':
      b.limb([[-0.58, 3.82, 0.1], [-0.3, 3.88, 0.12], [0.02, 3.8, 0.15], [0.3, 3.68, 0.15]], [[0.2, 0.2], [0.28, 0.27], [0.22, 0.2], [0.08, 0.08]], {}, { radial: 18, seg: 8 })
        .ell([-0.12, 3.64, 0.24], [0.1, 0.07, 0.07], '#fff', [0, 0, 0.3])
      break
    case 'stomach':
      b.limb([[0.1, 4.02, 0.14], [0.32, 3.9, 0.17], [0.46, 3.66, 0.18], [0.38, 3.4, 0.18], [0.14, 3.34, 0.17], [-0.05, 3.4, 0.15]], [0.07, 0.19, 0.26, 0.2, 0.1, 0.07], {}, { radial: 16, seg: 8 })
        .limb([[0.0, 4.55, 0.02], [0.06, 4.28, 0.06], [0.1, 4.04, 0.13]], 0.05, {}, { radial: 8 })
      break
    case 'pancreas':
      b.limb([[-0.34, 3.2, 0.04], [-0.1, 3.3, 0.06], [0.2, 3.34, 0.07], [0.48, 3.42, 0.04]], [[0.1, 0.1], [0.12, 0.09], [0.1, 0.08], [0.15, 0.12]], {}, { radial: 14, seg: 8 })
      break
    case 'small-intestine': {
      const pts: V3[] = []
      const rows = 5
      for (let k = 0; k < rows; k++) {
        const y = 3.42 - k * 0.14
        const dir = k % 2 === 0 ? 1 : -1
        pts.push([-0.3 * dir, y, 0.2], [-0.05 * dir, y + 0.03, 0.24], [0.2 * dir, y - 0.02, 0.2], [0.34 * dir, y - 0.01, 0.22])
        // Rounded turn at the end of each pass so the tube never folds onto itself.
        if (k < rows - 1) pts.push([0.42 * dir, y - 0.07, 0.22])
      }
      b.limb(pts, 0.062, {}, { radial: 10, seg: 5 })
      break
    }
    case 'large-intestine':
      b.limb(
        [[-0.44, 2.94, 0.1], [-0.5, 3.2, 0.1], [-0.5, 3.5, 0.1], [-0.36, 3.64, 0.1], [0, 3.58, 0.12], [0.36, 3.64, 0.1], [0.5, 3.5, 0.1], [0.5, 3.2, 0.1], [0.44, 2.98, 0.1], [0.28, 2.9, 0.12], [0.08, 2.96, 0.12]],
        [0.1, 0.11, 0.11, 0.11, 0.11, 0.11, 0.11, 0.11, 0.1, 0.09, 0.075],
        {},
        { radial: 12, seg: 6 },
      )
      break
    case 'kidneys':
      for (const k of [-1, 1]) b.ell([k * 0.4, 3.66 + (k > 0 ? 0.06 : 0), -0.22], [0.13, 0.25, 0.12], '#fff', [0, 0, k * 0.22], 16, 12)
      break
    case 'bladder':
      b.limb([[0, 2.82, 0.1], [0, 2.98, 0.1], [0, 3.14, 0.1]], [[0.1, 0.1], [0.18, 0.16], [0.06, 0.06]], {}, { radial: 14 })
      break
    case 'eyes':
      // Small and set into the face: the shell silhouette stays readable, the eyes are a subtle glint.
      for (const k of [-1, 1]) {
        b.ell([k * 0.17, 6.18, 0.35], [0.075, 0.075, 0.075], '#fff', [0, 0, 0], 16, 12).ell([k * 0.17, 6.18, 0.42], [0.036, 0.036, 0.022], '#241c14', [0, 0, 0], 12, 8)
      }
      break
    case 'ears':
      // At the sides of the head, where the shell has its own ear bumps.
      for (const k of [-1, 1]) {
        b.ell([k * 0.43, 6.13, -0.02], [0.045, 0.095, 0.065], '#fff', [0, 0, k * 0.12], 12, 10)
      }
      break
    case 'nose':
      b.limb([[0, 6.14, 0.22], [0, 6.04, 0.42], [0, 5.97, 0.53]], [[0.05, 0.05], [0.07, 0.07], [0.09, 0.08]], {}, { radial: 12 })
        .ell([-0.065, 5.95, 0.5], [0.045, 0.04, 0.05], '#fff', [0, 0, 0], 10, 8)
        .ell([0.065, 5.95, 0.5], [0.045, 0.04, 0.05], '#fff', [0, 0, 0], 10, 8)
      break
    case 'tongue':
      b.limb([[0, 5.88, -0.04], [0, 5.86, 0.16], [0, 5.87, 0.34]], [[0.1, 0.05], [0.12, 0.055], [0.08, 0.045]], {}, { radial: 12 })
      break
  }
  const geo = b.build()
  if (id === 'brain') {
    // Shrink about the middle of the skull so both lobes sit well inside the head shell.
    geo.translate(0, -6.3, 0.05)
    geo.scale(0.8, 0.8, 0.8)
    geo.translate(0, 6.38, -0.13)
    foldBrain(geo)
  }
  return geo
}

/** Darkens vertex colors along winding grooves so the two lobes read as a folded cortex. */
function foldBrain(geo: THREE.BufferGeometry): void {
  const pos = geo.getAttribute('position')
  const col = geo.getAttribute('color') as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const v = Math.sin(x * 46 + 2.2 * Math.sin(y * 27 + z * 15)) * Math.sin(z * 38 + 1.8 * Math.sin(x * 19 + y * 23))
    const g = 0.66 + 0.34 * smoothstep(-0.55, 0.45, v)
    col.setXYZ(i, g, g, g)
  }
}

const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/**
 * Whole body outer shell. A smooth stylized adult built from tapered tubes: neck, sloped shoulders, relaxed arms
 * with a soft elbow bend, a sculpted head (jaw, brow, nose, ear bumps), legs and feet. Feet at y = 0, about 6.6 units
 * tall, facing +z. Torso organs sit between 2.8 and 5.3, head organs inside the skull.
 */
function buildSkin(): THREE.BufferGeometry {
  const b = new Builder()
  // Trunk: pelvis, waist, ribcage, shoulders, neck, one smooth sweep.
  b.limb(
    [[0, 3.25, 0.0], [0, 3.8, 0.0], [0, 4.5, 0.0], [0, 5.1, 0.0], [0, 5.34, 0.01], [0, 5.55, 0.03], [0, 5.78, 0.06]],
    [[0.6, 0.42], [0.55, 0.39], [0.7, 0.47], [0.9, 0.43], [0.7, 0.36], [0.34, 0.3], [0.28, 0.27]],
    {},
    { radial: 24, seg: 7 },
  )
  // Head: jaw tapers to a chin, cranium is deeper than it is wide, face leans forward.
  b.limb([[0, 5.88, 0.15], [0, 6.02, 0.08], [0, 6.22, 0.04], [0, 6.36, -0.01]], [[0.18, 0.21], [0.35, 0.39], [0.41, 0.47], [0.37, 0.45]], {}, { radial: 24, seg: 7, cap: 5 })
  // Nose bridge and brow ridge: small features so the face reads without becoming a mask.
  b.limb([[0, 6.2, 0.4], [0, 6.07, 0.5], [0, 5.99, 0.6]], [[0.045, 0.05], [0.07, 0.07], [0.085, 0.075]], {}, { radial: 12, seg: 6 })
  b.limb([[-0.31, 6.27, 0.3], [-0.16, 6.3, 0.41], [0, 6.3, 0.44], [0.16, 6.3, 0.41], [0.31, 6.27, 0.3]], 0.06, {}, { radial: 10, seg: 6 })
  for (const k of [-1, 1]) {
    // Ear bumps give the head its human silhouette; the ear organ sits inside them.
    b.ell([k * 0.42, 6.13, -0.02], [0.07, 0.125, 0.09], '#fff', [0, 0, k * 0.12], 14, 10)
    b.limb(ARM.map((p) => mx(k, p)), ARM_R, {}, { radial: 14, seg: 6 })
    // Hand: flat palm and fingers with a thumb tucked forward.
    b.limb([[k * 1.64, 3.15, 0.3], [k * 1.7, 2.96, 0.35], [k * 1.74, 2.72, 0.39], [k * 1.76, 2.5, 0.41]], [[0.1, 0.06], [0.125, 0.06], [0.12, 0.05], [0.05, 0.035]], {}, { radial: 12, seg: 5 })
    b.limb([[k * 1.62, 3.02, 0.36], [k * 1.54, 2.9, 0.46], [k * 1.52, 2.76, 0.52]], [0.05, 0.042, 0.03], {}, { radial: 8, seg: 5 })
    b.limb(LEG.map((p) => mx(k, p)), LEG_R, {}, { radial: 16, seg: 6 })
    b.limb([[k * 0.35, 0.17, -0.12], [k * 0.36, 0.13, 0.22], [k * 0.37, 0.1, 0.62]], [[0.13, 0.11], [0.15, 0.1], [0.12, 0.06]], {}, { radial: 12, seg: 6 })
  }
  return b.build()
}

/** General muscle bulk shown on the figure when an item asks about muscles. */
function buildMuscles(): THREE.BufferGeometry {
  const b = new Builder()
  b.ell([0, 4.78, 0.28], [0.7, 0.34, 0.2], '#fff', [0, 0, 0], 20, 12)
  for (const k of [-1, 1]) {
    b.ell([k * 0.95, 5.02, 0.02], [0.33, 0.34, 0.31], '#fff')
    b.limb(ARM.slice(0, 4).map((p) => mx(k, p)), ARM_R.slice(0, 4).map((r) => r * 1.14), {}, { radial: 12, seg: 5 })
    b.limb(LEG.slice(0, 5).map((p) => mx(k, p)), LEG_R.slice(0, 5).map((r) => r * 1.12), {}, { radial: 14, seg: 5 })
  }
  return b.build()
}

let cache: { organs: Map<string, OrganDef>; skin: THREE.BufferGeometry; muscles: THREE.BufferGeometry; box: Box } | null = null

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

export const BODY_CENTER: V3 = [0, 3.3, 0]
