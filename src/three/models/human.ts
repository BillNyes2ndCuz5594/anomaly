import * as THREE from 'three/webgpu'
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'
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
import { ARM, ARM_R, LEG, LEG_R, buildHumanSkin } from './humanSkin'
export { ORGAN_LIST }

const mx = (k: number, p: V3): V3 => [p[0] * k, p[1], p[2]]

/** The sensory and organ shapes, authored directly in body space (feet at y = 0, facing +z). */
function build(id: string): THREE.BufferGeometry {
  const b = new Builder()
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
  return b.build()
}

/** Smooth 3D value noise in 0..1. */
function noise3(x: number, y: number, z: number): number {
  const h = (i: number, j: number, k: number) => {
    let n = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(k, 1274126177)
    n = Math.imul(n ^ (n >>> 13), 1103515245)
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295
  }
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const zi = Math.floor(z)
  const f = (t: number) => t * t * (3 - 2 * t)
  const fx = f(x - xi)
  const fy = f(y - yi)
  const fz = f(z - zi)
  const l = (a: number, b: number, t: number) => a + (b - a) * t
  return l(
    l(l(h(xi, yi, zi), h(xi + 1, yi, zi), fx), l(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), fx), fy),
    l(l(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), fx), l(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), fx), fy),
    fz,
  )
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
  let g: THREE.BufferGeometry = new THREE.SphereGeometry(1, 56, 38)
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

const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** Whole body outer shell: one smooth sculpted surface, see humanSkin.ts. Feet at y = 0, facing +z. */
function buildSkin(): THREE.BufferGeometry {
  return new Builder().colored(buildHumanSkin()).build()
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
