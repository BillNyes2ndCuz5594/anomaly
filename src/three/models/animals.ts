import * as THREE from 'three/webgpu'
import { Builder, countershade, lerpHex, mottle, paintWith, radiusPair, smooth, spineAt, type Paint, type Radii, type V3 } from './builder'

// Hand built specimens. Every animal is smooth variable radius tubes (limb), ellipsoids and a few flat fins,
// merged into one indexed geometry with vertex colors; the lit material adds scales, wrinkles or coat on top.

export const mirrorZ = [1, -1]
export const DARK = '#10161c'
const unit = (v: V3): V3 => {
  const l = Math.hypot(...v)
  return [v[0] / l, v[1] / l, v[2] / l]
}
const add = (a: V3, b: V3, k = 1): V3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]
const WET: [number, number] = [1, 0]
const THIN: [number, number] = [0, 1]

/** Euler angles that turn local +x onto the direction `d` (yaw about y, then pitch about z). */
export const alignX = (d: V3): V3 => {
  const u = unit(d)
  return [0, -Math.atan2(u[2], u[0]), Math.atan2(u[1], Math.hypot(u[0], u[2]))]
}

/** Glossy eye: colored iris, dark pupil (optionally a slit) and a bright highlight so it looks alive. An optional lid ring frames it. */
export function eye(b: Builder, p: V3, r: number, look: V3, iris = '#f0ecdf', slit: boolean | 'h' = false, pupil = DARK, lid?: string): void {
  const d = unit(look)
  const side: V3 = unit([-d[2], 0, d[0]])
  b.ell(p, [r, r, r], iris, [0, 0, 0], 20, 14, WET)
  const pr = r * 0.66
  const pp: V3 = [p[0] + d[0] * r * 0.5, p[1] + d[1] * r * 0.5, p[2] + d[2] * r * 0.5]
  b.ell(pp, slit === 'h' ? [pr * 1.05, pr * 0.5, pr * 1.05] : slit ? [pr * 0.4, pr * 1.05, pr * 0.4] : [pr, pr, pr], pupil, [0, 0, 0], 16, 10, WET)
  b.ell([p[0] + d[0] * r * 0.82 + side[0] * r * 0.28, p[1] + d[1] * r * 0.82 + r * 0.38, p[2] + d[2] * r * 0.82 + side[2] * r * 0.28], [r * 0.2, r * 0.2, r * 0.2], '#ffffff', [0, 0, 0], 8, 6, WET)
  if (lid) {
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...d))
    const e = new THREE.Euler().setFromQuaternion(q)
    b.torus(r * 1.0, r * 0.2, { p: [p[0] - d[0] * r * 0.05, p[1] - d[1] * r * 0.05, p[2] - d[2] * r * 0.05], r: [e.x, e.y, e.z], c: lid }, 8, 20)
  }
}

/** Flat blade (fin, wing, leaf) along a spine. `chords` sets width per point, `thick` the thickness. `rays` paints fine ribs along it. */
export function fin(b: Builder, pts: V3[], chords: number[], thick: number, color: string, plane: 'xy' | 'xz' | 'auto' = 'auto', paint?: Paint, rays = 0): void {
  const base = paint
  const p: Paint | undefined = rays
    ? paintWith(base ?? ((_t, _c, _s, out) => out.set('#ffffff')), (t, cs, _sn, out) => {
        const rib = 0.5 + 0.5 * Math.sin(cs * rays)
        out.multiplyScalar(0.8 + 0.28 * rib * smooth(0.0, 0.25, t))
      })
    : paint
  b.limb(pts, chords.map((c) => [c, Math.min(thick, c * 0.6)] as [number, number]), { c: color, m: THIN }, { radial: 14, seg: 7, cap: 3, ref: plane === 'xy' ? [0, 0, 1] : plane === 'xz' ? [0, 1, 0] : undefined, paint: p })
}

/** Rounded paw or foot pad lying on the ground. */
export function paw(b: Builder, p: V3, r: number, color: string, rot = 0): void {
  b.ell([p[0], r * 0.5, p[2]], [r * 1.35, r * 0.55, r], color, [0, rot, 0], 18, 12)
}

/** Toes fanned out from a foot: tapered rounded fingers at the given plan angles (0 is forward, +x). */
export function toes(b: Builder, base: V3, angles: number[], len: number, r: number, color: string, tip?: string, side = 1): void {
  for (const a of angles) {
    const d: V3 = [Math.cos(a), 0, Math.sin(a) * side]
    const mid = add(base, d, len * 0.55)
    const end = add(base, d, len)
    b.limb([add(base, [0, 0.01, 0]), [mid[0], mid[1] + 0.005, mid[2]], [end[0], end[1] - 0.005, end[2]]], [r, r * 0.82, r * 0.55], { c: color }, { radial: 8, seg: 3, cap: 3 })
    if (tip) b.ell(add(end, d, r * 0.4), [r * 0.7, r * 0.5, r * 0.55], tip, alignX(d), 8, 6)
  }
}

// ---------- American alligator ----------

export function gatorModel(b: Builder): void {
  const back = '#4d6140'
  const flank = '#7b8a58'
  const belly = '#d3cf9f'
  const ridge = '#2b3624'
  // One long spine: tail tip curving gently toward the camera side, body, neck, flat skull and a broad snout.
  const spine: V3[] = [
    [-4.2, 0.13, 0.95], [-3.4, 0.26, 0.7], [-2.5, 0.44, 0.32], [-1.5, 0.64, 0.06], [-0.5, 0.74, -0.02], [0.5, 0.76, 0],
    [1.3, 0.7, 0], [1.95, 0.54, 0], [2.5, 0.4, 0], [2.95, 0.33, 0],
  ]
  // Width (lateral) and height. The tail is flattened side to side, the head flat and wide.
  const radii: Radii = [[0.02, 0.04], [0.09, 0.21], [0.2, 0.35], [0.46, 0.48], [0.74, 0.58], [0.8, 0.62], [0.66, 0.54], [0.6, 0.36], [0.5, 0.23], [0.45, 0.18]]
  const coat = paintWith(countershade(back, belly, -0.2, 0.28), (t, _cs, sn, out) => {
    lerpHex(out, flank, (1 - smooth(0.0, 0.6, Math.abs(sn + 0.1))) * 0.4)
    // dark bands across the tail and rear back, fading toward the shoulders
    const band = smooth(0.25, 0.5, 0.5 - Math.abs(((t * 17) % 1) - 0.5)) * smooth(-0.2, 0.5, sn) * (1 - smooth(0.4, 0.6, t))
    lerpHex(out, '#212c1b', band * 0.55)
    if (t > 0.7) lerpHex(out, '#50603f', smooth(0.7, 0.95, t) * 0.25)
  })
  b.limb(spine, radii, { m: [0, 0] }, { paint: mottle(coat, 0.08, 1, 3), radial: 36, seg: 12, cap: 8 })
  // blunt bulb at the snout tip with the nostrils on it
  b.ell([2.97, 0.4, 0], [0.2, 0.09, 0.26], '#37462f', [0, 0, 0.05], 16, 10)
  for (const k of mirrorZ) b.ell([3.04, 0.47, k * 0.09], [0.045, 0.03, 0.04], '#10150d', [0, 0, 0], 8, 6, WET)
  // mouth line along the upper lip and the corner behind the jaw
  for (const k of mirrorZ) b.limb([[3.0, 0.275, k * 0.16], [2.75, 0.3, k * 0.4], [2.35, 0.37, k * 0.5], [1.95, 0.46, k * 0.58], [1.75, 0.5, k * 0.55]], 0.014, { c: '#161d12' }, { radial: 6, seg: 5, cap: 2 })
  // double row of keeled scutes along the neck and back, closing to one crest down the tail
  for (let i = 0; i < 46; i++) {
    const t = 0.6 - i * 0.0125
    const { p, tan } = spineAt(spine, t)
    const [w, h] = radiusPair(radii, t * 9)
    const grow = 0.55 + 0.45 * smooth(0.1, 0.5, t)
    const split = smooth(0.12, 0.34, t)
    for (const k of mirrorZ) {
      const lat = k * (w * 0.34 * split + 0.012)
      if (split < 0.05 && k < 0) continue
      b.ell([p[0], p[1] + h * Math.sqrt(Math.max(0.2, 1 - (lat / w) ** 2)) * 0.99, p[2] + lat], [0.115 * grow, 0.085 * grow, 0.075 * grow], ridge, alignX(tan), 8, 6)
    }
  }
  for (const k of mirrorZ) {
    // eyes sit on raised bony brows
    b.ell([1.95, 0.82, k * 0.32], [0.18, 0.11, 0.15], '#3a4730', [0, 0, 0], 14, 10)
    eye(b, [2.02, 0.86, k * 0.33], 0.085, [0.3, 0.7, k * 0.8], '#cdb73e', true, '#0c0f0a', '#34412b')
    // sprawled legs: heavy upper arm out and down, bent elbow, flat splayed foot with spread toes
    for (const [x, step, sc] of [[1.15, 0.12, 1], [-1.5, -0.05, 1.1]] as [number, number, number][]) {
      const foot: V3 = [x + 0.32 + step, 0.045, k * 1.32]
      b.limb([[x - 0.05, 0.5, k * 0.4], [x + 0.06, 0.4, k * 0.9], [x + 0.2 + step, 0.22, k * 1.14], foot], [[0.34 * sc, 0.3 * sc], [0.22 * sc, 0.2 * sc], [0.15, 0.13], [0.115, 0.06]], {}, { radial: 16, seg: 7, cap: 5, paint: mottle(countershade(back, '#7c8760', 0, 0.8), 0.1, 1.3, 9) })
      toes(b, foot, [-0.55, -0.2, 0.2, 0.55], 0.3, 0.05, '#3a4830', '#16190f', k)
    }
  }
}

// ---------- Garden spider (Argiope) ----------

export function spiderModel(b: Builder): void {
  const yel = '#e6b52a'
  const silk = '#cdc7b4'
  // Big oval abdomen: black with golden bands and spots, held up behind the head.
  const abdomen = paintWith(countershade('#1e1710', '#2f2516', -0.2, 0.4), (t, cs, sn, out) => {
    const band = smooth(0.0, 0.14, 0.5 - Math.abs(((t * 4.4 + 0.1) % 1) - 0.5) - 0.3)
    lerpHex(out, yel, band * smooth(-0.4, 0.25, sn) * 0.95)
    lerpHex(out, '#f3dd7a', smooth(0.4, 0.55, 0.3 - Math.abs(cs)) * smooth(0.6, 0.95, sn) * smooth(0.25, 0.55, t) * (1 - smooth(0.8, 0.95, t)) * 0.85)
    if (t > 0.1) lerpHex(out, '#f0cf55', smooth(0.5, 0.9, sn) * 0.15)
  })
  b.limb([[-2.5, 1.15, 0], [-1.7, 1.28, 0], [-0.75, 1.15, 0], [0.0, 0.98, 0], [0.22, 0.92, 0]], [[0.1, 0.1], [0.78, 0.74], [0.86, 0.8], [0.36, 0.34], [0.1, 0.1]], {}, { paint: mottle(abdomen, 0.06, 1, 2), radial: 32, seg: 10, cap: 8 })
  // narrow waist and pale, silky cephalothorax
  b.limb([[0.1, 0.94, 0], [0.5, 0.88, 0], [0.95, 0.88, 0]], [[0.16, 0.16], [0.44, 0.34], [0.34, 0.26]], { c: silk }, { radial: 24, seg: 8, cap: 7, paint: mottle(countershade(silk, '#8f8977', 0, 0.6), 0.08, 1.5, 4) })
  b.ell([0.92, 0.97, 0], [0.2, 0.17, 0.26], '#d8d2c0', [0, 0, 0], 16, 12)
  for (const k of mirrorZ) {
    for (const [x, y, z, r] of [[1.08, 1.06, 0.07, 0.04], [1.04, 1.11, 0.15, 0.035], [1.0, 1.06, 0.22, 0.03]] as [number, number, number, number][]) b.ell([x, y, k * z], [r, r, r], '#0c0b0a', [0, 0, 0], 8, 6, WET)
    // fangs and palps
    b.limb([[1.1, 0.8, k * 0.07], [1.17, 0.64, k * 0.07]], [0.05, 0.03], { c: '#4a3a28' }, { radial: 8, seg: 3, cap: 3 })
    b.limb([[1.0, 0.85, k * 0.16], [1.2, 0.74, k * 0.2], [1.3, 0.6, k * 0.2]], [0.035, 0.03, 0.02], { c: '#7b6a50' }, { radial: 8, seg: 4, cap: 3 })
  }
  // eight legs: femur rises to a high knee, the shin arcs down, banded tips
  const dirs: [number, number, number, number][] = [
    [0.8, 0.6, 2.15, 0.5],
    [0.62, 1.2, 1.95, 0.6],
    [0.42, 1.95, 1.7, 0.55],
    [0.22, 2.6, 2.1, 0.5],
  ]
  for (const k of mirrorZ) {
    dirs.forEach(([x, ang, L, lift]) => {
      const d: V3 = [Math.cos(ang), 0, Math.sin(ang) * k]
      const root: V3 = [x, 0.86, k * 0.26]
      const knee: V3 = [x + d[0] * L * 0.34, 1.5 + lift * 0.3, k * 0.26 + d[2] * L * 0.34]
      const mid: V3 = [x + d[0] * L * 0.68, 0.95, k * 0.26 + d[2] * L * 0.68]
      const tip: V3 = [x + d[0] * L, 0.03, k * 0.26 + d[2] * L]
      const paint = paintWith(countershade('#2a2015', '#2a2015'), (t, _c, _s, out) => {
        lerpHex(out, '#d7a62a', smooth(0.28, 0.4, t) * (1 - smooth(0.46, 0.56, t)) * 0.9)
        lerpHex(out, '#d7a62a', smooth(0.7, 0.76, t) * (1 - smooth(0.8, 0.86, t)) * 0.8)
        lerpHex(out, '#7a5a30', smooth(0.9, 1, t) * 0.7)
        lerpHex(out, '#c58a22', (1 - smooth(0.0, 0.2, t)) * 0.75)
      })
      b.limb([root, knee, mid, tip], [0.1, 0.075, 0.05, 0.018], {}, { paint, radial: 12, seg: 9, cap: 3 })
      b.ell(knee, [0.09, 0.09, 0.09], '#d09a24', [0, 0, 0], 10, 8)
    })
  }
}

// ---------- West Indian manatee ----------

export function manateeModel(b: Builder): void {
  const skin = mottle(
    paintWith(countershade('#777b80', '#a9abab', -0.1, 0.6), (t, cs, sn, out) => {
      // faint algae and sun bleached patches
      lerpHex(out, '#6f7a6a', smooth(0.5, 1, sn) * smooth(0.2, 0.6, Math.sin(t * 19 + cs * 3)) * 0.35)
      lerpHex(out, '#8a8c8a', smooth(0.3, 0.9, Math.sin(t * 7 + sn * 2.3 + 1)) * 0.2)
    }),
    0.09,
    0.9,
    5,
  )
  b.limb(
    [[-1.9, 0.18, 0], [-1.25, 0.1, 0], [-0.4, 0.02, 0], [0.5, 0, 0], [1.25, -0.05, 0], [1.8, -0.2, 0]],
    [[0.22, 0.2], [0.52, 0.5], [0.78, 0.74], [0.8, 0.72], [0.56, 0.5], [0.4, 0.34]],
    {},
    { paint: skin, radial: 36, seg: 11, cap: 8 },
  )
  // flat paddle tail: horizontal, broadest near the end with a smooth rounded rim
  b.limb([[-1.85, 0.16, 0], [-2.3, 0.26, 0], [-2.75, 0.38, 0], [-3.05, 0.46, 0]], [[0.3, 0.22], [0.74, 0.1], [1.0, 0.07], [0.85, 0.045]], { c: '#70757a', m: THIN }, { radial: 32, seg: 9, cap: 9, paint: mottle(countershade('#74787d', '#92969a', 0, 0.5), 0.08, 1.2, 8) })
  // broad down turned muzzle with a split upper lip, bristles and nostrils on top
  b.ell([1.95, -0.36, 0], [0.4, 0.3, 0.46], '#8d9094', [0, 0, 0.35], 24, 16)
  for (const k of mirrorZ) {
    b.ell([2.16, -0.46, k * 0.17], [0.19, 0.14, 0.2], '#9a9c9f', [0, 0, 0.3], 14, 10)
    b.ell([2.17, -0.1, k * 0.14], [0.065, 0.035, 0.05], '#262a2e', [0, 0, 0.5], 8, 6)
    for (let i = 0; i < 4; i++) {
      const a = (i / 3 - 0.5) * 1.6
      b.limb([[2.3, -0.5, k * (0.06 + i * 0.07)], [2.4, -0.55 - i * 0.015, k * (0.08 + i * 0.08) + Math.sin(a) * 0.05], [2.46, -0.62, k * (0.08 + i * 0.09) + Math.sin(a) * 0.12]], [0.016, 0.01, 0.005], { c: '#d8d2bd' }, { radial: 5, seg: 2, cap: 1 })
    }
    eye(b, [1.6, 0.14, k * 0.52], 0.06, [0.3, 0.2, k], '#c9c1ad', false, '#14181b', '#74787c')
    // flipper: paddle with three small nails
    b.limb([[0.85, -0.38, k * 0.5], [1.2, -0.58, k * 1.0], [1.5, -0.8, k * 1.4], [1.62, -0.95, k * 1.55]], [[0.2, 0.12], [0.26, 0.08], [0.23, 0.055], [0.15, 0.04]], { c: '#74787d', m: THIN }, { radial: 16, seg: 7, cap: 6, paint: mottle(countershade('#767a7f', '#8f9396', 0, 0.5), 0.08, 1.4, 12) })
    for (let i = -1; i <= 1; i++) b.ell([1.66 + i * 0.01, -1.0 - Math.abs(i) * 0.01, k * (1.56 + i * 0.06)], [0.03, 0.02, 0.035], '#c2bba7', [0, 0, 0], 6, 5)
  }
}

// ---------- Largemouth bass ----------

export function bassModel(b: Builder): void {
  const back = '#587f3a'
  const flank = '#b4bf78'
  const belly = '#eeecce'
  const fn = '#5d8a3c'
  const spine: V3[] = [[-2.3, 0.14, 0], [-1.5, 0.07, 0], [-0.5, 0, 0], [0.5, -0.03, 0], [1.25, -0.03, 0], [1.9, -0.08, 0], [2.35, -0.14, 0]]
  const radii: Radii = [[0.04, 0.12], [0.15, 0.34], [0.36, 0.7], [0.44, 0.78], [0.4, 0.66], [0.3, 0.44], [0.24, 0.24]]
  const coat = paintWith(countershade(back, belly, -0.05, 0.28), (t, cs, sn, out) => {
    // pale olive flank under a dark broken lateral band that fades toward the head and tail
    lerpHex(out, flank, (1 - smooth(0.0, 0.5, Math.abs(sn + 0.12))) * 0.55)
    const band = smooth(0.14, 0.3, t) * (1 - smooth(0.76, 0.92, t)) * (1 - smooth(0.12, 0.34, Math.abs(sn - 0.04))) * smooth(0.12, 0.4, Math.abs(cs))
    lerpHex(out, '#27391f', band * (0.55 + 0.4 * Math.sin(t * 60) * Math.sin(t * 23 + 1)))
    if (t > 0.7) lerpHex(out, '#d7e0a3', smooth(0.72, 1, t) * 0.3 * (1 - smooth(-0.2, 0.3, sn)))
  })
  b.limb(spine, radii, {}, { paint: mottle(coat, 0.07, 1.4, 2), radial: 36, seg: 11, cap: 8 })
  // big lower jaw that juts out a little and a long mouth line that runs back under the eye
  b.ell([2.38, -0.26, 0], [0.34, 0.1, 0.22], '#dfe5b8', [0, 0, 0.12], 18, 10)
  for (const k of mirrorZ) {
    b.limb([[2.62, -0.17, k * 0.02], [2.15, -0.15, k * 0.18], [1.6, -0.07, k * 0.28]], 0.016, { c: '#1d2a18' }, { radial: 6, seg: 5, cap: 2 })
    // gill cover
    b.limb([[1.28, 0.34, k * 0.3], [1.14, 0.0, k * 0.37], [1.2, -0.3, k * 0.34]], 0.015, { c: '#31482a' }, { radial: 6, seg: 6, cap: 1 })
    eye(b, [1.72, 0.2, k * 0.27], 0.115, [0.4, 0.2, k], '#e2c76b', false, DARK, '#4b6a36')
    // pectoral fin
    fin(b, [[0.95, -0.14, k * 0.34], [0.62, -0.26, k * 0.6], [0.3, -0.4, k * 0.82]], [0.17, 0.2, 0.05], 0.03, '#9bb96b', 'xz', undefined, 9)
  }
  // spiny front dorsal: stiff spines with a scalloped membrane between them, a notch, then the soft rear dorsal
  const tops = [0.7, 0.71, 0.72, 0.72, 0.71, 0.7, 0.68, 0.66]
  const spineX = [1.0, 0.86, 0.72, 0.58, 0.45, 0.32, 0.2, 0.08]
  const spineH = [0.86, 1.02, 1.1, 1.08, 1.0, 0.92, 0.84, 0.74]
  const tipsF: V3[] = spineX.map((x, i) => [x - 0.2 - i * 0.012, spineH[i], 0])
  const m = 3
  const baseF: V3[] = []
  const edgeF: V3[] = []
  for (let c = 0; c <= (spineX.length - 1) * m; c++) {
    const i = Math.min(spineX.length - 2, Math.floor(c / m))
    const f = (c - i * m) / m
    const bx = spineX[i] + (spineX[i + 1] - spineX[i]) * f
    const by = tops[i] + (tops[i + 1] - tops[i]) * f - 0.1
    const tx = tipsF[i][0] + (tipsF[i + 1][0] - tipsF[i][0]) * f
    const ty = tipsF[i][1] + (tipsF[i + 1][1] - tipsF[i][1]) * f
    const dip = Math.sin(Math.PI * f) * 0.16
    baseF.push([bx, by, 0])
    edgeF.push([tx, ty - dip * (ty - by) * 1.4, 0])
  }
  sail(b, baseF, edgeF, 0.016, '#51794a', { rows: 5, rays: 0 })
  spineX.forEach((x, i) => finSpine(b, [x, tops[i] - 0.1, 0], [tipsF[i][0] - 0.02, tipsF[i][1] + 0.03, 0], 0.024, '#25381f'))
  // soft rear dorsal: rounded, with branching rays
  {
    const n = 14
    const baseS: V3[] = []
    const edgeS: V3[] = []
    for (let j = 0; j < n; j++) {
      const u = j / (n - 1)
      const x = -0.12 - u * 0.78
      const top = 0.6 - u * 0.1
      baseS.push([x, top - 0.06, 0])
      edgeS.push([x - 0.1 - 0.12 * u, top + 0.46 * Math.sin(Math.PI * Math.min(1, 0.15 + u * 0.95)) * (1 - 0.35 * u) + 0.05, 0])
    }
    sail(b, baseS, edgeS, 0.014, '#5d8a3c', { rows: 5, rays: 26 })
  }
  // tail: one fan with a shallow notch, fine rays, rounded tips
  {
    const n = 17
    const baseT: V3[] = []
    const edgeT: V3[] = []
    for (let j = 0; j < n; j++) {
      const u = (j / (n - 1)) * 2 - 1
      baseT.push([-2.3, 0.1 + u * 0.1, 0])
      edgeT.push([-3.12 + 0.2 * (1 - Math.abs(u) ** 1.7) - 0.05 * (1 - u * u), 0.06 + u * 0.88, 0])
    }
    sail(b, baseT, edgeT, 0.022, '#5d8a3c', { rows: 6, rays: 34 })
  }
  // anal and pelvic fins
  fin(b, [[-0.6, -0.5, 0], [-0.95, -0.78, 0], [-1.25, -0.9, 0]], [0.22, 0.2, 0.03], 0.025, fn, 'xy', undefined, 9)
  fin(b, [[0.55, -0.55, 0], [0.38, -0.88, 0], [0.22, -1.0, 0]], [0.16, 0.14, 0.03], 0.025, '#d9d6a0', 'xy', undefined, 8)
}

// ---------- Bull shark ----------

export function sharkModel(b: Builder): void {
  const back = '#6c7885'
  const belly = '#f1f3f2'
  const fn = '#606d7b'
  // Stout body with a slow S curve, a blunt rounded snout and a long upper tail lobe.
  const spine: V3[] = [[-2.5, 0.28, -0.3], [-1.6, 0.14, -0.14], [-0.5, 0.02, 0.02], [0.6, 0, 0.04], [1.5, -0.04, 0.0], [2.2, -0.08, -0.04], [2.55, -0.1, -0.06]]
  const radii: Radii = [[0.05, 0.1], [0.15, 0.27], [0.44, 0.58], [0.5, 0.62], [0.4, 0.46], [0.3, 0.3], [0.27, 0.2]]
  const coat = paintWith(countershade(back, belly, 0.1, 0.17), (t, _cs, sn, out) => {
    lerpHex(out, '#7d8995', smooth(-0.3, 0.3, sn) * 0.2)
    if (t < 0.2) lerpHex(out, '#505b67', (1 - t / 0.2) * 0.55)
  })
  b.limb(spine, radii, {}, { paint: mottle(coat, 0.06, 1.2, 4), radial: 32, seg: 11, cap: 8 })
  for (const k of mirrorZ) {
    // underslung mouth line, nostril and five gill slits
    b.limb([[2.55, -0.17, k * 0.0], [2.2, -0.2, k * 0.2], [1.8, -0.17, k * 0.31]], 0.016, { c: '#26303a' }, { radial: 6, seg: 5, cap: 2 })
    for (let i = 0; i < 5; i++) b.limb([[1.1 - i * 0.1, 0.22, k * (0.4 - i * 0.004)], [1.09 - i * 0.1, 0.02, k * 0.47], [1.1 - i * 0.1, -0.2, k * 0.42]], 0.013, { c: '#3a444e' }, { radial: 6, seg: 3, cap: 1 })
    eye(b, [2.05, 0.1, k * 0.27], 0.05, [0.3, 0.2, k], '#d6dadc', false, '#07090b')
    // broad pectoral fin, swept back and down
    fin(b, [[0.85, -0.28, k * 0.4], [0.45, -0.62, k * 1.0], [0.0, -0.95, k * 1.6]], [0.22, 0.34, 0.05], 0.04, '#778593', 'xz', undefined, 8)
    // pelvic fin
    fin(b, [[-0.95, -0.3, k * 0.2], [-1.2, -0.5, k * 0.45], [-1.4, -0.6, k * 0.6]], [0.12, 0.12, 0.03], 0.03, '#8a96a2', 'xz')
  }
  // tall swept first dorsal, small second dorsal, anal fin, and the lopsided tail
  fin(b, [[0.65, 0.48, 0], [0.32, 1.02, 0], [-0.1, 1.42, 0]], [0.5, 0.32, 0.04], 0.07, fn, 'xy', undefined, 6)
  fin(b, [[-1.2, 0.2, 0], [-1.38, 0.44, 0], [-1.5, 0.56, 0]], [0.17, 0.1, 0.02], 0.03, fn, 'xy')
  fin(b, [[-1.25, -0.2, 0], [-1.42, -0.42, 0], [-1.5, -0.52, 0]], [0.15, 0.1, 0.02], 0.03, '#8d99a5', 'xy')
  fin(b, [[-2.3, 0.26, -0.28], [-2.75, 0.92, -0.35], [-3.2, 1.6, -0.42]], [0.2, 0.26, 0.04], 0.05, fn, 'xy', undefined, 5)
  fin(b, [[-2.3, 0.2, -0.28], [-2.58, -0.18, -0.34], [-2.85, -0.6, -0.4]], [0.17, 0.2, 0.03], 0.04, '#7b8997', 'xy', undefined, 5)
}

// ---------- Blue crab ----------

export function crabModel(b: Builder): void {
  const blue = '#3b78ae'
  const olive = '#6a7040'
  const cream = '#e6e3cf'
  const tip = '#d8522a'
  // Wide flat carapace, olive brown on top, pale underneath, bluish toward the margin.
  const shell = mottle(
    paintWith(countershade(olive, cream, 0.05, 0.3), (t, cs, sn, out) => {
      lerpHex(out, '#5f8570', smooth(0.5, 1, sn) * 0.28 * smooth(0, 0.7, Math.abs(cs)))
      lerpHex(out, '#4f86b0', smooth(0.8, 1, Math.abs(t - 0.5) * 2) * 0.55)
    }),
    0.07,
    1.2,
    1,
  )
  b.limb([[0, 0.55, -1.25], [0, 0.6, -0.65], [0, 0.63, 0], [0, 0.6, 0.65], [0, 0.55, 1.25]], [[0.3, 0.16], [0.8, 0.31], [0.92, 0.37], [0.8, 0.31], [0.3, 0.16]], {}, { paint: shell, radial: 36, seg: 10, cap: 7, ref: [0, 1, 0] })
  for (const k of mirrorZ) {
    // the long sharp lateral spines of the blue crab
    b.limb([[0.0, 0.58, k * 1.3], [0.0, 0.6, k * 1.85], [0.0, 0.63, k * 2.45]], [[0.22, 0.09], [0.1, 0.05], [0.012, 0.012]], { c: '#5a93bd' }, { radial: 12, seg: 7, cap: 2 })
    // eyes on short stalks at the front edge
    b.limb([[0.8, 0.7, k * 0.3], [0.88, 0.88, k * 0.33]], 0.032, { c: '#dfe6e0' }, { radial: 8, seg: 3, cap: 2 })
    eye(b, [0.91, 0.93, k * 0.34], 0.07, [0.6, 0.3, k * 0.3], '#242f38')
    // arm swings out and forward, the claw is held out in front of the body
    b.limb([[0.55, 0.5, k * 0.6], [0.9, 0.62, k * 1.1], [1.35, 0.7, k * 1.05]], [[0.14, 0.12], [0.13, 0.11], [0.14, 0.12]], { c: blue }, { radial: 14, seg: 7, cap: 4 })
    b.ell([1.78, 0.76, k * 0.92], [0.42, 0.2, 0.22], blue, [0, k * 0.28, 0], 20, 12)
    const finger = (hi: number): Paint => (t, _cs, _sn, out) => {
      out.set(blue)
      lerpHex(out, tip, smooth(0.45, 0.65, t))
      lerpHex(out, '#f2c8a0', smooth(0.88, 1, t) * hi)
    }
    // fixed finger above, moving finger below, with a gap between them
    b.limb([[2.02, 0.88, k * 0.84], [2.45, 0.96, k * 0.64], [2.78, 0.9, k * 0.4]], [[0.095, 0.07], [0.07, 0.055], [0.013, 0.013]], {}, { radial: 12, seg: 7, cap: 3, paint: finger(0.5) })
    b.limb([[2.02, 0.62, k * 0.94], [2.48, 0.66, k * 0.78], [2.82, 0.74, k * 0.48]], [[0.095, 0.065], [0.07, 0.05], [0.013, 0.013]], {}, { radial: 12, seg: 7, cap: 3, paint: finger(0.5) })
    // three pairs of slim walking legs, bent knees above the shell, pointed tips
    const reach: [number, number][] = [[0.4, 0.45], [0.0, 0.1], [-0.4, -0.3]]
    reach.forEach(([x, dx], i) => {
      const edge = 1.3 * Math.sqrt(Math.max(0.1, 1 - (x / 0.9) ** 2))
      b.limb([[x, 0.46, k * edge * 0.72], [x + dx * 0.25, 0.9, k * (edge + 0.5)], [x + dx * 0.65, 0.62, k * (edge + 0.85)], [x + dx, 0.03, k * (edge + 1.25)]], [0.085, 0.065, 0.045, 0.014], { c: i % 2 ? '#4d86b4' : '#5a92bd' }, { radial: 10, seg: 7, cap: 3 })
    })
    // flattened rear swimming paddle: broad, thin, oval
    b.limb([[-0.68, 0.44, k * 0.85], [-0.95, 0.4, k * 1.5], [-1.2, 0.34, k * 2.0], [-1.38, 0.3, k * 2.5]], [[0.07, 0.06], [0.14, 0.045], [0.27, 0.035], [0.17, 0.025]], { c: '#6aa2c9', m: THIN }, { radial: 16, seg: 7, cap: 4 })
  }
}

// ---------- Brown pelican ----------

export function pelicanModel(b: Builder): void {
  const brown = '#7a6a5a'
  const wing = paintWith(countershade(brown, '#a99887', 0, 0.6), (t, _c, _s, out) => {
    lerpHex(out, '#cfc6b4', (1 - smooth(0.0, 0.3, t)) * 0.4)
    lerpHex(out, '#3f342a', smooth(0.5, 0.85, t) * 0.85)
  })
  // Plump body with a deep chest, held a little tilted.
  b.limb([[-1.15, 1.05, 0], [-0.3, 1.15, 0], [0.55, 1.22, 0], [0.95, 1.3, 0]], [[0.3, 0.3], [0.78, 0.68], [0.66, 0.6], [0.38, 0.36]], {}, { paint: mottle(countershade('#8a7966', '#b3a68f', 0, 0.5), 0.07, 1.4, 4), radial: 28, seg: 9, cap: 7 })
  // S curved neck: dark chestnut at the back, white in front, rising into a pale head.
  const neck = paintWith(countershade('#e6dcc0', '#e6dcc0'), (t, _c, sn, out) => {
    lerpHex(out, '#4f3b2c', (1 - smooth(0.15, 0.6, t)) * 0.85 * smooth(-0.2, 0.7, sn))
    lerpHex(out, '#f4ecc4', smooth(0.75, 1, t) * 0.7)
  })
  b.limb([[0.7, 1.4, 0], [1.05, 1.75, 0], [0.8, 2.1, 0], [0.95, 2.42, 0], [1.3, 2.58, 0]], [[0.3, 0.3], [0.2, 0.2], [0.14, 0.14], [0.15, 0.15], [0.2, 0.2]], {}, { paint: neck, radial: 20, seg: 9, cap: 6 })
  // pale, yellow washed crown
  b.ell([1.38, 2.64, 0], [0.26, 0.19, 0.19], '#f3e6b8', [0, 0, -0.1], 20, 14)
  // long slender bill, pale gray with a hooked tip, and the pouch slung beneath it
  b.limb([[1.5, 2.6, 0], [2.15, 2.44, 0], [2.85, 2.2, 0]], [[0.09, 0.075], [0.08, 0.06], [0.04, 0.03]], { c: '#bda987' }, { radial: 14, seg: 8, cap: 5 })
  b.limb([[2.82, 2.21, 0], [2.95, 2.14, 0], [2.97, 2.05, 0]], [0.036, 0.03, 0.012], { c: '#a08558' }, { radial: 8, seg: 4, cap: 3 })
  const pouch = paintWith(countershade('#c9a27a', '#dcbb95', 0, 0.5), (t, _c, _s, out) => lerpHex(out, '#8f7253', smooth(0.7, 1, t) * 0.6))
  b.limb([[1.5, 2.52, 0], [2.0, 2.32, 0], [2.7, 2.14, 0]], [[0.1, 0.09], [0.15, 0.22], [0.04, 0.04]], { m: THIN }, { radial: 18, seg: 9, cap: 5, paint: pouch })
  b.limb([[1.5, 2.5, 0], [1.2, 2.38, 0], [0.98, 2.28, 0]], [[0.1, 0.09], [0.11, 0.09], [0.07, 0.06]], { m: THIN }, { radial: 12, seg: 6, cap: 3, paint: pouch })
  for (const k of mirrorZ) {
    eye(b, [1.42, 2.7, k * 0.15], 0.06, [0.4, 0.2, k], '#f3ecd0', false, DARK, '#7d6a52')
    // folded wing: deep shoulder tapering into long dark primaries that cross over the tail
    b.limb([[0.5, 1.46, k * 0.6], [-0.2, 1.36, k * 0.68], [-0.95, 1.1, k * 0.58], [-1.7, 0.82, k * 0.4], [-2.2, 0.68, k * 0.3]], [[0.1, 0.22], [0.14, 0.42], [0.1, 0.32], [0.05, 0.14], [0.02, 0.04]], { m: THIN }, { radial: 16, seg: 7, cap: 4, paint: mottle(wing, 0.07, 1.5, 5) })
    // short dark legs with webbed feet
    b.limb([[0.14, 0.8, k * 0.25], [0.14, 0.42, k * 0.25], [0.16, 0.06, k * 0.25]], [0.1, 0.07, 0.055], { c: '#4a4339' }, { radial: 10, seg: 5, cap: 3 })
    b.ell([0.4, 0.04, k * 0.25], [0.36, 0.035, 0.21], '#595044', [0, k * 0.15, 0], 16, 8)
  }
  fin(b, [[-0.95, 1.02, 0], [-1.5, 0.78, 0], [-1.95, 0.58, 0]], [0.28, 0.24, 0.04], 0.05, '#5e5145', 'xz')
}

// ---------- Green tree frog ----------

export function frogModel(b: Builder): void {
  const green = '#55b043'
  const pad = '#a6df7c'
  const skin = mottle(
    paintWith(countershade(green, '#eaf3c4', -0.2, 0.4), (t, cs, sn, out) => {
      // pale lateral stripe from jaw to hip
      const st = smooth(0.12, 0.3, t) * (1 - smooth(0.8, 0.95, t)) * (1 - smooth(0.0, 0.12, Math.abs(sn - 0.0))) * smooth(0.5, 0.8, Math.abs(cs))
      lerpHex(out, '#f6f2b4', st * 0.9)
      lerpHex(out, '#6fc652', smooth(0.3, 1, sn) * 0.2)
    }),
    0.06,
    1.5,
    8,
  )
  const wet: [number, number] = [0.22, 0]
  // Pear shaped body low to the ground, broad short head.
  b.limb([[-1.0, 0.68, 0], [-0.25, 0.74, 0], [0.5, 0.8, 0], [1.2, 0.76, 0]], [[0.5, 0.42], [0.76, 0.62], [0.68, 0.52], [0.48, 0.36]], { m: wet }, { paint: skin, radial: 32, seg: 10, cap: 8 })
  b.ell([1.3, 0.7, 0], [0.34, 0.28, 0.4], '#e8f0c2', [0, 0, -0.1], 20, 12, wet)
  for (const k of mirrorZ) {
    // big golden eyes bulging above the head
    b.ell([0.92, 1.06, k * 0.36], [0.21, 0.18, 0.21], '#4aa63a', [0, 0, 0], 16, 12, wet)
    eye(b, [0.97, 1.13, k * 0.41], 0.145, [0.5, 0.5, k * 0.9], '#d9b648', 'h', '#0d1a0c', '#4aa63a')
    b.ell([1.42, 0.86, k * 0.1], [0.025, 0.018, 0.025], '#2a5a28', [0, 0, 0], 6, 5)
    // hind leg folded into a crouch: thigh, knee up, shin back, long foot, toes with sticky pads
    b.limb([[-0.62, 0.72, k * 0.5], [0.1, 0.95, k * 1.0], [-0.48, 0.34, k * 1.1], [0.35, 0.09, k * 1.18]], [0.31, 0.19, 0.12, 0.075], { m: wet }, { paint: mottle(countershade('#5cb246', '#b9dd8b', 0, 0.8), 0.06, 1.7, 9), radial: 18, seg: 8, cap: 4 })
    for (let i = -1; i <= 2; i++) {
      const z = k * (1.18 + (i - 0.5) * 0.12)
      b.limb([[0.4, 0.08, k * 1.18], [0.58, 0.07, z], [0.74, 0.07, z + k * (i - 0.5) * 0.05]], [0.035, 0.03, 0.026], { c: green, m: wet }, { radial: 8, seg: 3, cap: 3 })
      b.ell([0.78, 0.07, z + k * (i - 0.5) * 0.05], [0.065, 0.04, 0.065], pad, [0, 0, 0], 12, 8, wet)
    }
    // front leg: straight under the chest with a spread hand
    b.limb([[0.6, 0.52, k * 0.5], [0.76, 0.3, k * 0.66], [0.82, 0.07, k * 0.72]], [0.13, 0.09, 0.07], { m: wet }, { paint: skin, radial: 12, seg: 6, cap: 4 })
    for (let i = -1; i <= 2; i++) {
      const z = k * (0.72 + (i - 0.5) * 0.1)
      b.limb([[0.84, 0.06, k * 0.72], [0.92, 0.055, z]], [0.028, 0.024], { c: green, m: wet }, { radial: 8, seg: 3, cap: 3 })
      b.ell([0.96, 0.055, z], [0.055, 0.035, 0.055], pad, [0, 0, 0], 10, 8, wet)
    }
  }
  b.limb([[1.52, 0.64, 0.0], [1.22, 0.72, 0.3], [0.78, 0.72, 0.42]], 0.012, { c: '#2d6a2a' }, { radial: 6, seg: 5, cap: 2 })
  b.limb([[1.52, 0.64, 0.0], [1.22, 0.72, -0.3], [0.78, 0.72, -0.42]], 0.012, { c: '#2d6a2a' }, { radial: 6, seg: 5, cap: 2 })
}

// ---------- Barred owl ----------

export function owlModel(b: Builder): void {
  const brown = '#6a5440'
  const cream = '#dccfb2'
  const bars = mottle(
    (t, cs, sn, out) => {
      // On this upright body cs runs front (negative) to back, so the pale breast is the front half. It is crossed by
      // dark bars high up and streaked lower down; the back is dark brown flecked with pale spots.
      const front = smooth(-0.1, 0.55, -cs)
      out.set(brown)
      lerpHex(out, cream, front * 0.9)
      const bar = smooth(0.2, 0.5, 0.5 - Math.abs(((t * 13) % 1) - 0.5)) * smooth(0.1, 0.5, front)
      lerpHex(out, '#4b3a2b', bar * 0.75 * smooth(0.2, 0.55, t) * (1 - smooth(0.7, 0.9, t)))
      const streak = smooth(0.55, 0.8, Math.sin(sn * 22 + cs * 9)) * smooth(0.1, 0.5, front) * (1 - smooth(0.2, 0.4, t)) * smooth(0.05, 0.2, t)
      lerpHex(out, '#5a4634', streak * 0.6)
      const fleck = smooth(0.78, 0.9, Math.sin(t * 61 + cs * 13) * Math.sin(sn * 17 + t * 29))
      lerpHex(out, '#e6dcc4', fleck * 0.5 * (1 - front))
    },
    0.08,
    2.2,
    11,
  )
  // upright teardrop body and a big round head with no neck
  b.limb([[0, 0.45, 0], [0, 1.2, 0], [0.03, 1.9, 0]], [[0.3, 0.3], [0.58, 0.64], [0.5, 0.56]], {}, { paint: bars, radial: 32, seg: 10, cap: 8 })
  b.ell([0.06, 2.22, 0], [0.5, 0.44, 0.56], '#7d6853', [0, 0, 0], 32, 22)
  for (const k of mirrorZ) {
    // pale facial discs with a darker ruff, dark brow, and large dark eyes
    b.ell([0.4, 2.22, k * 0.25], [0.12, 0.34, 0.3], '#ddd2b9', [0, k * 0.12, 0], 20, 14)
    b.torus(0.3, 0.035, { p: [0.47, 2.22, k * 0.25], r: [0, Math.PI / 2 - k * 0.15, 0], s: [0.95, 1.2, 1], c: '#6d5a46' }, 8, 28)
    b.ell([0.42, 2.46, k * 0.22], [0.12, 0.05, 0.2], '#4a3a2c', [0, k * 0.1, -0.15], 12, 8)
    eye(b, [0.47, 2.26, k * 0.22], 0.105, [0.7, 0.1, k * 0.5], '#1a120d', false, '#030303', '#4a3a2c')
    // folded wing along the side, long primaries toward the tail
    b.limb([[0.0, 1.8, k * 0.58], [-0.12, 1.2, k * 0.66], [-0.28, 0.6, k * 0.54], [-0.5, 0.15, k * 0.38]], [[0.4, 0.1], [0.42, 0.11], [0.28, 0.08], [0.06, 0.03]], { m: THIN }, { radial: 16, seg: 8, cap: 5, paint: mottle(countershade('#5d4938', '#7a6650', 0, 0.8), 0.14, 2, 5) })
    // feathered legs and gripping feet
    b.limb([[0.15, 0.5, k * 0.22], [0.16, 0.2, k * 0.22]], [0.1, 0.085], { c: '#cbbd9f' }, { radial: 10, seg: 3, cap: 3 })
    toes(b, [0.2, 0.05, k * 0.22], [-0.45, 0, 0.45], 0.2, 0.045, '#d3c69c', '#2a2218', k)
  }
  b.limb([[0.6, 2.2, 0], [0.7, 2.13, 0], [0.74, 2.02, 0]], [0.065, 0.055, 0.018], { c: '#d9b648' }, { radial: 10, seg: 4, cap: 4 })
  // barred tail
  fin(b, [[-0.35, 0.75, 0], [-0.55, 0.35, 0], [-0.78, 0.05, 0]], [0.3, 0.26, 0.06], 0.06, '#5f4e3a', 'xy', (t, _c, _s, out) => {
    out.set('#6d5a45')
    lerpHex(out, '#3b2f24', smooth(0.2, 0.4, 0.5 - Math.abs(((t * 5) % 1) - 0.5)) * 0.7)
  })
}

// ---------- Grasshopper ----------

export function grasshopperModel(b: Builder): void {
  const green = '#86b53a'
  const body = mottle(
    paintWith(countershade('#8cbc3a', '#d3df8a', -0.1, 0.5), (t, _cs, sn, out) => {
      lerpHex(out, '#e7e07a', smooth(0, 0.18, 0.12 - Math.abs(sn - 0.4)) * 0.7)
      // fine dark lines between the abdomen segments
      lerpHex(out, '#4c6420', smooth(0.82, 0.98, Math.sin(t * 95)) * 0.5 * (1 - smooth(0.5, 0.8, t)))
    }),
    0.07,
    1.6,
    2,
  )
  b.limb([[-1.5, 0.8, 0], [-0.7, 0.84, 0], [0.1, 0.86, 0], [0.6, 0.88, 0]], [[0.06, 0.06], [0.2, 0.22], [0.2, 0.22], [0.14, 0.16]], {}, { paint: body, radial: 20, seg: 12, cap: 6 })
  // head: tall face, big compound eyes, short antennae
  b.ell([0.95, 0.86, 0], [0.3, 0.3, 0.24], '#7fae36', [0, 0, -0.1], 24, 16)
  b.ell([1.1, 0.68, 0], [0.16, 0.12, 0.17], '#b9d062', [0, 0, 0], 14, 10)
  for (const k of mirrorZ) {
    b.ell([1.0, 0.99, k * 0.17], [0.13, 0.14, 0.09], '#5c7f2a', [0, 0, 0], 14, 10)
    eye(b, [1.04, 1.0, k * 0.2], 0.1, [0.4, 0.3, k], '#c9b44f', false, '#1a1608', '#6b8a2d')
    b.limb([[1.15, 1.08, k * 0.07], [1.5, 1.45, k * 0.2], [1.95, 1.7, k * 0.35]], [0.026, 0.02, 0.012], { c: '#3a4a20' }, { radial: 6, seg: 6, cap: 2 })
    // long folded wings with veins, lying along the back
    fin(b, [[0.45, 1.05, k * 0.1], [-0.4, 1.08, k * 0.18], [-1.15, 1.0, k * 0.2], [-1.65, 0.9, k * 0.17]], [0.1, 0.14, 0.11, 0.02], 0.014, '#b3d56a', 'xz', undefined, 14)
    // jumping hind leg: heavy ridged femur, long spiny tibia, foot
    b.limb([[-0.15, 0.74, k * 0.2], [-0.6, 1.22, k * 0.34], [-1.3, 0.62, k * 0.36]], [0.12, 0.135, 0.05], { c: '#7da82e' }, { radial: 14, seg: 8, cap: 4, paint: mottle(countershade('#7fab30', '#a9c850', 0, 0.8), 0.1, 2, 3) })
    b.ell([-1.3, 0.62, k * 0.36], [0.07, 0.07, 0.07], '#2f3c18', [0, 0, 0], 8, 6)
    b.limb([[-1.3, 0.62, k * 0.36], [-1.58, 0.28, k * 0.38], [-1.5, 0.05, k * 0.38]], [0.05, 0.04, 0.03], { c: '#58792a' }, { radial: 10, seg: 5, cap: 3 })
    for (let i = 0; i < 4; i++) b.ell([-1.38 - i * 0.05, 0.5 - i * 0.1, k * 0.4], [0.025, 0.04, 0.02], '#2f3c18', [0, 0, 0], 5, 4)
    for (const [x0, dx] of [[0.5, 0.25], [0.2, 0.1]] as [number, number][]) {
      b.limb([[x0, 0.72, k * 0.15], [x0 + dx * 0.8, 0.4, k * 0.42], [x0 + dx * 1.3, 0.04, k * 0.5]], [0.055, 0.042, 0.03], { c: green }, { radial: 10, seg: 5, cap: 3 })
    }
  }
}

// ---------- Fin membranes ----------

/**
 * Thin fin membrane between a base curve and a free edge: a grid of rows (base to edge) and columns (along the fin),
 * two faces that meet at the rim, smooth normals. `rays` paints fine ribs along the columns (radians over the whole fin). One indexed mesh, so it merges into the specimen and shares its material.
 */
export function sail(b: Builder, base: V3[], edge: V3[], thick: number, color: string, opts: { rows?: number; rays?: number; plane?: V3 } = {}): void {
  const rows = opts.rows ?? 5
  const n = base.length
  const nrm = new THREE.Vector3(...(opts.plane ?? [0, 0, 1]))
  const pos: number[] = []
  const pnt: number[] = []
  const ids = new Map<string, number>()
  const vert = (layer: number, r: number, j: number): number => {
    const rim = r === rows || j === 0 || j === n - 1
    const key = `${rim ? 0 : layer}:${r}:${j}`
    let id = ids.get(key)
    if (id === undefined) {
      const t = r / rows
      const p = base[j]
      const e = edge[j]
      // the membrane thins toward its free edge
      const w = thick * (rim ? 0 : layer) * (1 - t * 0.7)
      pos.push(p[0] + (e[0] - p[0]) * t + nrm.x * w, p[1] + (e[1] - p[1]) * t + nrm.y * w, p[2] + (e[2] - p[2]) * t + nrm.z * w)
      pnt.push(t, (j / (n - 1)) * (opts.rays ?? 0), 0)
      id = pos.length / 3 - 1
      ids.set(key, id)
    }
    return id
  }
  const idx: number[] = []
  // the +layer faces along `plane`, whichever way the columns run
  const e0 = new THREE.Vector3(...base[1]).sub(new THREE.Vector3(...base[0]))
  const up = new THREE.Vector3(...edge[0]).sub(new THREE.Vector3(...base[0]))
  const flip = e0.cross(up).dot(nrm) < 0 ? -1 : 1
  for (const layer of [1, -1]) {
    for (let r = 0; r < rows; r++) {
      for (let j = 0; j < n - 1; j++) {
        const a = vert(layer, r, j)
        const c = vert(layer, r, j + 1)
        const d = vert(layer, r + 1, j)
        const e = vert(layer, r + 1, j + 1)
        if (layer * flip > 0) idx.push(a, c, d, c, e, d)
        else idx.push(a, d, c, c, d, e)
      }
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array((pos.length / 3) * 2).fill(0), 2))
  g.setAttribute('paint', new THREE.Float32BufferAttribute(pnt, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  const rays = opts.rays ?? 0
  b.geo(g, { c: color, m: THIN }, (t, cs, _sn, out) => {
    const rib = rays ? 0.5 + 0.5 * Math.cos(cs) : 1
    out.set('#ffffff').multiplyScalar(0.84 + 0.2 * rib * smooth(0.0, 0.3, t))
  })
}

/** Spine (a stiff thin ray) from a base point to a tip, tapering. */
export function finSpine(b: Builder, a: V3, tip: V3, r: number, color: string): void {
  b.limb([a, [(a[0] + tip[0]) / 2, (a[1] + tip[1]) / 2, (a[2] + tip[2]) / 2], tip], [r, r * 0.7, r * 0.3], { c: color }, { radial: 6, seg: 3, cap: 2 })
}
