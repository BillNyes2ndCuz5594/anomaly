import * as THREE from 'three/webgpu'
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'
import { Builder, countershade, groundCenter, lerpHex, paintWith, recenter, smooth, spineAt, type Paint, type V3 } from './builder'

// ---------- Lab B: dog-like mammal and flowering tree ----------

export interface PartGeo {
  id: string
  geo: THREE.BufferGeometry
  /** Center of the part, for light bridges. Geometry is recentered on the origin. */
  center: V3
}

function finish(id: string, b: Builder): PartGeo {
  const geo = b.build()
  return { id, geo, center: recenter(geo) }
}

function buildAnimal(): PartGeo[] {
  const skin = new Builder()
  skin
    .capsule(0.55, 1.3, { p: [0, 1.55, 0], r: [0, 0, Math.PI / 2], s: [1, 1, 0.85] }, 14)
    .sphere(0.6, { p: [0.55, 1.6, 0], s: [1, 1.05, 0.85] }, 12, 8)
    .sphere(0.56, { p: [-0.6, 1.55, 0], s: [1, 1, 0.9] }, 12, 8)
    .capsule(0.3, 0.4, { p: [1.15, 2.0, 0], r: [0, 0, -0.9] }, 10)
    .sphere(0.43, { p: [1.5, 2.35, 0], s: [1.1, 0.95, 0.9] }, 12, 8)
    .capsule(0.2, 0.35, { p: [1.98, 2.24, 0], r: [0, 0, Math.PI / 2], s: [1, 1, 0.9] }, 8)
    .sphere(0.09, { p: [2.22, 2.28, 0] }, 8, 6)
    .cone(0.17, 0.42, { p: [1.36, 2.82, 0.3], r: [0.25, 0, 0.35] }, 6)
    .cone(0.17, 0.42, { p: [1.36, 2.82, -0.3], r: [-0.25, 0, 0.35] }, 6)
    .capsule(0.1, 0.7, { p: [-1.3, 2.05, 0], r: [0, 0, 0.95] }, 6)
  for (const x of [0.85, -0.85]) {
    for (const z of [0.32, -0.32]) {
      skin
        .capsule(0.18, 0.5, { p: [x, 0.95, z] }, 8)
        .capsule(0.14, 0.4, { p: [x, 0.38, z] }, 8)
        .sphere(0.2, { p: [x + 0.08, 0.1, z], s: [1.3, 0.6, 1] }, 8, 6)
    }
  }

  const bones = new Builder()
  bones
    .sphere(0.3, { p: [1.5, 2.35, 0], s: [1.15, 0.9, 0.8] }, 10, 7)
    .capsule(0.1, 0.3, { p: [1.92, 2.22, 0], r: [0, 0, Math.PI / 2] }, 6)
    .tube([[1.3, 2.1, 0], [0.6, 1.95, 0], [-0.5, 1.9, 0], [-1.15, 1.95, 0]], 0.06, {}, 24, 6)
    .tube([[-1.15, 1.95, 0], [-1.45, 2.2, 0], [-1.7, 2.5, 0]], 0.04, {}, 10, 5)
    .sphere(0.26, { p: [-0.85, 1.75, 0], s: [0.8, 1, 0.9] }, 8, 6)
  for (const x of [0.65, 0.35, 0.05, -0.25, -0.5]) bones.torus(0.42, 0.04, { p: [x, 1.6, 0], r: [0, Math.PI / 2, 0], s: [1, 1, 1] }, 5, 14)
  for (const x of [0.85, -0.85]) {
    for (const z of [0.32, -0.32]) {
      bones.seg([x, 1.4, z], [x, 0.7, z], 0.07, undefined, 0.05).seg([x, 0.7, z], [x, 0.14, z], 0.05, undefined, 0.05)
    }
  }
  return [finish('skin', skin), finish('skeleton', bones)]
}

function buildPlant(): PartGeo[] {
  const root = new Builder()
  root
    .tube([[0, 0, 0], [0, -0.5, 0], [0.05, -1.3, 0]], 0.07, {}, 12, 5)
    .tube([[0, -0.1, 0], [-0.45, -0.5, 0.1], [-0.95, -0.85, 0.1]], 0.06, {}, 12, 5)
    .tube([[0, -0.1, 0], [0.45, -0.5, -0.1], [0.95, -0.9, 0]], 0.06, {}, 12, 5)
    .tube([[0, -0.3, 0], [-0.3, -0.8, -0.2], [-0.55, -1.2, -0.2]], 0.04, {}, 10, 5)
    .tube([[0, -0.3, 0], [0.3, -0.85, 0.2], [0.5, -1.25, 0.25]], 0.04, {}, 10, 5)

  const stem = new Builder()
  stem
    .cyl(0.13, 0.19, 2.7, { p: [0, 1.35, 0] }, 8)
    .tube([[0, 1.9, 0], [-0.4, 2.35, 0.05], [-0.95, 2.75, 0.1]], 0.07, {}, 14, 5)
    .tube([[0, 2.0, 0], [0.45, 2.4, -0.05], [0.95, 2.7, 0]], 0.07, {}, 14, 5)
    .tube([[0, 2.5, 0], [0.1, 2.9, 0.3], [0.25, 3.2, 0.55]], 0.05, {}, 12, 5)
    .tube([[0, 2.5, 0], [-0.15, 2.95, -0.25], [-0.3, 3.3, -0.45]], 0.05, {}, 12, 5)

  const bark = new Builder()
  bark.cyl(0.22, 0.32, 1.5, { p: [0, 0.75, 0] }, 7).torus(0.27, 0.035, { p: [0, 0.55, 0], r: [Math.PI / 2, 0, 0] }, 4, 7).torus(0.25, 0.035, { p: [0, 1.0, 0], r: [Math.PI / 2, 0, 0] }, 4, 7)

  const leaf = new Builder()
  const leaves: [V3, number][] = [
    [[-1.15, 2.85, 0.1], 0.35],
    [[-0.75, 3.05, 0.35], -0.2],
    [[1.15, 2.8, 0], -0.35],
    [[0.75, 3.0, -0.3], 0.2],
    [[0.35, 3.4, 0.6], -0.3],
    [[-0.45, 3.45, -0.5], 0.3],
    [[0, 3.1, 0.5], 0],
    [[-0.5, 2.35, 0.4], 0.15],
    [[0.55, 2.4, -0.35], -0.15],
    [[0.2, 3.3, -0.3], 0.1],
  ]
  for (const [p, rz] of leaves) leaf.sphere(0.4, { p, s: [1.1, 0.17, 0.6], r: [0.2, rz * 2, rz] }, 8, 5)

  const flower = new Builder()
  flower.sphere(0.13, { p: [0.28, 3.3, 0.58] }, 8, 6)
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    flower.sphere(0.17, { p: [0.28 + Math.cos(a) * 0.27, 3.3 + Math.sin(a) * 0.27, 0.58], s: [1, 0.55, 0.3], r: [0, 0, a] }, 8, 5)
  }

  const fruit = new Builder()
  const fruitPos: V3[] = [[0.9, 2.55, 0.18], [-0.85, 2.6, 0.3], [0.25, 2.65, 0.5]]
  for (const p of fruitPos) fruit.sphere(0.2, { p }, 10, 8)

  const seed = new Builder()
  for (const p of fruitPos) {
    seed.sphere(0.045, { p: [p[0] - 0.05, p[1] + 0.03, p[2]] }, 5, 4).sphere(0.045, { p: [p[0] + 0.06, p[1] - 0.03, p[2] + 0.02] }, 5, 4)
  }

  const spore = new Builder()
  for (const [p] of [leaves[0], leaves[2], leaves[7]]) {
    for (let i = 0; i < 4; i++) spore.sphere(0.035, { p: [p[0] - 0.25 + i * 0.17, p[1] - 0.08, p[2] + (i % 2) * 0.1] }, 5, 4)
  }

  return [finish('root', root), finish('stem', stem), finish('bark', bark), finish('leaf', leaf), finish('flower', flower), finish('fruit', fruit), finish('seed', seed), finish('spore', spore)]
}

let animalCache: PartGeo[] | null = null
let plantCache: PartGeo[] | null = null
export const animalParts = () => (animalCache ??= buildAnimal())
export const plantParts = () => (plantCache ??= buildPlant())

// ---------- Tortoise shell ----------

/** Seeds of the scute plates in shell space (x along the body, z across), both in -1..1: 5 vertebral, 4 pairs of costal, a marginal ring. */
export const SCUTE_SEEDS: [number, number][] = (() => {
  const out: [number, number][] = []
  for (const x of [-0.7, -0.35, 0, 0.35, 0.7]) out.push([x, 0])
  for (const x of [-0.6, -0.2, 0.2, 0.6]) out.push([x, 0.47], [x, -0.47])
  for (let i = 0; i < 12; i++) out.push([Math.cos((i / 12) * Math.PI * 2 + 0.26) * 0.93, Math.sin((i / 12) * Math.PI * 2 + 0.26) * 0.93])
  return out
})()

/**
 * Nearest scute plate for a point in shell space, with the distance to the seam shared with the next plate
 * (0 on a seam, growing toward the middle of a plate) and the distance to the plate center.
 */
export function scuteAt(x: number, z: number, seeds: [number, number][] = SCUTE_SEEDS): { id: number; edge: number; center: number } {
  let d1 = Infinity
  let d2 = Infinity
  let id = 0
  for (let i = 0; i < seeds.length; i++) {
    const d = Math.hypot(x - seeds[i][0], z - seeds[i][1])
    if (d < d1) {
      d2 = d1
      d1 = d
      id = i
    } else if (d < d2) d2 = d
  }
  return { id, edge: (d2 - d1) / 2, center: d1 }
}

/** Domed shell with plates raised a little above dark seams, one smooth indexed surface. */
function scuteShell(b: Builder, c: V3, r: V3): void {
  let g: THREE.BufferGeometry = new THREE.SphereGeometry(1, 72, 30, 0, Math.PI * 2, 0, Math.PI / 2)
  g.deleteAttribute('normal')
  g.deleteAttribute('uv')
  g = mergeVertices(g, 1e-4)
  const pos = g.getAttribute('position') as THREE.BufferAttribute
  const paint = new Float32Array(pos.count * 3)
  const uv = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const sc = scuteAt(x, z)
    const raise = smooth(0.0, 0.06, sc.edge)
    const k = 1 + 0.05 * raise * smooth(0, 0.12, y + 0.02)
    pos.setXYZ(i, x * k, y * k, z * k)
    // t = plate shade 0..1, cs = seam darkness, sn = growth ring
    paint[i * 3] = (Math.sin(sc.id * 12.9898) * 43758.5453) % 1
    paint[i * 3 + 1] = 1 - raise
    paint[i * 3 + 2] = 0.5 + 0.5 * Math.sin(sc.center * 55)
  }
  g.setAttribute('paint', new THREE.BufferAttribute(paint, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  g.computeVertexNormals()
  const lo = new THREE.Color('#7d6338')
  const hi = new THREE.Color('#a98e57')
  const seam = new THREE.Color('#3b2d1a')
  b.geo(g, { p: c, s: r }, (t, cs, sn, out) => {
    out.copy(lo).lerp(hi, Math.abs(t % 1) * 0.8 + sn * 0.12).lerp(seam, cs * 0.85)
  })
}

// ---------- Lab C and item visuals: stylized specimens ----------
//
// Every specimen is built from smooth, variable radius tubes (limb), ellipsoids and a few fins, merged into one
// indexed geometry with smooth normals. Colors live in the vertices: countershading, stripes and banding come from
// paint functions, so one lit material (and one draw call) covers the whole animal.

export interface SpecimenGeo {
  geo: THREE.BufferGeometry
  /** Bounding box size after grounding. */
  size: V3
}

const mirrorZ = [1, -1]
const DARK = '#10161c'
const unit = (v: V3): V3 => {
  const l = Math.hypot(...v)
  return [v[0] / l, v[1] / l, v[2] / l]
}

/** Glossy eye: colored iris, dark pupil (optionally a slit) and a bright highlight so it looks alive. */
function eye(b: Builder, p: V3, r: number, look: V3, iris = '#f0ecdf', slit = false, pupil = DARK): void {
  const d = unit(look)
  const side: V3 = unit([-d[2], 0, d[0]])
  b.ell(p, [r, r, r], iris, [0, 0, 0], 14, 10)
  const pr = r * 0.66
  const pp: V3 = [p[0] + d[0] * r * 0.5, p[1] + d[1] * r * 0.5, p[2] + d[2] * r * 0.5]
  b.ell(pp, slit ? [pr * 0.4, pr * 1.05, pr * 0.4] : [pr, pr, pr], pupil, [0, 0, 0], 12, 8)
  b.ell([p[0] + d[0] * r * 0.82 + side[0] * r * 0.28, p[1] + d[1] * r * 0.82 + r * 0.38, p[2] + d[2] * r * 0.82 + side[2] * r * 0.28], [r * 0.2, r * 0.2, r * 0.2], '#ffffff', [0, 0, 0], 8, 6)
}

/** Flat blade (fin, wing, leaf) along a spine. `chords` sets width per point, `thick` the thickness. */
function fin(b: Builder, pts: V3[], chords: number[], thick: number, color: string, plane: 'xy' | 'xz' | 'auto' = 'auto', paint?: Paint): void {
  b.limb(pts, chords.map((c) => [c, Math.min(thick, c * 0.6)] as [number, number]), { c: color }, { radial: 8, seg: 5, cap: 3, ref: plane === 'xy' ? [0, 0, 1] : plane === 'xz' ? [0, 1, 0] : undefined, paint })
}

/** Rounded paw or foot pad lying on the ground. */
function paw(b: Builder, p: V3, r: number, color: string, rot = 0): void {
  b.ell([p[0], r * 0.5, p[2]], [r * 1.35, r * 0.55, r], color, [0, rot, 0], 14, 10)
}

function bassModel(b: Builder): void {
  const back = '#6b9b45'
  const belly = '#ecf0cd'
  const dark = '#2f4a25'
  const fn = '#5d8a3c'
  const spine: V3[] = [[-2.2, 0.15, 0], [-1.2, 0.08, 0], [0, 0, 0], [1.1, -0.04, 0], [1.85, -0.1, 0], [2.25, -0.16, 0]]
  const paint = paintWith(countershade(back, belly, 0.05, 0.3), (t, cs, sn, out) => {
    // dark lateral band, soft at both ends
    const band = smooth(0.14, 0.3, t) * (1 - smooth(0.8, 0.95, t)) * (1 - smooth(0.2, 0.42, Math.abs(sn - 0.05))) * smooth(0.15, 0.45, Math.abs(cs))
    lerpHex(out, '#1f3320', band * 0.92)
    if (t > 0.8) lerpHex(out, '#d7e0a3', smooth(0.82, 1, t) * 0.3 * (1 - smooth(-0.2, 0.3, sn)))
  })
  b.limb(spine, [[0.05, 0.08], [0.24, 0.4], [0.52, 0.78], [0.5, 0.72], [0.34, 0.46], [0.2, 0.22]], {}, { paint, radial: 28, seg: 8, cap: 6 })
  // big lower jaw and the mouth line that runs back under the eye
  b.ell([2.2, -0.28, 0], [0.34, 0.14, 0.3], '#d9e2b0', [0, 0, 0.15], 14, 10)
  b.limb([[2.55, -0.14, 0.0], [2.0, -0.13, 0.3], [1.6, -0.06, 0.4]], 0.018, { c: '#1d2a18' }, { radial: 6, seg: 5, cap: 2 })
  b.limb([[2.55, -0.14, 0.0], [2.0, -0.13, -0.3], [1.6, -0.06, -0.4]], 0.018, { c: '#1d2a18' }, { radial: 6, seg: 5, cap: 2 })
  for (const k of mirrorZ) {
    eye(b, [1.55, 0.2, k * 0.33], 0.13, [0.4, 0.2, k], '#e9d58a')
    b.limb([[1.2, 0.32, k * 0.44], [1.08, 0.0, k * 0.51], [1.16, -0.3, k * 0.46]], 0.014, { c: '#2c4527' }, { radial: 6, seg: 6, cap: 1 })
  }
  // spiny dorsal fin, soft dorsal fin
  fin(b, [[0.85, 0.5, 0], [0.55, 0.88, 0], [0.25, 1.02, 0]], [0.3, 0.22, 0.02], 0.03, dark, 'xy')
  fin(b, [[0.0, 0.52, 0], [-0.32, 0.88, 0], [-0.7, 0.98, 0]], [0.32, 0.22, 0.02], 0.025, fn, 'xy')
  // forked tail
  fin(b, [[-2.1, 0.1, 0], [-2.6, 0.5, 0], [-2.95, 0.9, 0]], [0.14, 0.3, 0.02], 0.03, fn, 'xy')
  fin(b, [[-2.1, 0.08, 0], [-2.6, -0.3, 0], [-2.95, -0.72, 0]], [0.14, 0.3, 0.02], 0.03, fn, 'xy')
  // belly fins and pectoral fins
  fin(b, [[-0.5, -0.4, 0], [-0.8, -0.75, 0], [-1.05, -0.9, 0]], [0.22, 0.2, 0.03], 0.025, fn, 'xy')
  fin(b, [[0.5, -0.45, 0], [0.35, -0.82, 0], [0.2, -0.95, 0]], [0.16, 0.14, 0.03], 0.025, '#e0d8a0', 'xy')
  for (const k of mirrorZ) fin(b, [[0.95, -0.12, k * 0.42], [0.6, -0.25, k * 0.66], [0.3, -0.38, k * 0.86]], [0.16, 0.2, 0.04], 0.03, '#92b565', 'xz')
}

function sharkModel(b: Builder): void {
  const back = '#6f7c8a'
  const belly = '#f0f3f3'
  const fn = '#637080'
  const spine: V3[] = [[-2.2, 0.2, 0], [-1.2, 0.1, 0], [0, 0, 0], [1.1, -0.04, 0], [1.9, -0.1, 0], [2.35, -0.16, 0]]
  const paint = paintWith(countershade(back, belly, 0.12, 0.16), (t, _cs, _sn, out) => {
    // faint dusky tips toward the tail
    if (t < 0.15) lerpHex(out, '#56626f', (1 - t / 0.15) * 0.6)
  })
  b.limb(spine, [[0.05, 0.08], [0.2, 0.3], [0.5, 0.56], [0.44, 0.48], [0.3, 0.3], [0.2, 0.15]], {}, { paint, radial: 24, seg: 8, cap: 6 })
  // under-jaw shadow line and gill slits
  for (const k of mirrorZ) {
    b.limb([[2.25, -0.2, k * 0.05], [1.9, -0.19, k * 0.22], [1.55, -0.15, k * 0.3]], 0.016, { c: '#2a343e' }, { radial: 6, seg: 5, cap: 2 })
    for (let i = 0; i < 4; i++) b.limb([[0.85 - i * 0.12, 0.13, k * 0.35], [0.84 - i * 0.12, -0.02, k * 0.41], [0.86 - i * 0.12, -0.17, k * 0.38]], 0.014, { c: '#3d4853' }, { radial: 6, seg: 3, cap: 1 })
    eye(b, [1.8, 0.14, k * 0.28], 0.065, [0.3, 0.15, k], '#2d343b')
  }
  // fins: tall swept dorsal, tail lobes, pectorals and small fins
  fin(b, [[0.55, 0.42, 0], [0.22, 0.95, 0], [-0.2, 1.3, 0]], [0.45, 0.3, 0.04], 0.06, fn, 'xy')
  fin(b, [[-1.0, 0.25, 0], [-1.2, 0.5, 0], [-1.3, 0.62, 0]], [0.16, 0.1, 0.02], 0.03, fn, 'xy')
  fin(b, [[-1.95, 0.2, 0], [-2.45, 0.85, 0], [-2.95, 1.5, 0]], [0.22, 0.26, 0.04], 0.05, fn, 'xy')
  fin(b, [[-1.98, 0.12, 0], [-2.3, -0.25, 0], [-2.6, -0.7, 0]], [0.18, 0.18, 0.03], 0.04, '#7b8997', 'xy')
  fin(b, [[-1.0, -0.2, 0], [-1.2, -0.45, 0], [-1.3, -0.55, 0]], [0.14, 0.1, 0.02], 0.025, '#8d99a5', 'xy')
  for (const k of mirrorZ) fin(b, [[0.9, -0.28, k * 0.4], [0.5, -0.62, k * 0.95], [0.1, -0.88, k * 1.5]], [0.2, 0.3, 0.04], 0.04, '#7d8b98', 'xz')
}

function pantherModel(b: Builder): void {
  const tawny = '#bd8748'
  const belly = '#e6d3a8'
  const dk = '#34261d'
  const leg = '#b28046'
  const coat = paintWith(countershade(tawny, belly, -0.1, 0.55), (_t, _cs, sn, out) => lerpHex(out, '#7d572f', smooth(0.5, 1, sn) * 0.32))
  // Long, low torso: chest deep, waist tucked, a soft dip behind the shoulders, hips a touch higher.
  const torso: V3[] = [[-1.45, 1.36, 0], [-0.7, 1.3, 0], [0.05, 1.2, 0], [0.8, 1.27, 0], [1.4, 1.36, 0]]
  b.limb(torso, [[0.33, 0.42], [0.31, 0.38], [0.27, 0.33], [0.35, 0.44], [0.3, 0.37]], {}, { paint: coat, radial: 22, seg: 9, cap: 6 })
  // Thick neck rising into a head carried low and forward.
  b.limb([[1.0, 1.3, 0], [1.5, 1.5, 0], [1.88, 1.6, 0]], [[0.3, 0.36], [0.26, 0.3], [0.25, 0.27]], {}, { paint: coat, radial: 18, seg: 7, cap: 4 })
  // Head: rounded skull, short broad muzzle with a pale chin and lip, a small nose and low, rounded ears set back.
  b.ell([2.0, 1.63, 0], [0.36, 0.3, 0.3], tawny, [0, 0, -0.06], 24, 16)
    .ell([2.3, 1.52, 0], [0.2, 0.15, 0.2], '#dcc59a', [0, 0, -0.12], 18, 12)
    .ell([2.28, 1.4, 0], [0.17, 0.065, 0.15], belly, [0, 0, -0.05], 14, 8)
    .ell([2.47, 1.56, 0], [0.05, 0.04, 0.07], '#5e3f38', [0, 0, 0], 10, 8)
    .limb([[2.46, 1.53, 0], [2.43, 1.45, 0], [2.36, 1.43, 0]], 0.01, { c: dk }, { radial: 6, seg: 4, cap: 2 })
  for (const k of mirrorZ) {
    b.ell([1.84, 1.9, k * 0.2], [0.075, 0.1, 0.085], '#8f6236', [0, 0, 0.1], 14, 10).ell([1.87, 1.9, k * 0.2], [0.04, 0.065, 0.055], dk, [0, 0, 0.1], 10, 8)
    eye(b, [2.2, 1.7, k * 0.2], 0.055, [0.6, 0.1, k], '#d9cc5c', false)
    // dark tear line and whisker spots on the muzzle
    b.limb([[2.22, 1.64, k * 0.23], [2.3, 1.55, k * 0.22]], 0.012, { c: dk }, { radial: 6, seg: 4, cap: 2 })
    for (let i = 0; i < 3; i++) b.ell([2.4 - i * 0.03, 1.5 - i * 0.025, k * (0.1 + i * 0.03)], [0.012, 0.012, 0.012], dk, [0, 0, 0], 6, 5)
    // forelegs: strong shoulder tapering to a slim wrist and a compact paw
    b.limb([[0.82, 1.22, k * 0.25], [0.78, 0.7, k * 0.23], [0.82, 0.3, k * 0.22], [0.86, 0.1, k * 0.22]], [[0.24, 0.26], [0.15, 0.16], [0.095, 0.1], [0.085, 0.085]], { c: leg }, { radial: 14, seg: 6, cap: 4 })
    paw(b, [0.95, 0, k * 0.22], 0.115, '#c49358', 0.0)
    // hindlegs: heavy thigh, forward knee, long hock, tapered foot
    b.limb([[-1.25, 1.28, k * 0.28], [-0.88, 0.8, k * 0.27], [-1.16, 0.4, k * 0.24], [-1.1, 0.1, k * 0.23]], [[0.3, 0.32], [0.18, 0.2], [0.1, 0.11], [0.085, 0.085]], { c: leg }, { radial: 14, seg: 6, cap: 4 })
    paw(b, [-1.0, 0, k * 0.23], 0.115, '#c49358', 0.0)
  }
  // Long, thick tail that droops, then lifts at the end, with a dark tip.
  const tail = paintWith(countershade(tawny, '#d6bd90', 0, 0.5), (t, _c, _s, out) => lerpHex(out, dk, smooth(0.8, 0.93, t)))
  b.limb([[-1.4, 1.38, 0], [-2.0, 1.25, 0], [-2.55, 0.85, 0], [-2.95, 0.48, 0], [-3.4, 0.4, 0], [-3.85, 0.62, 0]], [0.18, 0.165, 0.155, 0.15, 0.145, 0.13], {}, { paint: tail, radial: 14, seg: 8, cap: 5 })
}

function crabModel(b: Builder): void {
  const blue = '#3f7fb2'
  const leg = '#4f88b6'
  const olive = '#6e7442'
  const cream = '#e4e3d0'
  const tip = '#dc5a2c'
  // Wide flat oval carapace, olive-brown on top, pale underneath, bluish toward the edges.
  const shell = paintWith(countershade(olive, cream, 0.05, 0.3), (t, cs, sn, out) => {
    lerpHex(out, '#5f7f6a', smooth(0.6, 1, sn) * 0.25 * smooth(0, 0.7, Math.abs(cs)))
    lerpHex(out, '#5c8fb3', (smooth(0.8, 1, Math.abs(t - 0.5) * 2)) * 0.55)
  })
  b.limb([[0, 0.55, -1.2], [0, 0.6, -0.6], [0, 0.62, 0], [0, 0.6, 0.6], [0, 0.55, 1.2]], [[0.3, 0.16], [0.78, 0.3], [0.9, 0.36], [0.78, 0.3], [0.3, 0.16]], {}, { paint: shell, radial: 28, seg: 8, cap: 6, ref: [0, 1, 0] })
  for (const k of mirrorZ) {
    // lateral points, the sharp tips that give the blue crab its wide shoulders
    b.limb([[0.0, 0.58, k * 1.3], [0.0, 0.6, k * 1.75], [0.0, 0.62, k * 2.25]], [[0.2, 0.08], [0.1, 0.05], [0.012, 0.012]], { c: '#5d93bb' }, { radial: 10, seg: 6, cap: 2 })
    // eyes on short stalks at the front edge, between the claws
    b.limb([[0.78, 0.7, k * 0.3], [0.86, 0.88, k * 0.33]], 0.034, { c: '#dfe6e0' }, { radial: 8, seg: 3, cap: 2 })
    eye(b, [0.89, 0.93, k * 0.34], 0.07, [0.6, 0.3, k * 0.3], '#24303a')
    // arm swings out and forward, the claw is held out in front of the body
    b.limb([[0.55, 0.5, k * 0.6], [0.9, 0.62, k * 1.1], [1.35, 0.7, k * 1.05]], [[0.15, 0.13], [0.14, 0.12], [0.15, 0.13]], { c: blue }, { radial: 12, seg: 6, cap: 4 })
    b.ell([1.75, 0.76, k * 0.92], [0.4, 0.22, 0.24], blue, [0, k * 0.28, 0], 16, 10)
    const fingerPaint = (hi: number): Paint => (t, _cs, _sn, out) => {
      out.set(blue)
      lerpHex(out, tip, smooth(0.42, 0.62, t))
      lerpHex(out, '#f4c9a0', smooth(0.88, 1, t) * hi)
    }
    // fixed finger (upper) and moving finger (lower) with a small gap between them, tips curving inward
    b.limb([[2.0, 0.9, k * 0.84], [2.42, 0.98, k * 0.64], [2.72, 0.9, k * 0.4]], [[0.1, 0.075], [0.075, 0.06], [0.014, 0.014]], {}, { radial: 10, seg: 6, cap: 3, paint: fingerPaint(0.5) })
    b.limb([[2.0, 0.62, k * 0.94], [2.45, 0.66, k * 0.78], [2.76, 0.74, k * 0.48]], [[0.1, 0.07], [0.075, 0.055], [0.014, 0.014]], {}, { radial: 10, seg: 6, cap: 3, paint: fingerPaint(0.5) })
    // three pairs of walking legs, splayed out and forward, with bent knees held above the shell
    const reach: [number, number][] = [[0.38, 0.45], [0.0, 0.1], [-0.38, -0.3]]
    reach.forEach(([x, dx], i) => {
      const edge = 1.3 * Math.sqrt(Math.max(0.1, 1 - (x / 0.9) ** 2))
      b.limb([[x, 0.46, k * edge * 0.72], [x + dx * 0.25, 0.9, k * (edge + 0.5)], [x + dx * 0.65, 0.62, k * (edge + 0.85)], [x + dx, 0.03, k * (edge + 1.2)]], [0.11, 0.085, 0.06, 0.028], { c: i % 2 ? leg : '#5a92bd' }, { radial: 8, seg: 6, cap: 3 })
    })
    // flattened rear swimming paddle, broad and thin, pointing back and out
    b.limb([[-0.68, 0.44, k * 0.85], [-0.95, 0.4, k * 1.5], [-1.2, 0.34, k * 2.0], [-1.35, 0.3, k * 2.45]], [[0.08, 0.07], [0.15, 0.05], [0.27, 0.04], [0.16, 0.03]], { c: '#6aa2c9' }, { radial: 12, seg: 6, cap: 3 })
  }
}

function gatorModel(b: Builder): void {
  const back = '#4a6a37'
  const belly = '#d8d4a2'
  const ridge = '#27381f'
  // One continuous spine: tail tip, curled tail, body, head and snout.
  const spine: V3[] = [
    [-3.0, 0.15, 2.95], [-3.4, 0.22, 2.3], [-3.45, 0.32, 1.55], [-3.1, 0.44, 0.95], [-2.4, 0.56, 0.5], [-1.5, 0.68, 0.18], [-0.5, 0.78, 0.02], [0.6, 0.82, 0],
    [1.5, 0.8, 0], [2.2, 0.74, 0], [2.9, 0.7, 0], [3.5, 0.68, 0],
  ]
  const radii: [number, number][] = [[0.03, 0.03], [0.12, 0.15], [0.22, 0.28], [0.36, 0.4], [0.55, 0.52], [0.76, 0.62], [0.9, 0.68], [0.9, 0.68], [0.7, 0.5], [0.5, 0.34], [0.38, 0.24], [0.38, 0.22]]
  const paint = paintWith(countershade(back, belly, -0.1, 0.35), (t, _cs, sn, out) => {
    // dark bands across the tail and back
    const band = smooth(0.0, 0.3, 0.5 - Math.abs(((t * 22) % 1) - 0.5)) * smooth(0.0, 0.4, sn) * (1 - smooth(0.2, 0.55, t))
    lerpHex(out, '#2d4425', band * 0.7)
    if (t > 0.85) lerpHex(out, belly, smooth(0.0, 0.3, 0.3 - sn) * 0.6)
  })
  b.limb(spine, radii, {}, { paint, radial: 22, seg: 7, cap: 6 })
  // double row of scutes along the back
  for (let i = 0; i < 18; i++) {
    const t = 0.28 + i * 0.03
    const { p } = spineAt(spine, Math.min(t, 0.72))
    const hb = i < 11 ? 0.55 - i * 0.025 : 0.34
    for (const k of mirrorZ) b.ell([p[0], p[1] + radiusAtT(i), p[2] + k * 0.17 * hb * 1.6], [0.1, 0.075, 0.07], ridge, [0, 0, 0], 8, 6)
  }
  for (const k of mirrorZ) {
    // bulging eyes with slit pupils, nostril bumps, pale cheek line
    eye(b, [2.0, 1.28, k * 0.34], 0.15, [0.3, 0.5, k * 0.8], '#d9c345', true)
    b.ell([3.55, 0.88, k * 0.1], [0.07, 0.05, 0.06], '#1f2b19', [0, 0, 0], 8, 6)
    // splayed legs with webbed toes
    for (const x of [1.0, -1.05]) {
      b.limb([[x, 0.6, k * 0.6], [x + 0.1, 0.36, k * 1.05], [x + 0.18, 0.12, k * 1.3]], [0.3, 0.21, 0.15], { c: back }, { radial: 12, seg: 6, cap: 4 })
      for (let i = -1; i <= 1; i++) b.ell([x + 0.44, 0.06, k * (1.32 + i * 0.14)], [0.22, 0.055, 0.055], '#33482b', [0, i * k * 0.3, 0], 8, 6)
    }
  }
}
const radiusAtT = (i: number): number => 0.5 - Math.min(i, 11) * 0.02

function buildSpecimen(id: string): THREE.BufferGeometry {
  const b = new Builder()
  switch (id) {
    case 'manatee': {
      const skin = countershade('#7b8998', '#b5bfc9', -0.05, 0.55)
      b.limb([[-1.7, 0.12, 0], [-1.0, 0.05, 0], [-0.1, 0, 0], [0.8, -0.02, 0], [1.45, -0.08, 0], [1.85, -0.2, 0]], [[0.18, 0.16], [0.42, 0.4], [0.68, 0.62], [0.7, 0.62], [0.52, 0.48], [0.36, 0.33]], {}, { paint: skin, radial: 24, seg: 8, cap: 6 })
      // paddle tail
      b.limb([[-1.75, 0.1, 0], [-2.1, 0.17, 0], [-2.42, 0.28, 0]], [[0.2, 0.18], [0.7, 0.09], [0.98, 0.05]], { c: '#74828f' }, { radial: 24, seg: 8, cap: 6 })
      // muzzle pad, nostrils, whisker pad
      b.ell([2.0, -0.32, 0], [0.3, 0.22, 0.38], '#b4bec8', [0, 0, 0.2], 16, 12)
        .ell([2.1, -0.42, 0], [0.2, 0.08, 0.3], '#c7ced4', [0, 0, 0.1], 12, 8)
      for (const k of mirrorZ) {
        b.ell([2.12, -0.06, k * 0.14], [0.07, 0.04, 0.05], '#252c33', [0, 0, 0], 8, 6)
        eye(b, [1.62, 0.1, k * 0.42], 0.075, [0.3, 0.2, k], '#d6d2c6')
        // flipper
        b.limb([[0.9, -0.3, k * 0.45], [1.3, -0.5, k * 0.98], [1.62, -0.72, k * 1.4]], [[0.18, 0.09], [0.24, 0.07], [0.15, 0.045]], { c: '#74828f' }, { radial: 12, seg: 6, cap: 5 })
      }
      break
    }
    case 'brown-pelican': {
      const brown = '#7d6a58'
      const neck = paintWith(countershade('#d9ccaa', '#d9ccaa'), (t, _c, _s, out) => {
        lerpHex(out, '#5a4636', 1 - smooth(0.2, 0.7, t))
        lerpHex(out, '#f4ecc4', smooth(0.7, 1, t) * 0.8)
      })
      b.limb([[-1.0, 1.05, 0], [-0.2, 1.2, 0], [0.5, 1.28, 0]], [[0.34, 0.34], [0.74, 0.64], [0.54, 0.52]], {}, { paint: countershade('#8a7662', '#b0a28d', 0, 0.5), radial: 22, seg: 8, cap: 6 })
      b.limb([[0.5, 1.4, 0], [0.82, 1.8, 0], [0.7, 2.25, 0], [0.98, 2.6, 0], [1.1, 2.75, 0]], [0.3, 0.17, 0.12, 0.14, 0.2], {}, { paint: neck, radial: 16, seg: 8, cap: 5 })
      // bill: long upper bill with hook and a deep pouch underneath
      b.limb([[1.15, 2.7, 0], [1.8, 2.55, 0], [2.4, 2.32, 0]], [[0.1, 0.08], [0.085, 0.065], [0.04, 0.03]], { c: '#c9a46a' }, { radial: 12, seg: 7, cap: 5 })
      // The pouch is the pelican's signature: a deep, soft bag slung under the bill that runs back down the throat.
      const pouch = paintWith(countershade('#c9a27a', '#e0bf99', 0, 0.5), (t, _c, _s, out) => lerpHex(out, '#9d7b5a', smooth(0.75, 1, t) * 0.6))
      b.limb([[1.25, 2.6, 0], [1.75, 2.34, 0], [2.3, 2.27, 0]], [[0.12, 0.1], [0.19, 0.27], [0.05, 0.05]], {}, { radial: 16, seg: 8, cap: 5, paint: pouch })
      b.limb([[1.28, 2.55, 0], [1.1, 2.42, 0], [0.9, 2.3, 0]], [[0.1, 0.09], [0.1, 0.08], [0.06, 0.05]], {}, { radial: 12, seg: 6, cap: 3, paint: pouch })
      // hooked tip of the upper bill
      b.limb([[2.36, 2.33, 0], [2.46, 2.27, 0], [2.48, 2.2, 0]], [0.035, 0.03, 0.012], { c: '#b88f58' }, { radial: 8, seg: 4, cap: 3 })
      for (const k of mirrorZ) {
        eye(b, [1.2, 2.82, k * 0.15], 0.075, [0.4, 0.2, k], '#f0e9c8')
        // folded wing, scapular edge
        // folded wing: a deep shoulder tapering to long dark primaries that cross over the tail
        const wing = paintWith(countershade(brown, '#a99887', 0, 0.6), (t, _c, _s, out) => {
          lerpHex(out, '#d8cfbd', (1 - smooth(0.0, 0.3, t)) * 0.45)
          lerpHex(out, '#43362b', smooth(0.55, 0.85, t) * 0.85)
        })
        b.limb([[0.4, 1.42, k * 0.6], [-0.25, 1.32, k * 0.68], [-1.0, 1.08, k * 0.58], [-1.7, 0.78, k * 0.4], [-2.1, 0.62, k * 0.3]], [[0.1, 0.22], [0.14, 0.42], [0.1, 0.32], [0.05, 0.14], [0.02, 0.04]], {}, { radial: 14, seg: 6, cap: 4, paint: wing })
        // legs and webbed feet
        b.limb([[0.12, 0.8, k * 0.25], [0.12, 0.4, k * 0.25], [0.14, 0.06, k * 0.25]], [0.1, 0.075, 0.06], { c: '#4a4339' }, { radial: 8, seg: 4, cap: 3 })
        b.ell([0.35, 0.04, k * 0.25], [0.34, 0.04, 0.2], '#5b5246', [0, k * 0.15, 0], 12, 6)
      }
      fin(b, [[-0.9, 1.0, 0], [-1.5, 0.75, 0], [-1.9, 0.55, 0]], [0.28, 0.24, 0.04], 0.05, '#5e5145', 'xz')
      break
    }
    case 'gopher-tortoise': {
      const [rx, ry, rz, y0] = [1.4, 0.8, 1.05, 0.4]
      scuteShell(b, [0, y0, 0], [rx, ry, rz])
      b.ell([0, y0 - 0.02, 0], [rx * 1.03, 0.11, rz * 1.03], '#cdb98a', [0, 0, 0], 32, 8)
      b.ell([0, y0 - 0.12, 0], [rx * 0.92, 0.16, rz * 0.9], '#a58f5e', [0, 0, 0], 24, 8)
      b.limb([[0.95, 0.4, 0], [1.4, 0.46, 0], [1.78, 0.44, 0]], [[0.32, 0.26], [0.22, 0.19], [0.2, 0.16]], { c: '#c1ad7f' }, { radial: 14, seg: 6, cap: 5 })
      b.limb([[-1.2, 0.3, 0], [-1.6, 0.26, 0], [-1.85, 0.22, 0]], [0.16, 0.1, 0.03], { c: '#7a6844' }, { radial: 8, seg: 4, cap: 3 })
      for (const k of mirrorZ) {
        eye(b, [1.74, 0.54, k * 0.15], 0.055, [0.3, 0.3, k], '#3b3426')
        for (const x of [0.85, -0.85]) {
          b.limb([[x, 0.5, k * 0.75], [x + 0.04, 0.3, k * 0.88], [x + 0.08, 0.1, k * 0.9]], [0.28, 0.25, 0.22], { c: '#b5a173' }, { radial: 12, seg: 5, cap: 4 })
          paw(b, [x + 0.12, 0, k * 0.9], 0.21, '#8f7b52')
        }
      }
      break
    }
    case 'green-tree-frog': {
      const skin = paintWith(countershade('#58b745', '#eaf3c4', -0.15, 0.4), (t, cs, sn, out) => {
        // pale lateral stripe that runs from jaw to hip
        const st = smooth(0.1, 0.3, t) * (1 - smooth(0.8, 0.95, t)) * (1 - smooth(0.0, 0.12, Math.abs(sn - 0.0))) * smooth(0.5, 0.8, Math.abs(cs))
        lerpHex(out, '#f6f2b4', st * 0.9)
      })
      b.limb([[-0.95, 0.65, 0], [-0.2, 0.7, 0], [0.55, 0.78, 0], [1.1, 0.78, 0]], [[0.5, 0.42], [0.72, 0.6], [0.66, 0.5], [0.45, 0.34]], {}, { paint: skin, radial: 24, seg: 8, cap: 6 })
      // eyes on top of the head with a glint
      for (const k of mirrorZ) {
        b.ell([0.9, 1.08, k * 0.34], [0.22, 0.2, 0.22], '#4cab3c', [0, 0, 0], 14, 10)
        eye(b, [0.95, 1.14, k * 0.4], 0.17, [0.5, 0.5, k * 0.9], '#e8d56a', false)
        // hind leg, folded: thigh, knee, shin, foot, toe pads
        b.limb([[-0.6, 0.7, k * 0.5], [0.12, 0.9, k * 1.0], [-0.45, 0.32, k * 1.12], [0.45, 0.09, k * 1.2]], [0.3, 0.19, 0.12, 0.075], { c: '#5cb946' }, { radial: 14, seg: 7, cap: 4 })
        for (let i = -1; i <= 1; i++) b.ell([0.65, 0.09, k * (1.2 + i * 0.13)], [0.08, 0.05, 0.08], '#9fdc78', [0, 0, 0], 10, 8)
        // front leg
        b.limb([[0.55, 0.5, k * 0.5], [0.72, 0.28, k * 0.68], [0.78, 0.07, k * 0.74]], [0.13, 0.09, 0.07], { c: '#62bf4b' }, { radial: 10, seg: 5, cap: 4 })
        for (let i = -1; i <= 1; i++) b.ell([0.9, 0.07, k * (0.74 + i * 0.1)], [0.07, 0.045, 0.07], '#9fdc78', [0, 0, 0], 8, 6)
      }
      b.limb([[1.45, 0.62, 0.0], [1.15, 0.7, 0.28], [0.7, 0.72, 0.4]], 0.014, { c: '#2d6a2a' }, { radial: 6, seg: 5, cap: 2 })
      b.limb([[1.45, 0.62, 0.0], [1.15, 0.7, -0.28], [0.7, 0.72, -0.4]], 0.014, { c: '#2d6a2a' }, { radial: 6, seg: 5, cap: 2 })
      break
    }
    case 'bull-shark':
      sharkModel(b)
      break
    case 'largemouth-bass':
      bassModel(b)
      break
    case 'blue-crab':
      crabModel(b)
      break
    case 'florida-panther':
      pantherModel(b)
      break
    case 'barred-owl': {
      const feather = paintWith(countershade('#6f5b45', '#d9ccb0', -0.1, 0.5), (t, cs, _sn, out) => {
        // pale bars across the chest, spots on the back
        const front = smooth(0.0, 0.5, -cs)
        const bar = smooth(0.0, 0.3, 0.5 - Math.abs(((t * 11) % 1) - 0.5)) * front
        lerpHex(out, '#e6dcc2', 0)
        lerpHex(out, '#5b4a37', bar * 0.5 * smooth(0.2, 0.9, t))
      })
      b.limb([[0, 0.35, 0], [0, 1.15, 0], [0.03, 1.95, 0]], [[0.3, 0.3], [0.6, 0.7], [0.5, 0.6]], {}, { paint: feather, radial: 24, seg: 10, cap: 6 })
      // head, facial discs, beak, eyes
      b.ell([0.06, 2.22, 0], [0.5, 0.45, 0.58], '#85705a', [0, 0, 0], 24, 16)
      for (const k of mirrorZ) {
        b.ell([0.4, 2.24, k * 0.26], [0.13, 0.34, 0.3], '#d8cbb0', [0, k * 0.1, 0], 18, 12)
        eye(b, [0.5, 2.28, k * 0.25], 0.105, [0.7, 0.1, k * 0.5], '#2a2018')
        // folded wing and a pale scapular edge
        b.limb([[0.0, 1.75, k * 0.6], [-0.15, 1.15, k * 0.68], [-0.3, 0.6, k * 0.55], [-0.5, 0.2, k * 0.4]], [[0.4, 0.1], [0.42, 0.11], [0.28, 0.08], [0.06, 0.03]], { c: '#6a5842' }, { radial: 12, seg: 6, cap: 5 })
        b.limb([[0.15, 0.4, k * 0.22], [0.16, 0.18, k * 0.22]], 0.07, { c: '#d8b44a' }, { radial: 8, seg: 3, cap: 3 })
        b.ell([0.3, 0.06, k * 0.22], [0.22, 0.05, 0.12], '#d8b44a', [0, 0, 0], 10, 6)
      }
      b.limb([[0.6, 2.18, 0], [0.74, 2.12, 0], [0.8, 2.02, 0]], [0.075, 0.06, 0.02], { c: '#e2b84c' }, { radial: 10, seg: 4, cap: 4 })
      fin(b, [[-0.35, 0.7, 0], [-0.55, 0.35, 0], [-0.75, 0.05, 0]], [0.32, 0.27, 0.06], 0.06, '#5f4e3a', 'xy')
      break
    }
    case 'american-alligator':
      gatorModel(b)
      break
    case 'grasshopper': {
      const green = paintWith(countershade('#8cc03a', '#d5e48a', -0.1, 0.5), (_t, _cs, sn, out) => lerpHex(out, '#e7e07a', smooth(0, 0.15, 0.1 - Math.abs(sn - 0.4)) * 0.8))
      b.limb([[-1.3, 0.78, 0], [-0.5, 0.8, 0], [0.3, 0.8, 0], [0.7, 0.82, 0]], [[0.06, 0.06], [0.16, 0.18], [0.18, 0.2], [0.14, 0.15]], {}, { paint: green, radial: 14, seg: 8, cap: 5 })
      b.ell([1.0, 0.83, 0], [0.26, 0.28, 0.22], '#86b838', [0, 0, 0], 16, 12)
      b.ell([0.95, 0.66, 0], [0.18, 0.1, 0.14], '#c6d86e', [0, 0, 0], 10, 8)
      for (const k of mirrorZ) {
        eye(b, [1.05, 0.95, k * 0.15], 0.1, [0.4, 0.3, k], '#e6d46e')
        b.limb([[1.15, 1.05, k * 0.06], [1.5, 1.5, k * 0.25], [1.9, 1.75, k * 0.4]], [0.025, 0.02, 0.012], { c: '#3a4a20' }, { radial: 6, seg: 5, cap: 2 })
        fin(b, [[0.4, 1.0, k * 0.1], [-0.4, 1.02, k * 0.18], [-1.1, 0.92, k * 0.2], [-1.5, 0.82, k * 0.18]], [0.1, 0.13, 0.1, 0.02], 0.015, '#b3d56a', 'xz')
        // big jumping hind leg: heavy femur, thin tibia, foot
        b.limb([[-0.15, 0.7, k * 0.2], [-0.6, 1.2, k * 0.34], [-1.3, 0.6, k * 0.36]], [0.1, 0.11, 0.045], { c: '#7da82e' }, { radial: 10, seg: 6, cap: 4 })
        b.limb([[-1.3, 0.6, k * 0.36], [-1.55, 0.25, k * 0.38], [-1.45, 0.05, k * 0.38]], [0.04, 0.03, 0.03], { c: '#587a22' }, { radial: 8, seg: 4, cap: 3 })
        b.limb([[0.5, 0.65, k * 0.15], [0.75, 0.38, k * 0.4], [0.9, 0.04, k * 0.46]], [0.05, 0.035, 0.03], { c: '#7da82e' }, { radial: 8, seg: 5, cap: 3 })
        b.limb([[0.2, 0.65, k * 0.15], [0.3, 0.32, k * 0.42], [0.18, 0.04, k * 0.5]], [0.05, 0.035, 0.03], { c: '#7da82e' }, { radial: 8, seg: 5, cap: 3 })
      }
      break
    }
    case 'garden-spider': {
      const yel = '#e8bc2c'
      const blk = '#241c12'
      const abdomen = paintWith(countershade(yel, '#c89a22', 0, 0.5), (t, cs, sn, out) => {
        const band = smooth(0.0, 0.18, 0.5 - Math.abs(((t * 5) % 1) - 0.5) * 1.0 - 0.18) * smooth(-0.1, 0.35, sn)
        lerpHex(out, blk, band * 0.9)
        lerpHex(out, '#f4e9b0', smooth(0.2, 0.5, 0.2 - Math.abs(cs)) * smooth(0.5, 0.9, sn) * 0.6)
      })
      b.limb([[-1.75, 0.95, 0], [-1.05, 1.0, 0], [-0.4, 0.98, 0], [0.1, 0.9, 0]], [0.1, 0.62, 0.6, 0.2], {}, { paint: abdomen, radial: 22, seg: 8, cap: 6 })
      b.ell([0.5, 0.82, 0], [0.46, 0.3, 0.36], '#c3b697', [0, 0, 0], 18, 12)
      b.limb([[0.1, 0.9, 0], [0.2, 0.85, 0]], 0.13, { c: blk }, { radial: 10, seg: 3, cap: 4 })
      for (const k of mirrorZ) {
        eye(b, [0.78, 0.98, k * 0.1], 0.05, [0.7, 0.3, k * 0.5], '#101010')
        eye(b, [0.7, 1.06, k * 0.2], 0.045, [0.5, 0.5, k * 0.8], '#101010')
        b.limb([[0.88, 0.74, k * 0.08], [0.95, 0.62, k * 0.08]], [0.045, 0.02], { c: '#3b2c1c' }, { radial: 8, seg: 3, cap: 3 })
        // eight legs: gold femur, banded shins, dark tips
        for (let i = 0; i < 4; i++) {
          const x = 0.62 - i * 0.18
          const sp = (1.5 - i) * 0.55
          const knee: V3 = [x + sp * 0.5, 1.32, k * (0.95 + (i === 1 || i === 2 ? 0.1 : 0))]
          const tip: V3 = [x + sp * 1.7 + (i < 2 ? 0.3 : -0.2), 0.04, k * (1.75 + (i === 1 || i === 2 ? 0.2 : 0))]
          const mid: V3 = [(knee[0] + tip[0]) / 2, (knee[1] + tip[1]) / 2 + 0.05, (knee[2] + tip[2]) / 2]
          const leg = paintWith(countershade(yel, yel), (t, _c, _s, out) => {
            const band = smooth(0, 0.12, 0.5 - Math.abs(((t * 4.5) % 1) - 0.5) - 0.12) * smooth(0.22, 0.4, t)
            lerpHex(out, blk, band)
            lerpHex(out, '#5a4222', smooth(0.88, 1, t))
          })
          b.limb([[x, 0.82, k * 0.22], knee, mid, tip], [0.1, 0.085, 0.06, 0.03], {}, { paint: leg, radial: 8, seg: 6, cap: 3 })
          b.ell(knee, [0.105, 0.105, 0.105], blk, [0, 0, 0], 10, 8)
        }
      }
      break
    }
    default:
      b.sphere(0.8, { c: '#7fa9c0' })
  }
  const geo = b.build()
  // The crab faces mostly toward the camera in the resting view, so its wide shell and forward claws show.
  if (id === 'blue-crab') geo.rotateY(-Math.PI / 2 + 0.42)
  return geo
}

const specimenCache = new Map<string, SpecimenGeo>()

/** Grounded, centered geometry for a specimen id (facing +x). */
export function specimenGeo(id: string): SpecimenGeo {
  let s = specimenCache.get(id)
  if (!s) {
    const geo = buildSpecimen(id)
    s = { geo, size: groundCenter(geo) }
    specimenCache.set(id, s)
  }
  return s
}

export const LAB_SPECIMENS = ['manatee', 'brown-pelican', 'gopher-tortoise', 'green-tree-frog', 'bull-shark', 'blue-crab'] as const
