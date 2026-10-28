import * as THREE from 'three/webgpu'
import { Builder, getBuilderLod, lerpHex, smooth, type V3 } from './builder'
import { chain, ellipsoid, makeField, makeSdf, meshField, primBounds, raycast, type Field, type Prim, type SculptPaint } from './sculpt'
import { frame, off, wob } from './placement'

// American bird grasshopper, sculpted as one chitin shell: long narrow head with flush compound eyes, saddle shaped
// pronotum, a segmented abdomen, folded forewings along the back and huge spindle shaped hind femora. The thin parts
// (tibiae, tarsi, antennae, spines) are smooth tubes added on top, so the thin legs stay clean at any mesh density.

const mirrorZ = [1, -1]

const COL = {
  olive: new THREE.Color('#5f8a2a'),
  oliveDark: new THREE.Color('#3b5f1c'),
  yellow: new THREE.Color('#c4d052'),
  pale: new THREE.Color('#b9c97a'),
  brown: new THREE.Color('#4b3a22'),
  dark: new THREE.Color('#2a2114'),
  wing: new THREE.Color('#7f9a3e'),
  wingDark: new THREE.Color('#3f4a1f'),
  face: new THREE.Color('#8cc03a'),
}

export const HIND = (k: number): V3[] => [[-0.1, 0.84, k * 0.3], [-0.65, 0.98, k * 0.37], [-1.2, 1.07, k * 0.34], [-1.62, 1.08, k * 0.29]]
const GROUND = 0.3
const HIND_R = [0.16, 0.245, 0.15, 0.045]

export function grasshopperHead(): Prim[] {
  const P: Prim[] = [
    // long narrow head sloping down toward the mouth
    ellipsoid([1.2, 0.99, 0], [0.25, 0.22, 0.19], 0.1),
    ellipsoid([1.38, 0.82, 0], [0.18, 0.24, 0.16], 0.1),
    ellipsoid([1.45, 0.64, 0], [0.12, 0.12, 0.14], 0.08),
  ]
  for (const k of mirrorZ) P.push(ellipsoid([1.5, 0.6, k * 0.07], [0.05, 0.05, 0.045], 0.03))
  return P
}

export function grasshopperEyes(): Prim[] {
  return mirrorZ.map((k) => ellipsoid([1.26, 1.03, k * 0.16], [0.12, 0.17, 0.08], 0.02))
}

export function grasshopperBody(): Prim[] {
  const P: Prim[] = []
  // saddle shaped pronotum: raised front and rear rims with a dip between, side lobes hanging down
  P.push(ellipsoid([0.86, 1.04, 0], [0.18, 0.13, 0.17], 0.04), ellipsoid([0.42, 1.06, 0], [0.2, 0.14, 0.19], 0.04), ellipsoid([0.64, 0.97, 0], [0.32, 0.17, 0.2], 0.05))
  for (const k of mirrorZ) P.push(ellipsoid([0.64, 0.86, k * 0.16], [0.32, 0.17, 0.08], 0.04))
  // thorax
  P.push(ellipsoid([0.1, 0.92, 0], [0.46, 0.25, 0.23], 0.12))
  // abdomen: ten segments, each a little ridge, tapering and lifting slightly toward the tip
  for (let i = 0; i < 10; i++) {
    const t = i / 9
    const x = -0.3 - i * 0.2
    const r = 0.21 * (1 - 0.6 * t * t) + 0.035
    P.push(ellipsoid([x, 0.92 + 0.1 * t * t, 0], [0.125, r, r * 0.98], 0.045))
  }
  // cerci at the tip
  P.push(...chain([[-2.1, 1.0, 0], [-2.3, 1.07, 0], [-2.45, 1.13, 0]], [0.06, 0.04, 0.012], 0.03, 1, 3))
  return P
}

export function grasshopperWings(): Prim[] {
  const P: Prim[] = []
  // narrow forewings folded along the back like a roof, reaching past the abdomen tip
  for (const k of mirrorZ) P.push(...chain([[0.5, 1.14, k * 0.12], [-0.4, 1.16, k * 0.15], [-1.3, 1.08, k * 0.13], [-2.0, 1.04, k * 0.09], [-2.4, 1.02, k * 0.05]], [0.04, 0.065, 0.06, 0.045, 0.014], 0.03, 2.6, 5))
  return P
}

export function grasshopperFemora(): Prim[] {
  const P: Prim[] = []
  for (const k of mirrorZ) P.push(...chain(HIND(k), HIND_R, 0.05, 0.62, 6))
  return P
}

export const grasshopperPrims = (): Prim[] => [...grasshopperHead(), ...grasshopperEyes(), ...grasshopperBody(), ...grasshopperWings(), ...grasshopperFemora()]

let fieldCache: { all: Field; head: Prim[]; eyes: ReturnType<typeof makeSdf>; wing: ReturnType<typeof makeSdf>; femur: ReturnType<typeof makeSdf>; headSdf: ReturnType<typeof makeSdf> } | null = null
const fields = () =>
  (fieldCache ??= {
    all: makeField(grasshopperPrims()),
    head: [],
    eyes: makeSdf(grasshopperEyes()),
    wing: makeSdf(grasshopperWings()),
    femur: makeSdf(grasshopperFemora()),
    headSdf: makeSdf(grasshopperHead()),
  })

export const paint: SculptPaint = (p, n, out) => {
  const [x, y, z] = p
  const { eyes, wing, femur, headSdf } = fields()
  const az = Math.abs(z)
  out.copy(COL.olive).lerp(COL.oliveDark, 0.5 + 0.5 * wob(x, y, z))
  // darker flanks, pale belly
  out.lerp(COL.oliveDark, smooth(0.5, -0.2, n[1]) * smooth(-0.3, 0.1, n[1] + 0.3) * 0.35)
  out.lerp(COL.pale, smooth(0.05, -0.55, n[1]) * 0.6)
  // abdomen: fine dark lines between segments and a dark spot row on the flank
  if (x < -0.25) {
    const seam = smooth(0.78, 0.95, Math.sin(x * 33.1 + 0.4))
    out.lerp(COL.brown, seam * 0.6)
    out.lerp(COL.brown, smooth(0.3, 0.1, Math.abs(y - 0.93)) * smooth(0.8, 0.95, Math.sin(x * 33.1 + 2.0)) * smooth(0.1, 0.4, az) * 0.5)
  }
  // dark lateral band from behind the eye along the flank of the pronotum and thorax, edged pale below
  if (x > 0.0 && x < 1.3 && az > 0.1) {
    const band = smooth(0.06, 0.0, Math.abs(y - (0.96 + 0.1 * (x - 0.6)))) * smooth(-0.1, 0.3, x) * smooth(1.3, 1.0, x)
    out.lerp(COL.brown, band * 0.75 * smooth(0.1, 0.25, az))
  }
  // pronotum: dark saddle with a pale lateral stripe
  if (x > 0.2 && x < 1.1 && y > 0.78) {
    out.lerp(COL.brown, smooth(1.12, 1.02, y) * 0.0)
    out.lerp(COL.yellow, smooth(0.07, 0.03, Math.abs(y - 1.02)) * smooth(0.12, 0.2, az) * 0.5)
  }
  // a pale yellow stripe runs down the back from the head to the wing tips
  out.lerp(COL.yellow, smooth(0.09, 0.02, az) * smooth(0.55, 0.9, n[1]) * smooth(1.45, 1.3, x) * 0.8)
  // head: yellow green face, dark mouth line
  const dh = headSdf(x, y, z)
  if (dh < 0.03) {
    const h = smooth(0.03, 0.0, dh)
    const hc = new THREE.Color().copy(COL.face).lerp(COL.olive, smooth(0.9, 1.15, y) * 0.7)
    hc.lerp(COL.yellow, smooth(1.35, 1.55, x) * smooth(0.95, 0.7, y) * 0.5)
    hc.lerp(COL.brown, smooth(0.75, 0.66, y) * 0.8)
    // soft cheek groove behind the eye
    hc.lerp(COL.brown, smooth(0.04, 0.0, Math.abs(x - 1.0 - 0.1 * (1.1 - y))) * smooth(0.0, 0.2, az) * 0.3)
    out.lerp(hc, h)
  }
  // wings: tan membrane with veins, dark blotches and a pale leading edge
  const dw = wing(x, y, z)
  const wm = smooth(0.02, 0.0, dw)
  if (wm > 0) {
    const w = new THREE.Color().copy(COL.wing)
    w.lerp(COL.pale, smooth(0.3, 0.8, Math.sin((az + 0.1 * x) * 60)) * 0.22)
    const blot = smooth(0.55, 0.8, wob(x * 3.1, y * 2, z * 9)) * smooth(0.3, -0.3, x) * smooth(0.05, 0.13, az)
    w.lerp(COL.wingDark, blot * 0.85)
    w.lerp(COL.dark, smooth(-1.9, -2.5, x) * 0.5)
    w.lerp(COL.yellow, smooth(0.08, 0.02, az) * 0.5)
    out.lerp(w, wm)
  }
  // hind femur: pale yellow with dark herringbone chevrons on the outer face, warm underside, dark knee
  const df = femur(x, y, z)
  const fm = smooth(0.02, 0.0, df)
  if (fm > 0 && x < 0.0) {
    const f = new THREE.Color().copy(COL.olive).lerp(COL.yellow, 0.5)
    const cy = Math.abs(y - (1.1 + 0.1 * Math.min(0, x + 0.6))) * 2.4
    f.lerp(COL.brown, smooth(0.15, 0.55, Math.sin((x + cy) * 30)) * 0.9 * smooth(0.5, 0.0, Math.abs(n[1])) * smooth(0.0, 0.2, az))
    f.lerp(new THREE.Color('#a8a03a'), smooth(-0.3, -0.8, n[1]) * 0.5)
    f.lerp(COL.dark, smooth(-1.42, -1.62, x) * 0.85)
    out.lerp(f, fm)
  }
  // compound eyes: tawny with fine vertical banding and a pale glint on top
  const de = eyes(x, y, z)
  const em = smooth(0.012, -0.004, de)
  if (em > 0) {
    const e = new THREE.Color('#7a5a2c')
    e.lerp(COL.brown, smooth(0.35, 0.85, Math.sin((x * 3 + z * 0.0 + y * 0) * 0 + (y - 1.12) * 55)) * 0.35)
    e.lerp(new THREE.Color('#d9c27a'), smooth(1.18, 1.3, y) * 0.5)
    e.lerp(COL.dark, smooth(0.0, -0.8, n[0]) * 0.35 * smooth(1.1, 1.0, y))
    out.lerp(e, em)
  }
  out.multiplyScalar(1 + 0.045 * wob(x * 1.4, y * 1.4, z * 1.4))
}

export function grasshopperModel(b: Builder): void {
  const fld = fields().all
  const lod = getBuilderLod()
  // Low tier meshes on a slightly coarser grid so the heavier femora stay at or under the old triangle count.
  const cell = (0.026 / Math.max(0.5, lod)) * (lod < 1 ? 1.05 : 1)
  const { lo, hi } = primBounds(grasshopperPrims(), 0.2)
  b.colored(meshField(fld, lo, hi, cell, paint))

  // glossy dark pseudopupil and a bright glint on each compound eye, laid on the eye surface
  for (const k of mirrorZ) {
    const h = raycast(fld.f, [1.3, 1.02, k * 1.0], [0, 0, -k])
    if (h) {
      const rot = frame(h.n)
      const c = off(h.p, h.n, -0.004)
      b.ell(c, [0.03, 0.05, 0.012], '#1a1208', rot, 12, 8, [1, 0])
      b.ell(off(c, [0, 1, 0], 0.045), [0.012, 0.012, 0.008], '#f2f2e6', rot, 6, 5, [1, 0])
    }
  }
  const shin = (t: number, _cs: number, _sn: number, out: THREE.Color): void => {
    out.copy(COL.olive).lerp(COL.yellow, 0.25)
    out.lerp(COL.dark, smooth(0.06, 0.0, t) * 0.8)
  }
  const spines = (a: V3, c: V3, n: number, side: number, r: number): void => {
    for (let i = 1; i <= n; i++) {
      const t = i / (n + 1)
      const p: V3 = [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t, a[2] + (c[2] - a[2]) * t]
      b.limb([p, [p[0] - 0.02, p[1] + 0.01, p[2] + side * r * 1.2], [p[0] - 0.035, p[1] + 0.012, p[2] + side * r * 2.6]], [0.011, 0.008, 0.002], { c: '#2e2416' }, { radial: 5, seg: 2, cap: 1 })
    }
  }
  const foot = (a: V3, dirx: number, z: number, c: string): void => {
    // three short tarsal segments with a dark claw
    let p = a
    for (let i = 0; i < 3; i++) {
      const q: V3 = [p[0] + dirx * 0.05, i === 2 ? GROUND + 0.015 : Math.max(GROUND + 0.02, p[1] - 0.012), z]
      b.limb([p, q], [0.024 - i * 0.003, 0.021 - i * 0.003], { c }, { radial: 6, seg: 2, cap: 2 })
      b.ell(q, [0.022, 0.02, 0.022], '#4a3b24', [0, 0, 0], 6, 5)
      p = q
    }
    b.limb([p, [p[0] + dirx * 0.04, GROUND, z]], [0.014, 0.003], { c: '#241b10' }, { radial: 5, seg: 2, cap: 1 })
  }
  for (const k of mirrorZ) {
    // hind tibia: thin, long, dull red with two rows of dark spines; knee folded high behind the abdomen, foot under the body
    const knee = HIND(k)[3]
    const heel: V3 = [-0.5, GROUND + 0.03, k * 0.44]
    const mid: V3 = [-1.05, 0.7, k * 0.4]
    b.limb([knee, mid, heel], [0.052, 0.04, 0.032], { c: '#8e8a3e' }, { radial: 8, seg: 7, cap: 3, paint: (t, _c, _s, out) => {
      out.set('#8e8a3e')
      lerpHex(out, '#3a281a', smooth(0.12, 0.0, t) * 0.9)
      lerpHex(out, '#b9b25a', smooth(0.5, 1, t) * 0.25)
    } })
    spines(knee, heel, 8, 1, 0.03)
    spines(knee, heel, 8, -1, 0.03)
    b.ell(knee, [0.06, 0.06, 0.06], '#2e2416', [0, 0, 0], 8, 6)
    foot(heel, 1, k * 0.44, '#8c6a3c')
    // front and middle legs: tapered femur, a dark knee joint, slender spined tibia, jointed tarsus
    for (const [hip, kn, an, toe] of [
      [[0.86, 0.8, k * 0.16], [1.16, 0.74, k * 0.36], [1.42, GROUND + 0.03, k * 0.5], 1],
      [[0.38, 0.8, k * 0.22], [0.64, 0.8, k * 0.5], [0.8, GROUND + 0.03, k * 0.64], 1],
    ] as [V3, V3, V3, number][]) {
      const fm: V3 = [(hip[0] + kn[0]) / 2, (hip[1] + kn[1]) / 2 + 0.02, (hip[2] + kn[2]) / 2]
      b.limb([hip, fm, kn], [0.075, 0.062, 0.042], { c: '#7f7a3a' }, { radial: 10, seg: 4, cap: 3, paint: (t, _c, _s, out) => {
        out.copy(COL.olive).lerp(COL.yellow, 0.2)
        lerpHex(out, '#4b3a22', smooth(0.8, 1, t) * 0.7)
      } })
      b.ell(kn, [0.05, 0.05, 0.05], '#3a2d1a', [0, 0, 0], 8, 6)
      b.limb([kn, [(kn[0] + an[0]) / 2, (kn[1] + an[1]) / 2, (kn[2] + an[2]) / 2 + k * 0.02], an], [0.034, 0.028, 0.022], { c: '#8c8545' }, { radial: 8, seg: 5, cap: 3, paint: shin })
      spines(kn, an, 5, k, 0.02)
      foot(an, toe, an[2], '#8c6a3c')
    }
    // short thread antenna
    b.limb([[1.34, 1.14, k * 0.07], [1.55, 1.34, k * 0.12], [1.8, 1.5, k * 0.2], [2.05, 1.55, k * 0.3], [2.28, 1.5, k * 0.38]], [0.024, 0.017, 0.012, 0.008, 0.004], { c: '#3a4a1f' }, { radial: 6, seg: 9, cap: 2 })
  }
}
