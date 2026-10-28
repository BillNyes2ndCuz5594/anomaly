import * as THREE from 'three/webgpu'
import { Builder, getBuilderLod, smooth, type V3 } from './builder'
import { chain, cone, ellipsoid, makeField, meshField, primBounds, raycast, type Prim, type Field, type SculptPaint } from './sculpt'

// Florida panther (a cougar), sculpted as one continuous surface: smooth unions of muscle masses, tapered limbs and
// a long tail, meshed as a single indexed mesh. Eyes, ears, nose pad and whisker dots are small separate parts set
// into the surface (placed by ray casts against the sculpt, so they sit flush).

const WET: [number, number] = [1, 0]
const DARK = '#14100d'
const mirrorZ = [1, -1]

const COL = {
  tawny: new THREE.Color('#a9875f'),
  back: new THREE.Color('#5c4030'),
  pale: new THREE.Color('#e4d9c3'),
  mask: new THREE.Color('#3b2d22'),
  tip: new THREE.Color('#1f1712'),
  paw: new THREE.Color('#a07a52'),
}

const H = 0.26
/** Squeezes the rear half (x below 0.3) so the body stays compact: a cougar is long, but not a weasel. */
const R = (x: number): number => (x > 0.3 ? x : 0.3 + (x - 0.3) * 0.86)

/** Paw centers (x, z) for the four feet: the near foreleg and the far hind leg reach forward. */
export function pawSpots(): [number, number][] {
  const out: [number, number][] = []
  for (const k of mirrorZ) {
    const fs = k > 0 ? 0.28 : -0.26
    const hs = k > 0 ? -0.28 : 0.32
    out.push([0.98 + fs, k * 0.2], [R(-1.06) + hs, k * 0.21])
  }
  return out
}

/** Pure description of the shape, so tests can check proportions without meshing. */
export function pantherPrims(): Prim[] {
  const P: Prim[] = []
  const add = (...p: Prim[]) => void P.push(...p)
  // ----- torso: deep chest, gently tucked belly, round hips, one soft back line with a slight dip
  add(ellipsoid([0.5, 1.2 + H, 0], [0.8, 0.38, 0.31], 0.2))
  add(ellipsoid([R(-0.5), 1.18 + H, 0], [0.8, 0.31, 0.29], 0.22))
  add(ellipsoid([R(-1.1), 1.27 + H, 0], [0.42, 0.36, 0.3], 0.2))
  // chest keel hangs a little lower than the belly behind it, withers rise over the shoulders
  add(ellipsoid([0.7, 1.0 + H, 0], [0.5, 0.22, 0.22], 0.18))
  add(ellipsoid([0.84, 1.53 + H, 0], [0.3, 0.12, 0.17], 0.18))
  // ----- neck and head (carried low, in line with the back)
  add(cone([0.95, 1.4 + H, 0], [1.62, 1.5 + H, 0], 0.36, 0.27, 0.22, 0.94))
  add(ellipsoid([1.95, 1.57 + H, 0], [0.32, 0.3, 0.3], 0.14))
  add(ellipsoid([2.15, 1.42 + H, 0], [0.15, 0.135, 0.16], 0.12))
  add(cone([2.0, 1.58 + H, 0], [2.2, 1.47 + H, 0], 0.15, 0.12, 0.1, 1.1))
  add(ellipsoid([2.08, 1.29 + H, 0], [0.135, 0.06, 0.1], 0.07))
  for (const k of mirrorZ) {
    add(ellipsoid([1.98, 1.37 + H, k * 0.18], [0.2, 0.15, 0.13], 0.1))
    add(ellipsoid([2.06, 1.66 + H, k * 0.14], [0.1, 0.045, 0.09], 0.06))
    // shoulder and thigh muscle, kept a little apart from the ribs so the forms read
    add(ellipsoid([0.8, 1.22 + H, k * 0.22], [0.3, 0.42, 0.15], 0.12))
    add(ellipsoid([R(-1.0), 1.08 + H, k * 0.26], [0.36, 0.5, 0.21], 0.12))
  }
  // ----- legs
  for (const k of mirrorZ) {
    const fs = k > 0 ? 0.28 : -0.26
    const hs = k > 0 ? -0.28 : 0.32
    add(
      ...chain(
        [[0.8, 1.28 + H, k * 0.2], [0.62 + fs * 0.05, 0.86 + H * 0.5, k * 0.21], [0.76 + fs * 0.6, 0.45, k * 0.2], [0.84 + fs * 0.9, 0.2, k * 0.2], [0.88 + fs, 0.11, k * 0.2]],
        [0.2, 0.15, 0.092, 0.076, 0.082],
        0.14,
        0.92,
        6,
      ),
    )
    add(
      ...chain(
        [[R(-1.02), 1.28 + H, k * 0.23], [R(-0.76) + hs * 0.4, 0.88 + H * 0.5, k * 0.25], [R(-1.42) + hs * 0.8, 0.52, k * 0.22], [R(-1.3) + hs * 0.95, 0.24, k * 0.21], [R(-1.14) + hs, 0.11, k * 0.21]],
        [0.28, 0.19, 0.1, 0.076, 0.082],
        0.14,
        0.9,
        6,
      ),
    )
  }
  // elbow, wrist and hock points give the limbs their joints
  for (const k of mirrorZ) {
    const fs = k > 0 ? 0.28 : -0.26
    const hs = k > 0 ? -0.28 : 0.32
    add(ellipsoid([0.55 + fs * 0.05, 0.93 + H * 0.5, k * 0.26], [0.1, 0.1, 0.075], 0.06))
    add(ellipsoid([0.74 + fs * 0.55, 0.4, k * 0.24], [0.075, 0.1, 0.07], 0.05))
    add(ellipsoid([R(-1.5) + hs * 0.8, 0.56, k * 0.25], [0.085, 0.12, 0.07], 0.06))
  }
  for (const [x, z] of pawSpots()) add(ellipsoid([x - 0.02, 0.09, z], [0.2, 0.09, 0.125], 0.06))
  // ----- tail: long, thick, drooping behind the hips, curving down then up
  add(...chain([[R(-1.4), 1.34 + H, 0], [R(-1.9), 1.17 + H, 0], [R(-2.4), 0.84, 0], [R(-2.85), 0.52, 0], [R(-3.35), 0.4, 0], [R(-3.9), 0.5, 0], [R(-4.35), 0.82, 0]], [0.2, 0.18, 0.165, 0.152, 0.145, 0.135, 0.11], 0.12, 1, 6))
  return P
}

const TAIL_END: V3 = [R(-4.35), 0.82, 0]

const pantherPaint: SculptPaint = (p, n, out) => {
  const [x, y, z] = p
  out.copy(COL.tawny)
  // darker, ruddier back that fades down the flanks
  const dorsal = smooth(0.1, 0.85, n[1]) * (0.5 + 0.5 * smooth(0.5, 1.5, y))
  out.lerp(COL.back, dorsal * 0.9)
  // a faint darker line along the spine
  out.lerp(COL.back, smooth(0.8, 1, n[1]) * smooth(0.12, 0.0, Math.abs(z)) * smooth(1.4, 1.6, y) * 0.35)
  // pale underside, throat, inner legs and underside of the tail
  let pale = smooth(0.05, -0.55, n[1])
  if (y < 1.15) pale = Math.max(pale, smooth(0.05, -0.55, n[2] * Math.sign(z || 1)) * smooth(0.05, 0.18, Math.abs(z)) * 0.85)
  out.lerp(COL.pale, pale * 0.95)
  // flanks lighten toward the belly line on the torso
  if (x > -1.4 && x < 1.3) out.lerp(COL.pale, smooth(1.32, 1.05, y) * smooth(0.88, 1.02, y) * 0.5)
  // pale chin, lips and chest
  const head = smooth(2.02, 2.2, x) * smooth(1.58, 1.48, y)
  out.lerp(COL.pale, head * 0.85)
  const chest = smooth(1.14, 0.84, y) * smooth(0.0, 0.5, x) * smooth(0.2, -0.3, n[1])
  out.lerp(COL.pale, chest * 0.6)
  // dark muzzle sides and nose bridge
  const muzzle = smooth(2.12, 2.28, x) * smooth(1.48, 1.54, y) * smooth(1.66, 1.59, y) * smooth(0.02, 0.1, Math.abs(z))
  out.lerp(COL.mask, muzzle * 0.8)
  out.lerp(COL.mask, smooth(2.0, 2.3, x) * smooth(0.3, 0.9, n[1]) * smooth(0.07, 0.0, Math.abs(z)) * smooth(1.44, 1.64, y) * 0.28)
  // dark tail tip with a soft edge, and a darker upper tail
  const tipD = Math.hypot(x - TAIL_END[0], y - TAIL_END[1], z)
  out.lerp(COL.tip, smooth(0.78, 0.5, tipD))
  if (x < -1.5) out.lerp(COL.back, smooth(0.3, 0.9, n[1]) * 0.25)
  // paws a little deeper than the legs
  out.lerp(COL.paw, smooth(0.18, 0.06, y) * 0.6)
  // soft broken variation in the coat so no area is a flat fill
  const v = Math.sin(x * 9 + y * 5) * Math.sin(z * 11 + y * 7 + x * 2) + 0.5 * Math.sin(x * 23 + z * 17 + y * 13)
  out.multiplyScalar(1 + 0.045 * v)
}

let fieldCache: Field | null = null
const field = (): Field => (fieldCache ??= makeField(pantherPrims()))

/** Euler angles for an ellipsoid whose local z follows `n` and whose local x stays as horizontal as possible. */
function frame(n: V3, roll = 0): V3 {
  const z = new THREE.Vector3(...n).normalize()
  const x = new THREE.Vector3(0, 1, 0).cross(z)
  if (x.lengthSq() < 1e-6) x.set(1, 0, 0)
  x.normalize()
  const y = z.clone().cross(x)
  const m = new THREE.Matrix4().makeBasis(x, y, z)
  if (roll) m.multiply(new THREE.Matrix4().makeRotationZ(roll))
  const e = new THREE.Euler().setFromRotationMatrix(m)
  return [e.x, e.y, e.z]
}

const off = (p: V3, n: V3, d: number): V3 => [p[0] + n[0] * d, p[1] + n[1] * d, p[2] + n[2] * d]

export function pantherModel(b: Builder): void {
  const fld = field()
  const f = fld.f
  const prims = pantherPrims()
  const lod = getBuilderLod()
  const cell = 0.03 / Math.max(0.5, lod)
  const { lo, hi } = primBounds(prims, 0.25)
  b.colored(meshField(fld, lo, hi, cell, pantherPaint))

  for (const k of mirrorZ) {
    // almond eye: dark lid rim, amber iris flattened onto the face, round pupil, tiny highlight
    const eh = raycast(f, [2.1, 1.575 + H, k * 1.0], [0, 0, -k])
    if (eh) {
      const n = eh.n
      const rot = frame(n, k * -0.14)
      const q = (d: number): V3 => off(eh.p, n, d)
      b.ell(q(-0.012), [0.066, 0.04, 0.03], '#1b140f', rot, 20, 12, WET)
      b.ell(q(-0.008), [0.052, 0.03, 0.03], '#c2a64a', rot, 20, 12, WET)
      b.ell(q(0.004), [0.022, 0.022, 0.02], DARK, rot, 14, 10, WET)
      b.ell(off(q(0.012), [0, 1, 0], 0.012), [0.008, 0.008, 0.008], '#ffffff', rot, 6, 5, WET)
    }
    // ear: dark rounded back with a pale furred cup facing forward and out
    const ep: V3 = [1.82, 1.8 + H, k * 0.225]
    const er: V3 = [k * 0.5, 0.15, 0.22]
    b.ell(ep, [0.05, 0.108, 0.1], '#2a211a', er, 18, 12)
    b.ell([ep[0] + 0.03, ep[1] - 0.004, ep[2] + k * 0.012], [0.04, 0.1, 0.092], '#b08e68', er, 16, 12)
    // whisker dots and the mouth line
    for (const [x, y] of [[2.28, 1.54], [2.3, 1.51], [2.26, 1.48], [2.2, 1.52]]) {
      const h = raycast(f, [x, y, k * 1.0], [0, 0, -k])
      if (h) {
        b.ell(off(h.p, h.n, -0.004), [0.011, 0.011, 0.008], '#2a2019', frame(h.n), 6, 5)
      }
    }
    const mouth: V3[] = []
    for (const [x, y] of [[2.37, 1.495], [2.3, 1.47], [2.22, 1.455], [2.1, 1.45]]) {
      const h = raycast(f, [x, y, k * 1.0], [0, 0, -k])
      if (h) mouth.push(off(h.p, h.n, -0.004))
    }
    if (mouth.length > 2) b.limb(mouth, 0.009, { c: '#251b15' }, { radial: 6, seg: 5, cap: 2 })
  }
  // toes: four rounded lobes along the front of every paw, with the creases between them
  for (const [x, z] of pawSpots()) {
    for (let i = 0; i < 4; i++) {
      const a = (i - 1.5) * 0.5
      b.ell([x + 0.085 + Math.cos(a) * 0.08, 0.05, z + Math.sin(a) * 0.12], [0.082, 0.058, 0.05], '#a07a52', [0, -a, 0], 12, 8)
    }
  }
  // nose pad: a flat, broad, rounded triangle, rose brown, with a dark centre line
  const nh = raycast(f, [3, 1.585, 0], [-1, 0, 0])
  if (nh) {
    const n = nh.n
    const rot = frame(n)
    const c = off(nh.p, n, -0.02)
    b.ell([c[0], c[1] + 0.022, c[2]], [0.05, 0.034, 0.088], '#6e4a45', rot, 18, 12, WET)
    b.ell([c[0] - 0.003, c[1] - 0.022, c[2]], [0.045, 0.034, 0.05], '#6e4a45', rot, 16, 10, WET)
    for (const k of mirrorZ) b.ell([c[0] + 0.002, c[1] - 0.005, c[2] + k * 0.06], [0.034, 0.012, 0.014], '#2c1c1a', rot, 8, 6)
    const ph = raycast(f, [3, 1.53, 0], [-1, 0, 0])
    if (ph) b.limb([off(ph.p, ph.n, 0.0), [ph.p[0] - 0.01, ph.p[1] - 0.05, 0]], 0.008, { c: '#2c1c1a' }, { radial: 6, seg: 2, cap: 2 })
  }
}
