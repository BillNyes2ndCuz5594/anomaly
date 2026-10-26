import * as THREE from 'three/webgpu'
import { Builder, getBuilderLod, lerpHex, smooth, type V3 } from './builder'
import { chain, ellipsoid, makeField, makeSdf, meshField, primBounds, raycast, type Field, type Prim, type SculptPaint } from './sculpt'
import { frame, off, wob } from './placement'

// Barred owl, sculpted as one continuous plumage surface: egg shaped body, round head with no tufts, folded wings that
// wrap the sides, short flat tail and feathered thighs. Facial disc, bars, streaks and wing spots are painted by position.
// The eyes, beak, talons and the perch are small separate parts set against the sculpt (ray cast, so they sit flush).

const WET: [number, number] = [1, 0]
const mirrorZ = [1, -1]

const COL = {
  back: new THREE.Color('#5b4431'),
  mid: new THREE.Color('#7b6247'),
  dark: new THREE.Color('#3b2c20'),
  cream: new THREE.Color('#d9ccb0'),
  white: new THREE.Color('#eee7d4'),
  streak: new THREE.Color('#6b4e37'),
  disc: new THREE.Color('#bdae94'),
  discRing: new THREE.Color('#8e7c64'),
  rim: new THREE.Color('#3a2a1c'),
}

const hash = (i: number, j: number): number => {
  const v = Math.sin(i * 127.1 + j * 311.7) * 43758.5453
  return v - Math.floor(v)
}

const EYE_Z = 0.215
const EYE_Y = 2.12

/** Pure description of the plumage, so tests can check proportions without meshing. */
export function owlBody(): Prim[] {
  const P: Prim[] = []
  const add = (...p: Prim[]) => void P.push(...p)
  // egg shaped trunk: heavy chest, rounder belly, shoulders running into the head with no neck
  add(ellipsoid([-0.02, 0.98, 0], [0.52, 0.5, 0.52], 0.25))
  add(ellipsoid([0.1, 1.34, 0], [0.58, 0.58, 0.6], 0.25))
  add(ellipsoid([-0.06, 1.66, 0], [0.52, 0.45, 0.57], 0.25))
  add(ellipsoid([0.1, 1.92, 0], [0.5, 0.3, 0.5], 0.2))
  // big round head, a little wider than tall, with full cheeks and a slightly flattened face
  add(ellipsoid([0.12, 2.16, 0], [0.48, 0.41, 0.56], 0.12))
  add(ellipsoid([0.36, 2.1, 0], [0.2, 0.34, 0.47], 0.1))
  for (const k of mirrorZ) {
    add(ellipsoid([0.16, 2.04, k * 0.32], [0.32, 0.3, 0.27], 0.1))
    // soft brow ridge over each eye
    add(ellipsoid([0.4, 2.3, k * 0.22], [0.13, 0.06, 0.17], 0.05))
  }
  // feathered thighs
  for (const k of mirrorZ) add(ellipsoid([0.1, 0.66, k * 0.2], [0.2, 0.3, 0.16], 0.12))
  return P
}

export function owlWings(): Prim[] {
  const P: Prim[] = []
  for (const k of mirrorZ) P.push(...chain([[-0.02, 1.84, k * 0.5], [-0.18, 1.2, k * 0.54], [-0.4, 0.62, k * 0.42], [-0.56, 0.26, k * 0.28]], [0.3, 0.27, 0.17, 0.05], 0.05, 0.42, 6))
  return P
}

export function owlTail(): Prim[] {
  return [
    ellipsoid([-0.34, 0.6, 0], [0.07, 0.3, 0.2], 0.05),
    ellipsoid([-0.5, 0.38, 0], [0.07, 0.3, 0.215], 0.05),
    ellipsoid([-0.64, 0.22, 0], [0.06, 0.22, 0.19], 0.05),
  ]
}

export const owlPrims = (): Prim[] => [...owlBody(), ...owlWings(), ...owlTail()]

/** Branch the owl grips: rises from the ground at one end and runs across the owl's feet. */
export const BRANCH: V3[] = [[0.06, 0.12, -1.0], [0.1, 0.2, -0.5], [0.1, 0.31, 0.0], [0.12, 0.35, 0.55], [0.12, 0.33, 0.95]]
const BRANCH_R = [0.15, 0.12, 0.09, 0.075, 0.04]

let fieldCache: { all: Field; wing: (x: number, y: number, z: number) => number; tail: (x: number, y: number, z: number) => number } | null = null
const fields = () =>
  (fieldCache ??= { all: makeField(owlPrims()), wing: makeSdf(owlWings()), tail: makeSdf(owlTail()) })

const owlPaint: SculptPaint = (p, n, out) => {
  const [x, y, z] = p
  const { wing, tail } = fields()
  const th = Math.atan2(z, x - 0.02)
  const az = Math.abs(z)
  // ----- base: warm brown back, pale front
  const front = smooth(1.5, 0.9, Math.abs(th))
  out.copy(COL.back).lerp(COL.mid, 0.5 + 0.5 * wob(x, y, z))
  // pale buff speckle over the back and crown, like edge-lit feather tips
  const speck = smooth(0.62, 0.8, wob(x * 1.7 + 3, y * 1.7, z * 1.7)) * (1 - front)
  out.lerp(COL.cream, speck * 0.5)
  // ----- breast and belly: cream, with dark bars high on the chest and brown streaks below
  const bellyMask = front * smooth(2.0, 1.75, y)
  out.lerp(COL.cream, bellyMask * 0.95)
  const barY = y * 40 + 1.1 * Math.sin(th * 4) + 0.5 * wob(x, y, z)
  const bar = smooth(0.15, 0.7, Math.sin(barY)) * smooth(1.4, 1.52, y) * smooth(2.0, 1.86, y) * smooth(1.55, 0.7, Math.abs(th))
  out.lerp(COL.dark, bar * 0.7)
  const stk = smooth(0.35, 0.8, Math.sin(th * 24 + 0.9 * Math.sin(y * 7 + th * 2))) * smooth(1.46, 1.3, y) * smooth(0.5, 0.75, y) * smooth(1.45, 0.4, Math.abs(th))
  out.lerp(COL.streak, stk * 0.8)
  // ----- wings: dark brown, rows of white spots on the coverts, pale bars on the long flight feathers
  const dw = wing(x, y, z)
  const wm = smooth(0.03, 0.0, dw) * smooth(0.12, 0.3, az)
  if (wm > 0) {
    const w = new THREE.Color().copy(COL.back).lerp(COL.dark, 0.3 + 0.2 * wob(x, y, z))
    // staggered rows of broken pale spots on the coverts (jittered, uneven in size), pale bars on the flight feathers
    const s = (0.32 * x + 0.95 * y) / 0.11
    const c = (0.95 * x - 0.32 * y) / 0.085
    const row = Math.floor(s)
    const ci = Math.floor(c + 0.5 * (row & 1))
    const fs = s - row - 0.5 - 0.22 * (hash(row, ci) - 0.5)
    const fc = c + 0.5 * (row & 1) - ci - 0.5 - 0.25 * (hash(ci, row + 7) - 0.5)
    const sz = 0.16 + 0.2 * hash(row + 3, ci + 1)
    const spot = smooth(sz, sz - 0.1, Math.hypot(fs * 0.9, fc * 0.55)) * smooth(0.6, 0.95, y) * (hash(ci, row) > 0.2 ? 1 : 0)
    const bars = smooth(0.1, 0.55, Math.sin(s * 2.4 + 0.6 * wob(x, y, z))) * smooth(1.15, 0.75, y)
    w.lerp(COL.cream, spot * 0.65)
    w.lerp(COL.mid, bars * 0.6)
    out.lerp(w, wm)
  }
  // ----- tail: brown with pale bars and a pale tip
  const tm = smooth(0.03, 0.0, tail(x, y, z)) * smooth(0.0, -0.1, x)
  if (tm > 0) {
    const t = new THREE.Color().copy(COL.mid)
    t.lerp(COL.dark, smooth(0.25, 0.6, Math.sin(y * 24)) * 0.7)
    t.lerp(COL.cream, smooth(0.25, 0.1, y) * 0.3)
    out.lerp(t, tm)
  }
  // ----- facial disc: pale grey brown, soft concentric rings, dark rim, pale V between the eyes
  const faceW = smooth(0.14, 0.3, x) * smooth(1.78, 1.9, y) * smooth(2.48, 2.38, y) * smooth(-0.2, 0.2, n[0])
  if (faceW > 0) {
    let d = 9
    for (const k of mirrorZ) d = Math.min(d, Math.hypot((z - k * 0.2) / 0.29, (y - EYE_Y) / 0.33))
    const inside = smooth(1.2, 1.05, d)
    const ring = 0.5 + 0.5 * Math.sin(d * 26)
    const disc = new THREE.Color().copy(COL.disc).lerp(COL.discRing, ring * 0.7 * smooth(0.2, 0.55, d))
    disc.lerp(COL.white, smooth(0.14, 0.0, az) * smooth(2.1, 2.3, y) * 0.65)
    // darker patches around the eyes
    for (const k of mirrorZ) disc.lerp(COL.dark, smooth(0.17, 0.09, Math.hypot(z - k * EYE_Z, (y - EYE_Y) * 0.9)) * 0.9)
    // soft dark rim and a fine ruff of pale feather tips outside it
    const rim = smooth(0.8, 0.95, d) * smooth(1.2, 1.05, d)
    disc.lerp(COL.rim, rim * 0.8)
    const base = new THREE.Color().copy(out)
    out.lerp(disc, faceW * inside)
    out.lerp(COL.rim, faceW * rim * 0.75)
    void base
  }
  // chin and throat bib
  out.lerp(COL.cream, smooth(1.92, 1.82, y) * smooth(1.7, 1.85, y) * smooth(0.1, 0.3, x) * 0.6)
  // soft broken variation
  out.multiplyScalar(1 + 0.05 * wob(x * 1.3, y * 1.3, z * 1.3))
}

export function owlModel(b: Builder): void {
  const fld = fields().all
  const f = fld.f
  const prims = owlPrims()
  const lod = getBuilderLod()
  const cell = 0.03 / Math.max(0.5, lod)
  const { lo, hi } = primBounds(prims, 0.25)
  b.colored(meshField(fld, lo, hi, cell, owlPaint))

  for (const k of mirrorZ) {
    // large dark eye set into the disc: near black iris, deeper pupil, one bright highlight
    const eh = raycast(f, [1.2, EYE_Y, k * EYE_Z], [-1, 0, 0])
    if (eh) {
      const n = eh.n
      const rot = frame(n)
      const q = (d: number): V3 => off(eh.p, n, d)
      b.ell(q(-0.018), [0.108, 0.114, 0.026], '#33210f', rot, 22, 14)
      b.ell(q(-0.012), [0.092, 0.098, 0.026], '#150b06', rot, 22, 14)
      b.ell(q(-0.004), [0.054, 0.058, 0.026], '#010101', rot, 14, 10)
      b.ell(off(off(q(0.004), [0, 1, 0], 0.036), [0, 0, k], 0.024), [0.011, 0.011, 0.007], '#d8e2e6', rot, 6, 5, WET)
    }
  }
  // small yellow hooked beak, half hidden in the feathers between the eyes
  const bh = raycast(f, [1.3, 2.03, 0], [-1, 0, 0])
  const bx = bh ? bh.p[0] : 0.55
  b.limb([[bx - 0.06, 2.09, 0], [bx + 0.05, 2.05, 0], [bx + 0.1, 1.98, 0], [bx + 0.09, 1.92, 0]], [[0.07, 0.055], [0.06, 0.05], [0.036, 0.036], [0.01, 0.01]], { c: '#cdae4a' }, { radial: 12, seg: 5, cap: 3 })
  // branch
  b.limb(BRANCH, BRANCH_R, { c: '#5c4a3a' }, { radial: 14, seg: 8, cap: 4, paint: (t, cs, sn, out) => {
    out.set('#5a4838')
    lerpHex(out, '#3e3126', smooth(0.5, 1, Math.sin(cs * 14 + sn * 3)) * 0.4)
    lerpHex(out, '#6f5c49', (1 - smooth(0.0, 0.3, t)) * 0.25)
  } })
  // a short broken twig and a knot give the branch some character
  b.limb([[0.1, 0.24, -0.55], [0.04, 0.5, -0.7], [-0.02, 0.68, -0.76]], [0.04, 0.03, 0.016], { c: '#54432f' }, { radial: 8, seg: 4, cap: 3 })
  b.ell([0.12, 0.2, -0.28], [0.06, 0.05, 0.06], '#4a3a2b', [0, 0, 0], 8, 6)
  // strong grey yellow feet gripping the branch: three toes forward over it, one back, dark curved talons
  for (const k of mirrorZ) {
    const z0 = k * 0.2
    for (const [dz, fwd] of [[-0.07, 1], [0, 1], [0.07, 1], [0, -1]] as [number, number][]) {
      const zz = z0 + dz * (fwd > 0 ? 1 : 0)
      const pts: V3[] = fwd > 0 ? [[0.1, 0.44, zz], [0.25, 0.46, zz], [0.36, 0.38, zz], [0.37, 0.26, zz]] : [[0.1, 0.44, zz], [-0.04, 0.44, zz], [-0.14, 0.36, zz], [-0.14, 0.26, zz]]
      b.limb(pts, [0.05, 0.043, 0.036, 0.024], { c: '#b5a674' }, { radial: 8, seg: 3, cap: 3 })
      const e = pts[3]
      b.limb([e, [e[0] + 0.015 * fwd, e[1] - 0.05, e[2]], [e[0] - 0.03 * fwd, e[1] - 0.095, e[2]]], [0.026, 0.02, 0.005], { c: '#2c2822' }, { radial: 6, seg: 3, cap: 2 })
    }
  }
}
