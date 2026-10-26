import * as THREE from 'three/webgpu'
import type { V3 } from './builder'

// Implicit sculpting: smooth unions of ellipsoids and tapered capsules, meshed with naive surface nets.
// Used for bodies that must read as one continuous organic form (no visible primitives or seams): the surface is
// a single indexed mesh, normals come from the field gradient, colors from a paint function of position and normal.

export interface Prim {
  /** Bounds of the solid (world). Used to skip the primitive far from a sample. */
  lo: V3
  hi: V3
  /** Blend radius when this primitive joins the shape so far. */
  k: number
  /** Lipschitz factor of `d` (1 for exact, less when space is stretched). */
  lip: number
  d: (x: number, y: number, z: number) => number
}

export function smin(a: number, b: number, k: number): number {
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.min(a, b) - h * h * k * 0.25
}

/** Ellipsoid, radii r. Distance is the usual first order approximation. */
export function ellipsoid(c: V3, r: V3, k = 0.1): Prim {
  const [cx, cy, cz] = c
  const [rx, ry, rz] = r
  const lip = Math.min(1, Math.min(rx, ry, rz) / Math.max(rx, ry, rz) * 1.2)
  return {
    lo: [cx - rx, cy - ry, cz - rz],
    hi: [cx + rx, cy + ry, cz + rz],
    k,
    lip,
    d: (x, y, z) => {
      const px = (x - cx) / rx
      const py = (y - cy) / ry
      const pz = (z - cz) / rz
      const k0 = Math.sqrt(px * px + py * py + pz * pz)
      if (k0 < 1e-6) return -Math.min(rx, ry, rz)
      const k1 = Math.sqrt((px * px) / (rx * rx) + (py * py) / (ry * ry) + (pz * pz) / (rz * rz))
      return (k0 * (k0 - 1)) / k1
    },
  }
}

/** Tapered capsule from a to b with radii ra and rb. `zs` stretches the section across z (below 1 narrows the limb). */
export function cone(a: V3, b: V3, ra: number, rb: number, k = 0.1, zs = 1): Prim {
  const ax = a[0]
  const ay = a[1]
  const az = a[2] / zs
  const bx = b[0] - ax
  const by = b[1] - ay
  const bz = b[2] / zs - az
  const bb = bx * bx + by * by + bz * bz || 1e-9
  const m = Math.max(ra, rb)
  const lip = Math.min(1, zs)
  return {
    lo: [Math.min(a[0], b[0]) - m, Math.min(a[1], b[1]) - m, Math.min(a[2], b[2]) - m * zs],
    hi: [Math.max(a[0], b[0]) + m, Math.max(a[1], b[1]) + m, Math.max(a[2], b[2]) + m * zs],
    k,
    lip,
    d: (x, y, z) => {
      const px = x - ax
      const py = y - ay
      const pz = z / zs - az
      const h = Math.min(1, Math.max(0, (px * bx + py * by + pz * bz) / bb))
      const qx = px - bx * h
      const qy = py - by * h
      const qz = pz - bz * h
      return (Math.sqrt(qx * qx + qy * qy + qz * qz) - (ra + (rb - ra) * h)) * lip
    },
  }
}

/** A smooth limb: capsules along a Catmull-Rom spine with one radius per control point (linear between). */
export function chain(points: V3[], radii: number[], k = 0.1, zs = 1, samples = 6): Prim[] {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)))
  const n = points.length - 1
  const steps = n * samples
  const at = (i: number): { p: V3; r: number } => {
    const t = i / steps
    const q = curve.getPoint(t)
    const u = t * n
    const i0 = Math.min(n - 1, Math.floor(u))
    const f = u - i0
    return { p: [q.x, q.y, q.z], r: radii[i0] + (radii[i0 + 1] - radii[i0]) * f }
  }
  const out: Prim[] = []
  let prev = at(0)
  for (let i = 1; i <= steps; i++) {
    const cur = at(i)
    out.push(cone(prev.p, cur.p, prev.r, cur.r, k, zs))
    prev = cur
  }
  return out
}

export type Sdf = (x: number, y: number, z: number) => number

export interface Field {
  /** The whole shape. */
  f: Sdf
  /** Indices of the primitives whose bounds lie within `radius` of the box [lo, hi]. */
  near: (lo: V3, hi: V3, radius: number) => number[]
  /** The shape made of those primitives only (same order, same blending). */
  sub: (list: number[]) => Sdf
}

export function makeField(prims: Prim[]): Field {
  const n = prims.length
  const b = new Float64Array(n * 8)
  prims.forEach((p, i) => b.set([p.lo[0], p.lo[1], p.lo[2], p.hi[0], p.hi[1], p.hi[2], p.lip, p.k], i * 8))
  const evalList = (list: ArrayLike<number>, x: number, y: number, z: number): number => {
    let m = 1e9
    for (let j = 0; j < list.length; j++) {
      const i = list[j]
      const o = i * 8
      const dx = Math.max(b[o] - x, 0, x - b[o + 3])
      const dy = Math.max(b[o + 1] - y, 0, y - b[o + 4])
      const dz = Math.max(b[o + 2] - z, 0, z - b[o + 5])
      const k = b[o + 7]
      // Beyond the blend radius a primitive cannot change the union, so skip it.
      if (Math.sqrt(dx * dx + dy * dy + dz * dz) * b[o + 6] > m + k) continue
      const d = prims[i].d(x, y, z)
      const h = Math.max(k - Math.abs(m - d), 0) / k
      m = Math.min(m, d) - h * h * k * 0.25
    }
    return m
  }
  const all = Array.from({ length: n }, (_, i) => i)
  return {
    f: (x, y, z) => evalList(all, x, y, z),
    near: (lo, hi, radius) => {
      const out: number[] = []
      for (let i = 0; i < n; i++) {
        const o = i * 8
        const dx = Math.max(b[o] - hi[0], 0, lo[0] - b[o + 3])
        const dy = Math.max(b[o + 1] - hi[1], 0, lo[1] - b[o + 4])
        const dz = Math.max(b[o + 2] - hi[2], 0, lo[2] - b[o + 5])
        if (Math.sqrt(dx * dx + dy * dy + dz * dz) * b[o + 6] <= radius + b[o + 7]) out.push(i)
      }
      return out
    },
    sub: (list) => (x, y, z) => evalList(list, x, y, z),
  }
}

export const makeSdf = (prims: Prim[]): Sdf => makeField(prims).f

export function primBounds(prims: Prim[], margin: number): { lo: V3; hi: V3 } {
  const lo: V3 = [Infinity, Infinity, Infinity]
  const hi: V3 = [-Infinity, -Infinity, -Infinity]
  for (const p of prims) {
    for (let a = 0; a < 3; a++) {
      lo[a] = Math.min(lo[a], p.lo[a])
      hi[a] = Math.max(hi[a], p.hi[a])
    }
  }
  return { lo: [lo[0] - margin, lo[1] - margin, lo[2] - margin], hi: [hi[0] + margin, hi[1] + margin, hi[2] + margin] }
}

export function gradient(f: Sdf, x: number, y: number, z: number, e: number, out: V3 = [0, 0, 0]): V3 {
  out[0] = f(x + e, y, z) - f(x - e, y, z)
  out[1] = f(x, y + e, z) - f(x, y - e, z)
  out[2] = f(x, y, z + e) - f(x, y, z - e)
  const l = Math.sqrt(out[0] * out[0] + out[1] * out[1] + out[2] * out[2]) || 1
  out[0] /= l
  out[1] /= l
  out[2] /= l
  return out
}

export interface Hit {
  p: V3
  n: V3
}

/** Marches a ray into the field and returns the first surface point and its normal, or null. */
export function raycast(f: Sdf, from: V3, dir: V3, maxT = 6): Hit | null {
  const l = Math.hypot(...dir)
  const d: V3 = [dir[0] / l, dir[1] / l, dir[2] / l]
  let t = 0
  for (let i = 0; i < 160 && t < maxT; i++) {
    const x = from[0] + d[0] * t
    const y = from[1] + d[1] * t
    const z = from[2] + d[2] * t
    const v = f(x, y, z)
    if (v < 1e-4) {
      // refine by bisection on the last step
      let lo = Math.max(0, t - Math.max(v, 0.01) - 0.05)
      let hi = t
      for (let j = 0; j < 14; j++) {
        const mid = (lo + hi) / 2
        if (f(from[0] + d[0] * mid, from[1] + d[1] * mid, from[2] + d[2] * mid) < 0) hi = mid
        else lo = mid
      }
      const p: V3 = [from[0] + d[0] * hi, from[1] + d[1] * hi, from[2] + d[2] * hi]
      return { p, n: gradient(f, p[0], p[1], p[2], 0.004) }
    }
    t += Math.max(v * 0.9, 0.0025)
  }
  return null
}

export type SculptPaint = (p: V3, n: V3, out: THREE.Color) => void

/**
 * Naive surface nets over the field inside [lo, hi]. Blocks far from the surface are skipped after one sample, so
 * only the neighborhood of the shape is evaluated at full resolution. Returns an indexed geometry with position,
 * normal, uv (zero, the lit material is triplanar), color and surf attributes, ready for Builder.colored.
 */
export function meshField(field_: Field, lo: V3, hi: V3, cell: number, paint: SculptPaint): THREE.BufferGeometry {
  const f = field_.f
  const nx = Math.ceil((hi[0] - lo[0]) / cell) + 1
  const ny = Math.ceil((hi[1] - lo[1]) / cell) + 1
  const nz = Math.ceil((hi[2] - lo[2]) / cell) + 1
  const field = new Float32Array(nx * ny * nz)
  const sx = 1
  const sy = nx
  const sz = nx * ny
  const B = 4
  const reach = B * cell * 1.9
  for (let bz = 0; bz < nz; bz += B) {
    for (let by = 0; by < ny; by += B) {
      for (let bx = 0; bx < nx; bx += B) {
        const ex = Math.min(nx, bx + B + 1)
        const ey = Math.min(ny, by + B + 1)
        const ez = Math.min(nz, bz + B + 1)
        const cx = lo[0] + (bx + B / 2) * cell
        const cy = lo[1] + (by + B / 2) * cell
        const cz = lo[2] + (bz + B / 2) * cell
        const dc = f(cx, cy, cz)
        if (Math.abs(dc) > reach) {
          for (let z = bz; z < ez; z++) for (let y = by; y < ey; y++) for (let x = bx; x < ex; x++) field[x * sx + y * sy + z * sz] = dc
        } else {
          // only primitives that can reach this block matter near the surface
          const local = field_.sub(field_.near([lo[0] + bx * cell, lo[1] + by * cell, lo[2] + bz * cell], [lo[0] + (bx + B) * cell, lo[1] + (by + B) * cell, lo[2] + (bz + B) * cell], 2.5 * B * cell + 0.05))
          for (let z = bz; z < ez; z++) {
            for (let y = by; y < ey; y++) {
              for (let x = bx; x < ex; x++) field[x * sx + y * sy + z * sz] = local(lo[0] + x * cell, lo[1] + y * cell, lo[2] + z * cell)
            }
          }
        }
      }
    }
  }
  // one vertex per cell that the surface crosses
  const vid = new Int32Array(nx * ny * nz).fill(-1)
  const pos: number[] = []
  const corner = [0, sx, sy, sx + sy, sz, sx + sz, sy + sz, sx + sy + sz]
  const cx = [0, 1, 0, 1, 0, 1, 0, 1]
  const cy = [0, 0, 1, 1, 0, 0, 1, 1]
  const cz = [0, 0, 0, 0, 1, 1, 1, 1]
  const edges = [0, 1, 2, 3, 4, 5, 6, 7, 0, 2, 1, 3, 4, 6, 5, 7, 0, 4, 1, 5, 2, 6, 3, 7]
  for (let z = 0; z < nz - 1; z++) {
    for (let y = 0; y < ny - 1; y++) {
      for (let x = 0; x < nx - 1; x++) {
        const base = x * sx + y * sy + z * sz
        let mask = 0
        for (let c = 0; c < 8; c++) if (field[base + corner[c]] < 0) mask |= 1 << c
        if (mask === 0 || mask === 255) continue
        let ax = 0
        let ay = 0
        let az = 0
        let cnt = 0
        for (let e = 0; e < 24; e += 2) {
          const a = edges[e]
          const b = edges[e + 1]
          if (((mask >> a) & 1) === ((mask >> b) & 1)) continue
          const va = field[base + corner[a]]
          const vb = field[base + corner[b]]
          const t = va / (va - vb)
          ax += cx[a] + (cx[b] - cx[a]) * t
          ay += cy[a] + (cy[b] - cy[a]) * t
          az += cz[a] + (cz[b] - cz[a]) * t
          cnt++
        }
        vid[base] = pos.length / 3
        pos.push(lo[0] + (x + ax / cnt) * cell, lo[1] + (y + ay / cnt) * cell, lo[2] + (z + az / cnt) * cell)
      }
    }
  }
  // quads around every grid edge that changes sign
  const idx: number[] = []
  const strides = [sx, sy, sz]
  for (let z = 1; z < nz - 1; z++) {
    for (let y = 1; y < ny - 1; y++) {
      for (let x = 1; x < nx - 1; x++) {
        const base = x * sx + y * sy + z * sz
        const v0 = field[base]
        for (let a = 0; a < 3; a++) {
          const v1 = field[base + strides[a]]
          if (v0 < 0 === v1 < 0) continue
          const sb = strides[(a + 1) % 3]
          const sc = strides[(a + 2) % 3]
          const q0 = vid[base]
          const q1 = vid[base - sb]
          const q2 = vid[base - sb - sc]
          const q3 = vid[base - sc]
          if (q0 < 0 || q1 < 0 || q2 < 0 || q3 < 0) continue
          if (v0 < 0) idx.push(q0, q1, q2, q0, q2, q3)
          else idx.push(q0, q2, q1, q0, q3, q2)
        }
      }
    }
  }
  const n = pos.length / 3
  const normals = new Float32Array(n * 3)
  const colors = new Float32Array(n * 3)
  const col = new THREE.Color()
  // Normals from the field gradient: central differences at the grid points, blended trilinearly.
  const gx = (i: number) => field[i + sx] - field[i - sx]
  const gy = (i: number) => field[i + sy] - field[i - sy]
  const gz = (i: number) => field[i + sz] - field[i - sz]
  for (let i = 0; i < n; i++) {
    const x = pos[i * 3]
    const y = pos[i * 3 + 1]
    const z = pos[i * 3 + 2]
    const ux = Math.min(nx - 3, Math.max(1, Math.floor((x - lo[0]) / cell)))
    const uy = Math.min(ny - 3, Math.max(1, Math.floor((y - lo[1]) / cell)))
    const uz = Math.min(nz - 3, Math.max(1, Math.floor((z - lo[2]) / cell)))
    const fx = Math.min(1, Math.max(0, (x - lo[0]) / cell - ux))
    const fy = Math.min(1, Math.max(0, (y - lo[1]) / cell - uy))
    const fz = Math.min(1, Math.max(0, (z - lo[2]) / cell - uz))
    let g0 = 0
    let g1 = 0
    let g2 = 0
    for (let c = 0; c < 8; c++) {
      const w = (cx[c] ? fx : 1 - fx) * (cy[c] ? fy : 1 - fy) * (cz[c] ? fz : 1 - fz)
      const at = (ux + cx[c]) * sx + (uy + cy[c]) * sy + (uz + cz[c]) * sz
      g0 += gx(at) * w
      g1 += gy(at) * w
      g2 += gz(at) * w
    }
    const l = Math.sqrt(g0 * g0 + g1 * g1 + g2 * g2) || 1
    g0 /= l
    g1 /= l
    g2 /= l
    normals[i * 3] = g0
    normals[i * 3 + 1] = g1
    normals[i * 3 + 2] = g2
    col.set('#ffffff')
    paint([x, y, z], [g0, g1, g2], col)
    colors[i * 3] = col.r
    colors[i * 3 + 1] = col.g
    colors[i * 3 + 2] = col.b
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2))
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.setIndex(idx)
  orientOutward(geo)
  return geo
}

/** Flips the winding when the first triangles face against the field gradient (the sign convention of the quads). */
function orientOutward(geo: THREE.BufferGeometry): void {
  const p = geo.getAttribute('position') as THREE.BufferAttribute
  const nrm = geo.getAttribute('normal') as THREE.BufferAttribute
  const ix = geo.getIndex()!
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  let vote = 0
  const tris = ix.count / 3
  for (let t = 0; t < tris; t += Math.max(1, Math.floor(tris / 200))) {
    const i0 = ix.getX(t * 3)
    const i1 = ix.getX(t * 3 + 1)
    const i2 = ix.getX(t * 3 + 2)
    a.fromBufferAttribute(p, i0)
    b.fromBufferAttribute(p, i1).sub(a)
    c.fromBufferAttribute(p, i2).sub(a)
    b.cross(c)
    vote += b.x * nrm.getX(i0) + b.y * nrm.getY(i0) + b.z * nrm.getZ(i0) > 0 ? 1 : -1
  }
  if (vote < 0) {
    const arr = ix.array as Uint32Array | Uint16Array
    for (let t = 0; t < arr.length; t += 3) {
      const s = arr[t + 1]
      arr[t + 1] = arr[t + 2]
      arr[t + 2] = s
    }
  }
}
