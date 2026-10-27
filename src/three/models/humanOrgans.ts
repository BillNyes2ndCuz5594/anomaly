import * as THREE from 'three/webgpu'
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'
import { Builder, getBuilderLod, type Paint, type V3 } from './builder'

/** Smooth 3D value noise in 0..1. */
export function noise3(x: number, y: number, z: number): number {
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

export const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** One ellipsoidal lobe of an organ. `shape` may bend the unit sphere direction in place (taper a tip, flatten a base, dent a notch). */
export interface Lobe {
  c: V3
  r: V3
  rot?: V3
  /** Brightness multiplier. */
  shade?: number
  /** Per channel multiplier, to nudge the hue of a sub part (a gallbladder, say). */
  rgb?: V3
  shape?: (u: THREE.Vector3) => void
}

/**
 * Overlapping lobes merged into one organ. Where two lobes meet the surface is darkened, so the seam reads as a
 * fissure or a groove (lung lobes, liver lobes, the two sides of the heart) without any extra geometry or draw call.
 */
export function lobed(lobes: Lobe[], crease = 0.3, mottle = 0.07): THREE.BufferGeometry {
  const lod = Math.min(1, getBuilderLod())
  const W = Math.max(14, Math.round(40 * lod))
  const H = Math.max(10, Math.round(28 * lod))
  const mats = lobes.map((l) => {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(...l.c), new THREE.Quaternion().setFromEuler(new THREE.Euler(...(l.rot ?? [0, 0, 0]))), new THREE.Vector3(...l.r))
    return { m, inv: m.clone().invert() }
  })
  const out = new Builder()
  const p = new THREE.Vector3()
  const q = new THREE.Vector3()
  lobes.forEach((lobe, i) => {
    let g: THREE.BufferGeometry = new THREE.SphereGeometry(1, W, H)
    g.deleteAttribute('normal')
    g.deleteAttribute('uv')
    g = mergeVertices(g, 1e-4)
    const pos = g.getAttribute('position') as THREE.BufferAttribute
    const col = new Float32Array(pos.count * 3)
    for (let v = 0; v < pos.count; v++) {
      p.fromBufferAttribute(pos, v)
      lobe.shape?.(p)
      p.applyMatrix4(mats[i].m)
      pos.setXYZ(v, p.x, p.y, p.z)
      let tone = lobe.shade ?? 1
      for (let j = 0; j < lobes.length; j++) {
        if (j === i) continue
        q.copy(p).applyMatrix4(mats[j].inv)
        const d = q.length()
        tone *= 0.42 + 0.58 * smoothstep(1.0, 1 + crease, d)
      }
      tone *= 1 - mottle + mottle * 2 * noise3(p.x * 14, p.y * 14, p.z * 14)
      const k = lobe.rgb ?? [1, 1, 1]
      col[v * 3] = Math.min(1.2, tone * k[0])
      col[v * 3 + 1] = Math.min(1.2, tone * k[1])
      col[v * 3 + 2] = Math.min(1.2, tone * k[2])
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2))
    g.computeVertexNormals()
    out.geo(g)
  })
  return out.build()
}

/** Shading along a tube: alternating bands (rings of cartilage, haustra, the folds of a small bowel). */
const bands = (n: number, lo: number, phase = 0): Paint => (t, _cs, sn, out) => {
  const w = 0.5 + 0.5 * Math.cos(t * n * Math.PI * 2 + phase)
  const k = lo + (1 - lo) * w
  const top = 0.92 + 0.08 * sn
  out.setRGB(k * top, k * top, k * top)
}

const flat = (k: number): Paint => (_t, _cs, sn, out) => {
  const v = k * (0.9 + 0.1 * sn)
  out.setRGB(v, v, v)
}

/** Resamples a spine into evenly spaced points, so radius bumps along it are evenly spaced too. */
function resample(points: V3[], n: number): V3[] {
  const c = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)))
  return c.getSpacedPoints(n).map((v) => [v.x, v.y, v.z] as V3)
}

const wob = (i: number, s: number) => Math.sin(i * 12.9898 + s * 78.233) * 43758.5453 % 1

/** Organs rebuilt as readable anatomy. Returns false for ids this file does not handle. */
export function buildAnatomy(id: string, b: Builder): boolean {
  switch (id) {
    case 'heart': {
      // Ventricles with a pointed apex, two atria, and the great vessels leaving the top.
      const apex = (u: THREE.Vector3) => {
        const k = 1 - 0.5 * smoothstep(-0.15, -1, u.y)
        u.x *= k
        u.z *= k
      }
      b.geo(
        lobed(
          [
            { c: [0.08, 4.42, 0.2], r: [0.21, 0.27, 0.17], rot: [0, 0, 0.42], shape: apex, shade: 1 },
            { c: [0.22, 4.37, 0.1], r: [0.21, 0.3, 0.17], rot: [0, 0, 0.42], shape: apex, shade: 0.9 },
            { c: [-0.08, 4.64, 0.16], r: [0.13, 0.12, 0.12], shade: 0.85 },
            { c: [0.24, 4.68, 0.2], r: [0.09, 0.075, 0.08], shade: 0.85 },
          ],
          0.22,
          0.05,
        ),
      )
      // aorta arching over to the left and down behind, pulmonary trunk in front of it, and the upper vena cava
      b.limb([[0.1, 4.62, 0.1], [0.07, 4.86, 0.1], [0.14, 5.04, 0.08], [0.28, 5.04, 0.0], [0.34, 4.86, -0.06]], [0.075, 0.07, 0.066, 0.064, 0.06], {}, { radial: 12, seg: 5, paint: flat(1.1) })
      b.limb([[0.14, 4.6, 0.22], [0.2, 4.78, 0.22], [0.3, 4.9, 0.15]], [0.062, 0.055, 0.05], {}, { radial: 10, seg: 4, paint: flat(0.8) })
      b.limb([[-0.1, 4.66, 0.1], [-0.11, 4.9, 0.08], [-0.1, 5.12, 0.05]], 0.05, {}, { radial: 10, seg: 4, paint: flat(0.8) })
      return true
    }
    case 'lungs': {
      const dome = (u: THREE.Vector3) => {
        const k = 1 - 0.32 * smoothstep(0.2, 1, u.y)
        u.x *= k
        u.z *= k
      }
      const base = (u: THREE.Vector3) => {
        if (u.y < -0.62) u.y = -0.62 - (u.y + 0.62) * 0.25
      }
      const lobes: Lobe[] = []
      // viewer's left is the figure's right: three lobes (upper, middle, lower)
      lobes.push({ c: [-0.4, 4.96, 0.0], r: [0.25, 0.26, 0.2], shape: dome, shade: 1 })
      lobes.push({ c: [-0.43, 4.56, 0.13], r: [0.24, 0.17, 0.17], shade: 0.92 })
      lobes.push({ c: [-0.4, 4.5, -0.07], r: [0.3, 0.34, 0.24], shape: base, shade: 0.97, rot: [0, 0, -0.05] })
      // the figure's left lung has two lobes and is a little smaller, with room for the heart
      lobes.push({ c: [0.4, 4.9, 0.0], r: [0.22, 0.3, 0.19], shape: dome, shade: 1 })
      lobes.push({ c: [0.4, 4.46, -0.05], r: [0.27, 0.32, 0.23], shape: base, shade: 0.95, rot: [0, 0, 0.05] })
      b.geo(lobed(lobes, 0.2, 0.05))
      // windpipe with cartilage rings, splitting into the two main bronchi that enter each lung
      b.limb([[0, 5.56, 0.0], [0, 5.24, 0.0], [0, 4.94, 0.0]], 0.062, {}, { radial: 12, seg: 14, paint: bands(15, 0.62) })
      for (const k of [-1, 1]) b.limb([[0, 4.94, 0], [k * 0.12, 4.86, -0.01], [k * 0.26, 4.72, -0.02]], [0.05, 0.042, 0.032], {}, { radial: 9, seg: 6, paint: bands(4, 0.7) })
      return true
    }
    case 'liver': {
      // big right lobe, smaller left lobe tapering across, and the pear shaped gallbladder under the right lobe
      const under = (u: THREE.Vector3) => {
        if (u.y < -0.5) u.y = -0.5 - (u.y + 0.5) * 0.4
      }
      b.geo(
        lobed(
          [
            { c: [-0.26, 3.82, 0.1], r: [0.36, 0.2, 0.22], rot: [0, 0, 0.1], shape: under, shade: 1 },
            { c: [0.1, 3.86, 0.15], r: [0.26, 0.12, 0.15], rot: [0, 0, -0.22], shade: 0.9 },
          ],
          0.2,
          0.06,
        ),
      )
      b.limb([[-0.16, 3.64, 0.24], [-0.12, 3.55, 0.28], [-0.1, 3.5, 0.29]], [0.036, 0.055, 0.04], { c: '#ffe58a' }, { radial: 10, seg: 4 })
      return true
    }
    case 'stomach': {
      // J shape: rounded fundus on the left, a wide body, the lower curve sweeping back to the narrow outlet (pylorus)
      b.limb([[0.3, 4.03, 0.15], [0.43, 3.85, 0.17], [0.46, 3.6, 0.18], [0.34, 3.4, 0.18], [0.14, 3.36, 0.17], [-0.04, 3.44, 0.15], [-0.14, 3.52, 0.13]], [0.14, 0.22, 0.24, 0.2, 0.14, 0.085, 0.06], {}, { radial: 18, seg: 8, paint: flat(0.95) })
      // food pipe joining at the top, and the short first part of the small bowel leaving the outlet
      b.limb([[0.0, 4.55, 0.02], [0.06, 4.3, 0.06], [0.12, 4.1, 0.12], [0.2, 4.02, 0.15]], 0.05, {}, { radial: 10, seg: 5, paint: bands(6, 0.8) })
      b.limb([[-0.14, 3.52, 0.13], [-0.26, 3.5, 0.1], [-0.34, 3.4, 0.07]], [0.06, 0.05, 0.045], { c: '#e6d2a0' }, { radial: 10, seg: 4 })
      return true
    }
    case 'pancreas': {
      // wider head toward the figure's right, tapering tail reaching left
      b.limb([[-0.36, 3.24, 0.05], [-0.14, 3.3, 0.07], [0.14, 3.36, 0.07], [0.46, 3.44, 0.04]], [[0.14, 0.13], [0.12, 0.1], [0.095, 0.075], [0.06, 0.05]], {}, { radial: 14, seg: 8, paint: bands(8, 0.82, 0.5) })
      return true
    }
    case 'small-intestine': {
      // packed loops: rows that run side by side and double back, each a little different, with fine ring folds
      const pts: V3[] = []
      const rows = 7
      for (let k = 0; k < rows; k++) {
        const y = 3.46 - k * 0.075
        const dir = k % 2 === 0 ? 1 : -1
        const ext = 0.3 + 0.06 * wob(k, 1)
        const z = k % 2 === 0 ? 0.2 : 0.25
        const steps = 5
        for (let s = 0; s <= steps; s++) {
          const f = s / steps
          const x = dir * (-ext + 2 * ext * f)
          pts.push([x, y + 0.028 * Math.sin(f * Math.PI * 3 + k), z + 0.035 * Math.sin(f * Math.PI * 2 + k * 1.7)])
        }
        if (k < rows - 1) pts.push([dir * (ext + 0.07), y - 0.0375, z + 0.02])
      }
      b.limb(pts, 0.047, {}, { radial: 10, seg: 5, paint: bands(60, 0.74) })
      return true
    }
    case 'large-intestine': {
      // ascending (figure's right), transverse across the top, descending (left), then the sigmoid S into the rectum
      const spine = resample(
        [
          [-0.43, 2.94, 0.1], [-0.5, 3.18, 0.1], [-0.52, 3.46, 0.1], [-0.4, 3.62, 0.1], [-0.2, 3.58, 0.12], [0, 3.52, 0.13], [0.2, 3.57, 0.12], [0.4, 3.66, 0.1],
          [0.52, 3.5, 0.1], [0.52, 3.22, 0.1], [0.47, 3.0, 0.1], [0.36, 2.9, 0.12], [0.2, 2.96, 0.12], [0.12, 2.88, 0.1], [0.02, 2.9, 0.1],
        ],
        54,
      )
      const radii = spine.map((_, i) => 0.098 + 0.015 * Math.cos(i * Math.PI) - (i > 44 ? (i - 44) * 0.006 : 0))
      b.limb(spine, radii, {}, { radial: 14, seg: 3, paint: bands(27, 0.7) })
      // blind pouch below the join with the small bowel, and the little appendix
      b.ell([-0.43, 2.9, 0.12], [0.1, 0.08, 0.09], '#fff', [0, 0, 0], 14, 10)
      b.limb([[-0.4, 2.84, 0.15], [-0.32, 2.78, 0.2], [-0.24, 2.8, 0.22]], [0.03, 0.026, 0.02], { c: '#e6d2a0' }, { radial: 8, seg: 4 })
      return true
    }
    case 'kidneys': {
      for (const k of [-1, 1]) {
        const c: V3 = [k * 0.46, 3.7 + (k > 0 ? 0.05 : 0), -0.2]
        const bean = (u: THREE.Vector3) => {
          const medial = -k * u.x
          const notch = smoothstep(0.35, 1, medial) * Math.exp(-((u.y / 0.4) ** 2) - ((u.z / 0.55) ** 2))
          const s = 1 - 0.5 * notch
          u.multiplyScalar(s)
        }
        b.geo(lobed([{ c, r: [0.14, 0.27, 0.13], rot: [0, 0, k * 0.2], shape: bean }], 0.2, 0.04))
        // the tube that drains each kidney down toward the bladder
        b.limb([[c[0] - k * 0.1, c[1] - 0.04, c[2]], [k * 0.3, 3.42, -0.16], [k * 0.2, 3.2, -0.06], [k * 0.06, 3.02, 0.06]], 0.022, {}, { radial: 8, seg: 6 })
      }
      return true
    }
    case 'bladder':
      b.geo(lobed([{ c: [0, 2.98, 0.1], r: [0.15, 0.15, 0.14], shape: (u) => { if (u.y > 0.4) { u.x *= 1 - 0.4 * (u.y - 0.4); u.z *= 1 - 0.4 * (u.y - 0.4) } } }], 0.2, 0.03))
      return true
  }
  return false
}
