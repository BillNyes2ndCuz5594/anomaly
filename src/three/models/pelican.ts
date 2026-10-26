import * as THREE from 'three/webgpu'
import { Builder, getBuilderLod, lerpHex, paintWith, smooth, type V3 } from './builder'
import { chain, ellipsoid, makeField, makeSdf, meshField, primBounds, type Field, type Prim, type SculptPaint } from './sculpt'
import { DARK, eye, sail } from './animals'
import { wob } from './placement'

// Brown pelican: one plumage surface for body, folded wings, S curved neck and head (smooth union of masses), with the
// long bill, throat pouch, legs and webbed feet added as clean separate parts.

const mirrorZ = [1, -1]
const THIN: [number, number] = [0, 1]

const COL = {
  body: new THREE.Color('#756a5b'),
  belly: new THREE.Color('#564b3f'),
  silver: new THREE.Color('#a39888'),
  wing: new THREE.Color('#8b7f6d'),
  prim: new THREE.Color('#3b3229'),
  neckBack: new THREE.Color('#4a3527'),
  neckFront: new THREE.Color('#ece4cb'),
  crown: new THREE.Color('#f1e3a6'),
}

const NECK: V3[] = [[0.7, 1.45, 0], [1.05, 1.8, 0], [0.82, 2.15, 0], [0.95, 2.45, 0], [1.25, 2.6, 0]]
const NECK_R = [0.3, 0.2, 0.14, 0.14, 0.17]

export function pelicanBody(): Prim[] {
  return [
    // heavy rounded body, deep at the chest, tail end lifted a little
    ellipsoid([0.5, 1.22, 0], [0.62, 0.58, 0.5], 0.25),
    ellipsoid([-0.15, 1.12, 0], [0.7, 0.56, 0.52], 0.25),
    ellipsoid([-0.82, 1.06, 0], [0.5, 0.38, 0.36], 0.22),
    ellipsoid([-1.15, 0.98, 0], [0.3, 0.2, 0.2], 0.15),
  ]
}

export function pelicanWings(): Prim[] {
  const P: Prim[] = []
  // folded wings, deep at the shoulder and running into long dark primaries that cross over the tail
  for (const k of mirrorZ) P.push(...chain([[0.5, 1.5, k * 0.45], [-0.3, 1.42, k * 0.52], [-1.0, 1.18, k * 0.45], [-1.8, 0.88, k * 0.3], [-2.35, 0.72, k * 0.2]], [0.22, 0.32, 0.26, 0.13, 0.03], 0.07, 0.5, 6))
  return P
}

export function pelicanNeck(): Prim[] {
  return [
    ...chain(NECK, NECK_R, 0.12, 1, 6),
    ellipsoid([1.38, 2.64, 0], [0.27, 0.2, 0.2], 0.1),
  ]
}

export const pelicanPrims = (): Prim[] => [...pelicanBody(), ...pelicanWings(), ...pelicanNeck()]

let fieldCache: { all: Field; wing: ReturnType<typeof makeSdf>; neck: ReturnType<typeof makeSdf> } | null = null
const fields = () => (fieldCache ??= { all: makeField(pelicanPrims()), wing: makeSdf(pelicanWings()), neck: makeSdf(pelicanNeck()) })

const paint: SculptPaint = (p, n, out) => {
  const [x, y, z] = p
  const { wing, neck } = fields()
  const az = Math.abs(z)
  out.copy(COL.body).lerp(COL.silver, 0.5 + 0.5 * wob(x, y, z) > 0.75 ? 0.35 : 0)
  // darker belly, silver streaked back and breast
  out.lerp(COL.belly, smooth(0.1, -0.7, n[1]) * 0.7)
  out.lerp(COL.silver, smooth(0.3, 0.9, n[1]) * 0.25 * smooth(-0.5, 0.2, x))
  // wings: a paler gray brown with fine scalloped feather edges, dark primaries toward the tip
  const wm = smooth(0.03, 0.0, wing(x, y, z)) * smooth(0.18, 0.32, az)
  if (wm > 0) {
    const w = new THREE.Color().copy(COL.wing)
    const row = (x * 0.9 + y * 0.9) * 9
    const scallop = smooth(0.6, 0.95, Math.sin(row * 3.1 + 1.3 * wob(x, y, z)))
    w.lerp(COL.prim, scallop * 0.38)
    w.lerp(COL.silver, 0.2 * smooth(-0.2, 0.9, y) * (1 - scallop))
    w.lerp(COL.prim, smooth(-0.9, -1.8, x) * 0.9)
    out.lerp(w, wm)
  }
  // neck and head: white in front, dark chestnut stripe down the back of the neck, pale yellow crown
  const nm = smooth(0.05, 0.0, neck(x, y, z)) * smooth(1.35, 1.6, y)
  if (nm > 0) {
    const c = new THREE.Color().copy(COL.neckFront)
    const back = smooth(0.7, 0.0, n[0]) * smooth(2.5, 2.3, y)
    const stripe = smooth(0.2, 0.08, az)
    c.lerp(COL.neckBack, Math.max(back * 0.9, stripe * smooth(2.38, 2.1, y) * smooth(1.5, 1.75, y) * 0.6))
    c.lerp(COL.crown, smooth(2.5, 2.62, y) * 0.8)
    // soft white-to-brown fade at the base of the neck
    c.lerp(COL.silver, smooth(1.75, 1.45, y) * 0.5)
    out.lerp(c, nm)
  }
  out.multiplyScalar(1 + 0.05 * wob(x * 1.3, y * 1.3, z * 1.3))
}

export function pelicanModel(b: Builder): void {
  const fld = fields().all
  const lod = getBuilderLod()
  const cell = 0.03 / Math.max(0.5, lod)
  const { lo, hi } = primBounds(pelicanPrims(), 0.2)
  b.colored(meshField(fld, lo, hi, cell, paint))

  // long slender bill, pale gray with a hooked tip, and the pouch slung beneath it
  b.limb([[1.5, 2.6, 0], [2.15, 2.44, 0], [2.85, 2.2, 0]], [[0.09, 0.075], [0.08, 0.06], [0.04, 0.03]], { c: '#bda987' }, { radial: 14, seg: 8, cap: 5 })
  b.limb([[2.82, 2.21, 0], [2.95, 2.14, 0], [2.97, 2.05, 0]], [0.036, 0.03, 0.012], { c: '#a08558' }, { radial: 8, seg: 4, cap: 3 })
  const pouch = paintWith((_t, _c, _s, out) => out.set('#bd9d7c'), (t, cs, sn, out) => {
    lerpHex(out, '#dcbb95', smooth(-0.2, 0.6, sn) * 0.4)
    lerpHex(out, '#8f7253', smooth(0.7, 1, t) * 0.6)
    lerpHex(out, '#a47f5b', smooth(0.7, 1, Math.sin(cs * 14 + t * 6)) * 0.12)
  })
  // pouch: a flat sack under the lower mandible, deep in the middle and tapering to the tip, running back into the throat
  b.limb([[1.5, 2.54, 0], [1.95, 2.28, 0], [2.4, 2.17, 0], [2.78, 2.14, 0]], [[0.1, 0.09], [0.14, 0.22], [0.1, 0.12], [0.03, 0.03]], { m: THIN }, { radial: 18, seg: 10, cap: 5, paint: pouch })
  b.limb([[1.5, 2.5, 0], [1.2, 2.36, 0], [0.98, 2.22, 0]], [[0.1, 0.09], [0.12, 0.1], [0.08, 0.07]], { m: THIN }, { radial: 12, seg: 6, cap: 3, paint: pouch })
  for (const k of mirrorZ) {
    eye(b, [1.42, 2.7, k * 0.15], 0.06, [0.4, 0.2, k], '#f3ecd0', false, DARK, '#7d6a52')
    // strong dark legs with a heavy upper joint, ankle bump and webbed feet, toes spread outward
    const z0 = k * 0.27
    b.limb([[0.12, 0.95, z0], [0.14, 0.55, z0], [0.17, 0.14, z0]], [0.12, 0.065, 0.052], { c: '#4a4339' }, { radial: 10, seg: 5, cap: 3 })
    b.ell([0.17, 0.12, z0], [0.07, 0.06, 0.06], '#4a4339', [0, 0, 0], 10, 8)
    const tips: V3[] = [-0.5, 0, 0.5].map((a): V3 => [0.17 + Math.cos(a) * 0.4, 0.03, z0 + k * Math.sin(a) * 0.4 + k * 0.05])
    sail(b, [[0.15, 0.03, z0 - 0.04], [0.15, 0.03, z0], [0.15, 0.03, z0 + 0.04]], tips.map((t) => [t[0] * 0.9 + 0.017, 0.03, t[2]] as V3), 0.012, '#6a6252', { rows: 3, plane: [0, 1, 0] })
    for (const t of tips) b.limb([[0.17, 0.05, z0], [(0.17 + t[0]) / 2, 0.04, (z0 + t[2]) / 2], [t[0], 0.03, t[2]]], [0.032, 0.026, 0.02], { c: '#4a4339' }, { radial: 8, seg: 4, cap: 3 })
  }
}
