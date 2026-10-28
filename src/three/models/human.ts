import * as THREE from 'three/webgpu'
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'
import { Builder, getBuilderLod, recenter, setBuilderLod, type V3 } from './builder'
import { buildAnatomy, noise3, smoothstep } from './humanOrgans'
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
import { ARM, ARM_R, LEG, LEG_R, buildHumanSkin } from './humanSkin'
export { ORGAN_LIST }

const mx = (k: number, p: V3): V3 => [p[0] * k, p[1], p[2]]

/** The sensory and organ shapes, authored directly in body space (feet at y = 0, facing +z). */
function build(id: string): THREE.BufferGeometry {
  const b = new Builder()
  if (buildAnatomy(id, b)) return b.build()
  switch (id) {
    case 'brain': {
      // Two folded hemispheres with a real gap between them, temporal lobes underneath, a ridged cerebellum at the
      // back and the brain stem going down. Built directly in body space, well inside the skull.
      for (const k of [-1, 1]) {
        b.geo(foldedLobe([k * 0.14, 6.43, -0.1], [0.13, 0.19, 0.29], k, 'cortex'), {}, grayPaint)
        b.geo(foldedLobe([k * 0.2, 6.3, -0.04], [0.08, 0.065, 0.17], k, 'cortex'), {}, grayPaint)
      }
      b.geo(foldedLobe([0, 6.24, -0.3], [0.2, 0.085, 0.1], 0, 'cerebellum'), {}, grayPaint)
      b.limb([[0, 6.27, -0.2], [0, 6.15, -0.2], [0, 6.05, -0.18]], [[0.065, 0.06], [0.047, 0.047], [0.036, 0.036]], { c: '#d9d2d6' }, { radial: 14, seg: 5 })
      break
    }
    case 'eyes':
      // Eyeballs set back in the sockets: a white globe, a darker iris ring and a small pupil at the front, so they read
      // as eyes and not as cartoon discs. The medium tier and up swaps in a scanned eyeball (labScans.ts).
      for (const k of [-1, 1]) {
        b.ell([k * 0.165, 6.18, 0.33], [0.058, 0.054, 0.056], '#fff', [0, 0, 0], 18, 14)
          .ell([k * 0.165, 6.18, 0.381], [0.03, 0.03, 0.008], '#8f8a80', [0, 0, 0], 14, 6)
          .ell([k * 0.165, 6.18, 0.386], [0.013, 0.013, 0.005], '#17120d', [0, 0, 0], 10, 6)
      }
      break
    case 'ears':
      // Outer ears at the sides of the head where the shell has its ear bumps: a thin upright shell, a raised rim and a
      // shallow bowl in front of the ear canal.
      for (const k of [-1, 1]) {
        b.ell([k * 0.425, 6.13, -0.02], [0.026, 0.1, 0.066], '#fff', [0, 0, k * 0.12], 12, 12)
          .ell([k * 0.44, 6.17, -0.035], [0.016, 0.05, 0.04], '#d8d8d8', [0, 0, k * 0.12], 10, 8)
          .ell([k * 0.43, 6.09, 0.0], [0.02, 0.03, 0.028], '#9a9a9a', [0, 0, 0], 10, 8)
      }
      break
    case 'nose':
      // The outer nose just under the shell surface: a narrow bridge that widens to a rounded tip and two nostril
      // wings, instead of the old tube that pointed down and read as a beak.
      b.ell([0, 6.09, 0.535], [0.034, 0.1, 0.04], '#fff', [-0.45, 0, 0], 14, 12)
        .ell([0, 6.04, 0.555], [0.046, 0.07, 0.045], '#fff', [-0.45, 0, 0], 14, 12)
        .ell([0, 5.99, 0.58], [0.048, 0.04, 0.042], '#fff', [0, 0, 0], 14, 10)
        .ell([-0.05, 5.965, 0.545], [0.03, 0.026, 0.034], '#e0e0e0', [0, 0, 0], 10, 8)
        .ell([0.05, 5.965, 0.545], [0.03, 0.026, 0.034], '#e0e0e0', [0, 0, 0], 10, 8)
      break
    case 'tongue':
      // A narrow, rounded tongue lying in the floor of the mouth: thick at the root, tapering to a rounded tip that
      // stays just behind the lips (the sculpted lips are at z 0.5), with a darker groove down the middle. Sitting at the
      // mouth and not deep in the throat keeps it under the lips as the figure turns.
      b.ell([0, 5.84, 0.17], [0.064, 0.05, 0.1], '#fff', [0, 0, 0], 16, 10)
        .ell([0, 5.85, 0.32], [0.06, 0.03, 0.13], '#fff', [0.12, 0, 0], 18, 10)
        .ell([0, 5.876, 0.31], [0.01, 0.006, 0.1], '#a0a0a0', [0.12, 0, 0], 8, 6)
      break
  }
  return b.build()
}

/** Paint for the brain: the `t` channel carries the shade (grooves dark, ridges light). */
const grayPaint = (t: number, _cs: number, _sn: number, out: THREE.Color): void => {
  out.setRGB(t, t, t)
}

/**
 * One brain lobe: an ellipsoid whose surface is pushed in along winding grooves (sulci) and left proud between them
 * (gyri). `side` is -1 or 1 for a hemisphere (its inner face is flattened so a fissure shows between the two), 0 for
 * the cerebellum, which gets fine parallel ridges instead.
 */
function foldedLobe(c: V3, r: V3, side: number, kind: 'cortex' | 'cerebellum'): THREE.BufferGeometry {
  let g: THREE.BufferGeometry = new THREE.SphereGeometry(1, getBuilderLod() < 1 ? 38 : 56, getBuilderLod() < 1 ? 26 : 38)
  g.deleteAttribute('normal')
  g.deleteAttribute('uv')
  g = mergeVertices(g, 1e-4)
  const pos = g.getAttribute('position') as THREE.BufferAttribute
  const shade = new Float32Array(pos.count * 3)
  for (let i = 0; i < pos.count; i++) {
    let dx = pos.getX(i)
    const dy = pos.getY(i)
    const dz = pos.getZ(i)
    let depth = 0
    let tone = 1
    if (kind === 'cortex') {
      const wx = c[0] + dx * r[0]
      const wy = c[1] + dy * r[1]
      const wz = c[2] + dz * r[2]
      const n = 0.62 * noise3(wx * 17, wy * 17, wz * 17) + 0.38 * noise3(wx * 31 + 7, wy * 31, wz * 31)
      const groove = 1 - smoothstep(0.0, 0.085, Math.abs(n - 0.5))
      depth = 0.11 * groove
      tone = 1 - 0.5 * groove
      // flat inner face: dark where the hemispheres meet
      const inner = side !== 0 ? smoothstep(0.55, 0.95, -dx * side) : 0
      if (side !== 0 && -dx * side > 0.78) dx = -0.78 * side
      tone *= 1 - 0.55 * inner
      depth += 0.0
    } else {
      const ridge = 0.5 + 0.5 * Math.sin((c[1] + dy * r[1]) * 210 + dx * 2)
      depth = 0.09 * (1 - ridge)
      tone = 0.62 + 0.38 * ridge
    }
    const k = 1 - depth
    pos.setXYZ(i, c[0] + dx * r[0] * k, c[1] + dy * r[1] * k, c[2] + dz * r[2] * k)
    shade[i * 3] = tone
  }
  g.setAttribute('paint', new THREE.BufferAttribute(shade, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2))
  g.computeVertexNormals()
  return g
}

/** Whole body outer shell: one smooth sculpted surface, see humanSkin.ts. Feet at y = 0, facing +z. */
function buildSkin(cell?: number): THREE.BufferGeometry {
  return new Builder().colored(buildHumanSkin(cell)).build()
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

type HumanModel = { organs: Map<string, OrganDef>; skin: THREE.BufferGeometry; muscles: THREE.BufferGeometry; box: Box }
const cache: { full: HumanModel | null; low: HumanModel | null } = { full: null, low: null }
/** Low tier: same sculpt and organs, a coarser skin grid and fewer organ segments (about half the triangles). */
const LOW_LOD = 0.7
const LOW_SKIN_CELL = 0.065

/** CPU side geometry cache shared by Lab A, the briefing and the item visuals. `low` is the lighter Low tier build. */
export function humanModel(low = false): HumanModel {
  const hit = low ? cache.low : cache.full
  if (hit) return hit
  const prevLod = getBuilderLod()
  setBuilderLod(low ? LOW_LOD : 1)
  const organs = new Map<string, OrganDef>()
  for (const o of ORGAN_LIST) {
    if (o.id === 'skin') continue
    const geo = build(o.id)
    const center = recenter(geo)
    organs.set(o.id, { ...o, center, geo })
  }
  const skin = buildSkin(low ? LOW_SKIN_CELL : undefined)
  skin.computeBoundingBox()
  const bb = skin.boundingBox!
  let box: Box = { min: [bb.min.x, bb.min.y, bb.min.z], max: [bb.max.x, bb.max.y, bb.max.z] }
  for (const o of organs.values()) {
    o.geo.computeBoundingBox()
    const ob = o.geo.boundingBox!
    box = unionBox(box, translateBox({ min: [ob.min.x, ob.min.y, ob.min.z], max: [ob.max.x, ob.max.y, ob.max.z] }, o.center))
  }
  const model = { organs, skin, muscles: buildMuscles(), box }
  setBuilderLod(prevLod)
  if (low) cache.low = model
  else cache.full = model
  return model
}

export const BODY_CENTER: V3 = [0, 3.3, 0]
