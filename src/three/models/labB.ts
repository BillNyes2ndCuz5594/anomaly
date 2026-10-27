import * as THREE from 'three/webgpu'
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'
import { Builder, type V3 } from './builder'
import { chain, cone, ellipsoid, makeField, meshField, primBounds, type Prim } from './sculpt'

// Lab B holograms: a white-tailed deer (translucent skin shell over a readable skeleton) and a live oak (bark shell
// over an inner stem, spreading limbs, leaf clusters and roots). Both stand on their pedestal with y = 0 as the ground
// and face +x. The part geometry stays split by id (skin, skeleton, root, stem, bark, ...), see creatures.ts.

const mirrorZ = [1, -1]

/** Small deterministic generator, so the tree is the same on every load. */
export function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

// ---------- deer ----------

/** Joint positions of the four legs, shared by the skin and the bones. Near side (k = 1) reaches forward. */
function legPoints(k: number) {
  const fs = k > 0 ? 0.13 : -0.13
  const hs = k > 0 ? -0.13 : 0.16
  const front: V3[] = [[0.85, 1.8, k * 0.25], [0.77 + fs * 0.3, 1.3, k * 0.25], [0.9 + fs * 0.7, 0.8, k * 0.23], [0.93 + fs * 0.9, 0.25, k * 0.22], [0.97 + fs, 0.07, k * 0.22]]
  const hind: V3[] = [[-0.95, 1.82, k * 0.27], [-0.62 + hs * 0.4, 1.25, k * 0.29], [-1.15 + hs * 0.7, 0.82, k * 0.24], [-1.05 + hs * 0.9, 0.25, k * 0.22], [-1.0 + hs, 0.07, k * 0.22]]
  return { front, hind }
}

/** Body spine from skull base to tail tip. */
const SPINE: V3[] = [[1.82, 2.82, 0], [1.5, 2.55, 0], [1.15, 2.33, 0], [0.8, 2.28, 0], [0.1, 2.24, 0], [-0.6, 2.26, 0], [-1.1, 2.3, 0], [-1.45, 2.22, 0], [-1.75, 2.0, 0]]

export function deerSkinPrims(): Prim[] {
  const P: Prim[] = []
  const add = (...p: Prim[]) => void P.push(...p)
  // torso: deep chest, tucked belly, round rump, one soft back line
  add(ellipsoid([0.55, 1.9, 0], [0.8, 0.56, 0.4], 0.22))
  add(ellipsoid([-0.2, 1.88, 0], [0.8, 0.5, 0.38], 0.22))
  add(ellipsoid([-0.95, 1.95, 0], [0.5, 0.5, 0.4], 0.2))
  // neck rising into a small, narrow head
  add(cone([1.0, 2.1, 0], [1.8, 2.85, 0], 0.4, 0.19, 0.25, 0.8))
  add(ellipsoid([1.95, 2.95, 0], [0.29, 0.22, 0.19], 0.14))
  add(cone([2.05, 2.9, 0], [2.5, 2.72, 0], 0.16, 0.1, 0.12, 1))
  add(ellipsoid([2.55, 2.7, 0], [0.09, 0.075, 0.09], 0.06))
  add(cone([1.95, 2.78, 0], [2.42, 2.62, 0], 0.12, 0.08, 0.08, 0.9))
  for (const k of mirrorZ) {
    const l = legPoints(k)
    add(...chain(l.front, [0.2, 0.12, 0.072, 0.05, 0.045], 0.12, 1, 6))
    add(...chain(l.hind, [0.27, 0.14, 0.07, 0.05, 0.045], 0.12, 1, 6))
    for (const p of [l.front[4], l.hind[4]]) add(ellipsoid([p[0] + 0.03, 0.055, p[2]], [0.09, 0.055, 0.06], 0.04))
  }
  // short tail
  add(...chain([[-1.4, 2.2, 0], [-1.6, 2.0, 0], [-1.7, 1.76, 0]], [0.11, 0.1, 0.07], 0.08, 0.7, 5))
  return P
}

/** Centrum, spinous process and optional side wings of one vertebra at `p`, lying along the spine direction `a`. */
function vertebra(b: Builder, p: V3, a: number, len: number, w: number, spine: number, wing = 0): void {
  b.ell(p, [len, w * 0.8, w], '#fff', [0, 0, a], 8, 5)
  if (spine > 0) b.cone(w * 0.55, spine, { p: [p[0] - Math.sin(a) * (spine / 2 + w * 0.5), p[1] + Math.cos(a) * (spine / 2 + w * 0.5), p[2]], r: [0, 0, a + 0.25] }, 5)
  if (wing > 0) for (const k of mirrorZ) b.ell([p[0], p[1] - 0.02, p[2] + k * wing * 0.55], [len * 0.7, 0.02, wing * 0.55], '#fff', [0, 0, a], 6, 4)
}

function deerBones(b: Builder): void {
  // ----- skull: cranium, tapering snout, lower jaw, orbits, small antlers
  b.ell([1.95, 2.95, 0], [0.25, 0.18, 0.15], '#fff', [0, 0, -0.15], 12, 8)
  b.limb([[2.05, 2.93, 0], [2.3, 2.83, 0], [2.52, 2.74, 0]], [[0.1, 0.09], [0.07, 0.065], [0.045, 0.05]], {}, { radial: 8, seg: 4, cap: 3 })
  b.limb([[1.9, 2.8, 0], [2.15, 2.69, 0], [2.42, 2.64, 0]], [[0.07, 0.05], [0.05, 0.035], [0.035, 0.03]], {}, { radial: 6, seg: 4, cap: 3 })
  for (const k of mirrorZ) {
    b.torus(0.062, 0.014, { p: [2.08, 2.99, k * 0.135], r: [0, Math.PI / 2 - 0.25 * k, 0] }, 5, 12)
    // antler: main beam sweeping back and up, a forward brow tine and a second tine
    b.limb([[1.86, 3.07, k * 0.09], [1.74, 3.27, k * 0.18], [1.66, 3.5, k * 0.27]], [0.032, 0.026, 0.014], {}, { radial: 5, seg: 5, cap: 2 })
    b.limb([[1.76, 3.3, k * 0.19], [1.98, 3.4, k * 0.23], [2.08, 3.52, k * 0.25]], [0.022, 0.017, 0.01], {}, { radial: 5, seg: 4, cap: 2 })
    b.limb([[1.7, 3.4, k * 0.23], [1.86, 3.5, k * 0.31]], [0.018, 0.009], {}, { radial: 5, seg: 3, cap: 2 })
  }
  // ----- spine: 7 neck, 13 chest, 5 lower back vertebrae, a fused sacrum and a few tail bones, placed along the curve
  const curve = new THREE.CatmullRomCurve3(SPINE.map((p) => new THREE.Vector3(...p)))
  const at = (u: number): { p: V3; a: number } => {
    const p = curve.getPointAt(u)
    const t = curve.getTangentAt(u)
    return { p: [p.x, p.y, p.z], a: Math.atan2(t.y, t.x) + Math.PI }
  }
  const chest: V3[] = []
  for (let i = 0; i < 7; i++) {
    const { p, a } = at(0.03 + (i / 6) * 0.25)
    vertebra(b, p, a, 0.082, 0.07, 0.05 + i * 0.012, i > 0 ? 0.07 : 0.1)
  }
  for (let i = 0; i < 13; i++) {
    const { p, a } = at(0.31 + (i / 12) * 0.36)
    vertebra(b, p, a, 0.065, 0.062, 0.2 - i * 0.012)
    chest.push(p)
  }
  for (let i = 0; i < 5; i++) {
    const { p, a } = at(0.69 + (i / 4) * 0.12)
    vertebra(b, p, a, 0.075, 0.066, 0.08, 0.2)
  }
  {
    const s = at(0.865)
    b.ell(s.p, [0.17, 0.06, 0.09], '#fff', [0, 0, s.a], 10, 6)
  }
  for (let i = 0; i < 5; i++) {
    const { p, a } = at(0.92 + (i / 4) * 0.08)
    vertebra(b, p, a, 0.05 - i * 0.006, 0.04 - i * 0.005, 0.0)
  }
  // ----- rib cage: 12 curved ribs a side that meet a breastbone along the belly
  const sternum: V3[] = []
  for (let i = 0; i < 12; i++) {
    const f = i / 11
    const sp = chest[i]
    const drop = 0.62 + 0.38 * Math.sin(Math.min(1, f * 1.15 + 0.1) * Math.PI)
    const wid = 0.2 + 0.17 * Math.sin(Math.min(1, f * 1.1 + 0.18) * Math.PI)
    for (const k of mirrorZ) {
      const pts: V3[] = []
      const rad: number[] = []
      const n = 8
      for (let j = 0; j <= n; j++) {
        const ph = (j / n) * Math.PI * 0.92
        pts.push([sp[0] - 0.2 * (j / n), sp[1] - 0.06 - drop * (1 - Math.cos(ph)) * 0.5, k * wid * Math.sin(ph)])
        rad.push(0.034 - 0.014 * (j / n))
      }
      b.limb(pts, rad, {}, { radial: 5, seg: 2, cap: 2 })
      if (k > 0) sternum.push([pts[n][0], pts[n][1] - 0.02, 0])
    }
  }
  b.limb(sternum, 0.05, {}, { radial: 6, seg: 2, cap: 3 })
  // ----- legs
  const bone = (pts: V3[], r: number[], rad = 6) => b.limb(pts, r, {}, { radial: rad, seg: 4, cap: 3 })
  const ball = (p: V3, r: number) => b.sphere(r, { p }, 8, 6)
  for (const k of mirrorZ) {
    const l = legPoints(k)
    const [sh, el, kn, fe, ho] = l.front
    // shoulder blade, upper arm, forearm, cannon bone, toe
    b.ell([sh[0] - 0.02, sh[1] + 0.3, sh[2] + k * 0.01], [0.1, 0.33, 0.028], '#fff', [0, 0, 0.32], 10, 7)
    bone([sh, el], [0.062, 0.05])
    bone([el, kn], [0.048, 0.04])
    bone([kn, fe], [0.036, 0.03])
    bone([fe, ho], [0.03, 0.026], 5)
    b.cone(0.05, 0.1, { p: [ho[0] + 0.03, 0.05, ho[2]], r: [0, 0, -Math.PI / 2 + 0.15] }, 5)
    for (const [p, r] of [[sh, 0.075], [el, 0.065], [kn, 0.058], [fe, 0.048]] as [V3, number][]) ball(p, r)
    // pelvis: wing of the hip bone, sitting bone, then thigh bone, shin, hock with its heel spur, cannon, toe
    const [hi, st, hk, hf, hh] = l.hind
    b.ell([hi[0] + 0.04, hi[1] + 0.3, hi[2] - k * 0.04], [0.09, 0.3, 0.03], '#fff', [0, 0, -0.5], 10, 7)
    bone([[hi[0] - 0.02, hi[1] + 0.08, hi[2] - k * 0.04], [hi[0] - 0.3, hi[1] + 0.12, hi[2] - k * 0.12], [-1.55, 1.95, k * 0.06]], [0.045, 0.04, 0.032])
    ball(hi, 0.1)
    bone([hi, st], [0.082, 0.065])
    bone([st, hk], [0.055, 0.042])
    bone([hk, [hk[0] - 0.12, hk[1] + 0.2, hk[2]]], [0.036, 0.028], 5)
    bone([hk, hf], [0.036, 0.03])
    bone([hf, hh], [0.03, 0.026], 5)
    b.cone(0.05, 0.1, { p: [hh[0] + 0.03, 0.05, hh[2]], r: [0, 0, -Math.PI / 2 + 0.15] }, 5)
    ball([st[0] + 0.05, st[1] + 0.02, st[2]], 0.05)
    for (const [p, r] of [[st, 0.068], [hk, 0.06], [hf, 0.048]] as [V3, number][]) ball(p, r)
  }
}

/** Skin shell and skeleton Builders for the deer. `lod` below 1 meshes the skin on a coarser grid (Low tier). */
export function deerBuilders(lod = 1): { skin: Builder; bones: Builder } {
  const skin = new Builder()
  const fld = makeField(deerSkinPrims())
  const { lo, hi } = primBounds(deerSkinPrims(), 0.2)
  skin.colored(meshField(fld, lo, hi, 0.04 / Math.max(0.5, lod), (_p, _n, out) => out.set('#ffffff')))
  for (const k of mirrorZ) skin.ell([1.74, 3.1, k * 0.31], [0.06, 0.2, 0.11], '#fff', [k * 1.1, 0, 0.8], 10, 7)
  const bones = new Builder()
  deerBones(bones)
  return { skin, bones }
}

// ---------- live oak ----------

interface Limb {
  pts: V3[]
  r: number[]
}

/** Main woody structure: a short, thick trunk that splits low into big spreading limbs. */
export function oakLimbs(): { trunk: Limb; limbs: Limb[] } {
  const trunk: Limb = { pts: [[0, -0.15, 0], [0.02, 0.45, 0.02], [0.05, 1.0, 0], [0.02, 1.4, 0]], r: [0.46, 0.36, 0.31, 0.28] }
  const limbs: Limb[] = [
    { pts: [[0.02, 1.2, 0], [-0.6, 1.62, 0.12], [-1.3, 1.86, 0.05], [-1.95, 1.72, -0.05]], r: [0.23, 0.17, 0.11, 0.06] },
    { pts: [[0.04, 1.25, 0], [0.55, 1.7, -0.12], [1.25, 2.0, 0.0], [1.9, 1.84, 0.08]], r: [0.23, 0.17, 0.11, 0.06] },
    { pts: [[0.03, 1.35, 0], [0.12, 2.0, 0.28], [0.3, 2.65, 0.45], [0.55, 3.05, 0.42]], r: [0.2, 0.15, 0.095, 0.05] },
    { pts: [[0.0, 1.35, 0], [-0.15, 2.0, -0.3], [-0.42, 2.55, -0.5], [-0.7, 2.9, -0.45]], r: [0.19, 0.14, 0.09, 0.045] },
  ]
  return { trunk, limbs }
}

/** Radius of a limb at curve parameter t. */
function limbRadius(l: Limb, t: number): number {
  const u = t * (l.r.length - 1)
  const i = Math.min(l.r.length - 2, Math.floor(u))
  return l.r[i] + (l.r[i + 1] - l.r[i]) * (u - i)
}

/**
 * Side branches sprouting along the main limbs, each leaning outward and up with a little droop, and the points where
 * they end (those carry the leaf clusters together with the limb tips).
 */
export function oakTwigs(limbs: Limb[]): { twigs: Limb[]; ends: [V3, number][] } {
  const rnd = rng(23)
  const twigs: Limb[] = []
  const ends: [V3, number][] = []
  limbs.forEach((l, li) => {
    const curve = new THREE.CatmullRomCurve3(l.pts.map((p) => new THREE.Vector3(...p)))
    const marks = li < 2 ? [0.4, 0.58, 0.76, 0.93] : [0.45, 0.65, 0.85]
    marks.forEach((t, mi) => {
      const pos = curve.getPoint(t)
      const tan = curve.getTangent(t)
      const r0 = limbRadius(l, t)
      for (const side of [1, -1]) {
        if (mi === marks.length - 1 && side < 0) continue
        const dir = new THREE.Vector3(tan.x * 0.55 + (rnd() - 0.5) * 0.3, 0.55 + rnd() * 0.25, tan.z * 0.55 + side * (0.25 + rnd() * 0.3)).normalize()
        const len = (0.55 + rnd() * 0.3) * (1 - t * 0.25)
        const mid = pos.clone().addScaledVector(dir, len * 0.5)
        const end = pos.clone().addScaledVector(dir, len)
        end.y -= 0.05 + rnd() * 0.08
        twigs.push({ pts: [[pos.x, pos.y, pos.z], [mid.x, mid.y, mid.z], [end.x, end.y, end.z]], r: [r0 * 0.4, r0 * 0.28, r0 * 0.16] })
        ends.push([[end.x, end.y + 0.05, end.z], 0.34 + rnd() * 0.12])
      }
    })
    const tip = l.pts[l.pts.length - 1]
    ends.push([[tip[0], tip[1] + 0.08, tip[2]], 0.48])
  })
  return { twigs, ends }
}

function ridged(geo: THREE.BufferGeometry, fn: (p: THREE.Vector3, n: THREE.Vector3) => number): THREE.BufferGeometry {
  for (const a of ['normal', 'uv', 'uv1', 'color', 'surf']) geo.deleteAttribute(a)
  const g = mergeVertices(geo, 1e-4)
  g.computeVertexNormals()
  const pos = g.getAttribute('position') as THREE.BufferAttribute
  const nrm = g.getAttribute('normal') as THREE.BufferAttribute
  const p = new THREE.Vector3()
  const n = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i)
    n.fromBufferAttribute(nrm, i)
    const d = fn(p, n)
    pos.setXYZ(i, p.x + n.x * d, p.y + n.y * d, p.z + n.z * d)
  }
  g.computeVertexNormals()
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2))
  return g
}

/** Bark furrows on the trunk: long, slightly wandering ridges, fading out on the limbs. */
function barkRidge(p: THREE.Vector3): number {
  const a = Math.atan2(p.z, p.x)
  const trunk = Math.min(1, Math.max(0, (1.45 - p.y) / 0.5))
  const ridge = Math.sin(a * 9 + Math.sin(p.y * 3.1) * 1.3 + p.y * 1.4)
  const fine = Math.sin(a * 23 + p.y * 7)
  return trunk * (0.03 * ridge + 0.008 * fine)
}

/** Where the acorns hang (oak space): the scanned acorns of the upgraded Lab B oak sit on the same spots. */
export const OAK_ACORNS: readonly V3[] = [[1.05, 2.6, 0.2], [-1.05, 2.5, 0.28], [0.18, 2.2, 0.55], [-0.35, 2.3, -0.5]]

/** Leaf cluster centers and radii (oak space), shared by the procedural leaves and the scanned sprigs. */
export const oakLeafEnds = (): [V3, number][] => oakTwigs(oakLimbs().limbs).ends

export function oakBuilders(lod = 1): { root: Builder; stem: Builder; bark: THREE.BufferGeometry; leaf: Builder; flower: Builder; fruit: Builder; seed: Builder; spore: Builder } {
  const { trunk, limbs } = oakLimbs()
  const { twigs, ends } = oakTwigs(limbs)
  const radial = lod < 1 ? 8 : 12
  const o = { radial, seg: 6, cap: 3 }

  // spreading roots, thick at the trunk and thinning out below the pedestal
  const root = new Builder()
  const R = (pts: V3[], r: number[]) => root.limb(pts, r, {}, { radial: 6, seg: 5, cap: 3 })
  R([[0, 0.05, 0], [0.02, -0.5, 0], [0.05, -1.35, 0.02]], [0.2, 0.1, 0.03])
  R([[0.05, 0.02, 0.05], [-0.5, -0.35, 0.18], [-1.0, -0.62, 0.25], [-1.5, -0.95, 0.2]], [0.17, 0.1, 0.055, 0.02])
  R([[0.05, 0.02, -0.05], [0.5, -0.3, -0.2], [1.0, -0.6, -0.2], [1.55, -0.9, -0.1]], [0.17, 0.1, 0.055, 0.02])
  R([[0.0, 0.0, 0.1], [0.15, -0.35, 0.5], [0.3, -0.7, 0.85], [0.35, -1.1, 1.1]], [0.14, 0.08, 0.045, 0.018])
  R([[0.0, 0.0, -0.1], [-0.15, -0.35, -0.5], [-0.3, -0.7, -0.85], [-0.4, -1.1, -1.05]], [0.14, 0.08, 0.045, 0.018])
  R([[-0.5, -0.35, 0.18], [-0.75, -0.8, 0.5], [-0.8, -1.2, 0.7]], [0.06, 0.035, 0.015])
  R([[0.5, -0.3, -0.2], [0.8, -0.75, -0.55], [0.95, -1.2, -0.7]], [0.06, 0.035, 0.015])
  R([[-1.0, -0.62, 0.25], [-1.2, -0.7, 0.55], [-1.3, -0.95, 0.75]], [0.04, 0.025, 0.012])
  R([[1.0, -0.6, -0.2], [1.25, -0.7, 0.1], [1.4, -1.0, 0.3]], [0.04, 0.025, 0.012])

  // inner stem: the wood core of the trunk, every limb and the twigs
  const stem = new Builder()
  const S = (l: Limb, shrink = 0.72) => stem.limb(l.pts, l.r.map((r) => r * shrink), {}, { ...o, cap: 3 })
  S(trunk, 0.7)
  for (const l of limbs) S(l, 0.72)
  for (const l of twigs) S(l, 0.85)

  // bark: a shell around the trunk and the main limbs, furrowed on the trunk and flaring into the ground
  const sleeve = new Builder()
  sleeve.limb(trunk.pts, [0.5, 0.38, 0.33, 0.3], {}, { radial: lod < 1 ? 16 : 28, seg: lod < 1 ? 6 : 12, cap: 0 })
  for (const l of limbs) sleeve.limb(l.pts, l.r.map((r) => r * 1.0), {}, { radial: lod < 1 ? 8 : 14, seg: 8, cap: 3 })
  const bark = ridged(sleeve.build(), (p) => barkRidge(p))

  // leaves: dense clusters of small elliptical leaves facing outward, at the end of every twig and limb
  const leaf = new Builder()
  const rnd = rng(7)
  const per = lod < 1 ? 11 : 18
  const up = new THREE.Vector3(0, 1, 0)
  for (const [c, r] of ends) {
    for (let i = 0; i < per; i++) {
      const u = rnd() * 1.8 - 0.8
      const t = rnd() * Math.PI * 2
      const s = Math.sqrt(1 - u * u)
      const d = new THREE.Vector3(s * Math.cos(t), u * 0.75, s * Math.sin(t)).normalize()
      const k = r * (0.5 + 0.5 * rnd())
      const pos: V3 = [c[0] + d.x * k, c[1] + d.y * k, c[2] + d.z * k]
      // the leaf faces outward along the cluster surface, spun by a random roll
      const q = new THREE.Quaternion().setFromAxisAngle(d, rnd() * Math.PI * 2).multiply(new THREE.Quaternion().setFromUnitVectors(up, d))
      const e = new THREE.Euler().setFromQuaternion(q)
      leaf.sphere(1, { p: pos, s: [0.17, 0.028, 0.08], r: [e.x, e.y, e.z] }, 8, 5)
    }
  }

  // flowers: hanging catkins (long tassels) under a few twigs
  const flower = new Builder()
  for (const [x, y, z] of [[-1.25, 2.6, 0.28], [1.12, 2.78, 0.1], [0.1, 2.45, 0.62], [-0.55, 2.55, -0.55]] as V3[]) {
    flower.limb([[x, y, z], [x + 0.04, y - 0.2, z + 0.02], [x + 0.02, y - 0.45, z]], [0.026, 0.034, 0.02], {}, { radial: 6, seg: 5, cap: 3 })
  }

  // fruit: acorns with a scaly cap, hanging on short stalks
  const fruit = new Builder()
  const seed = new Builder()
  for (const [x, y, z] of OAK_ACORNS) {
    fruit.ell([x, y, z], [0.1, 0.15, 0.1], '#fff', [0, 0, 0], 12, 8)
    fruit.sphere(0.115, { p: [x, y + 0.1, z], s: [1, 0.6, 1] }, 12, 6)
    fruit.limb([[x, y + 0.17, z], [x + 0.02, y + 0.3, z]], 0.014, {}, { radial: 5, seg: 2, cap: 2 })
    seed.ell([x, y - 0.03, z], [0.04, 0.065, 0.04], '#fff', [0, 0, 0], 8, 6)
  }

  // spores: rows of small dots under the leaflets of a resurrection fern on the lower limbs
  const spore = new Builder()
  for (const [x, y, z] of [[-1.05, 1.72, 0.2], [-0.45, 1.5, 0.22], [0.95, 1.87, 0.15], [1.45, 1.86, 0.2]] as V3[]) {
    for (let i = 0; i < 5; i++) spore.sphere(0.03, { p: [x - 0.2 + i * 0.1, y - 0.12 - (i % 2) * 0.035, z + (i % 2) * 0.05] }, 6, 4)
  }
  return { root, stem, bark, leaf, flower, fruit, seed, spore }
}
