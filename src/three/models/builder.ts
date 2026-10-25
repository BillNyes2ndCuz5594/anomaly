import * as THREE from 'three/webgpu'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

export type V3 = [number, number, number]

export interface PartOpts {
  /** Position. */
  p?: V3
  /** Euler rotation in radians. */
  r?: V3
  /** Scale, applied before rotation. */
  s?: V3
  /** Vertex color, any CSS color. Used by lit materials, ignored by holograms. */
  c?: string
}

const tmpColor = new THREE.Color()
const tint = new THREE.Color()

/** Colors one limb vertex. t along the limb 0..1, cs and sn the section direction. Write the result into `out`. */
export type Paint = (t: number, cs: number, sn: number, out: THREE.Color, scratch: THREE.Color) => void

/** One radius for the whole limb, or one per spine point (number, or [width, height] for an elliptical section). */
export type Radii = number | (number | [number, number])[]

export interface LimbOpts {
  /** Rows per span between spine points. */
  seg?: number
  /** Vertices around the section. */
  radial?: number
  /** Rounded cap rows at each end (0 for none). */
  cap?: number
  paint?: Paint
  /** Reference axis that sets the section orientation. Default is up, or Z for vertical spines. Use [0,0,1] for fins that lie in the XY plane. */
  ref?: V3
}
const UP = new THREE.Vector3(0, 1, 0)

/**
 * Tiny procedural modeling kit: add primitives, get one merged BufferGeometry.
 * Everything is converted to non-indexed with position, normal, uv and color so parts always merge.
 */
export class Builder {
  private parts: THREE.BufferGeometry[] = []

  private push(g: THREE.BufferGeometry, o: PartOpts = {}, paint?: Paint): this {
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(...(o.p ?? [0, 0, 0])),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...(o.r ?? [0, 0, 0]))),
      new THREE.Vector3(...(o.s ?? [1, 1, 1])),
    )
    g.applyMatrix4(m)
    // Stay indexed: shared vertices keep the normals smooth and the vertex count low.
    const flat = g
    flat.deleteAttribute('uv1')
    tmpColor.set(o.c ?? '#ffffff')
    const n = flat.attributes.position.count
    const col = new Float32Array(n * 3)
    const pt = flat.getAttribute('paint') as THREE.BufferAttribute | undefined
    for (let i = 0; i < n; i++) {
      if (paint && pt) {
        paint(pt.getX(i), pt.getY(i), pt.getZ(i), tmpColor, tint)
        tint.set(o.c ?? '#ffffff')
        tmpColor.multiply(tint)
      }
      col[i * 3] = tmpColor.r
      col[i * 3 + 1] = tmpColor.g
      col[i * 3 + 2] = tmpColor.b
    }
    flat.deleteAttribute('paint')
    flat.setAttribute('color', new THREE.BufferAttribute(col, 3))
    this.parts.push(flat)
    return this
  }

  sphere(r: number, o?: PartOpts, w = 10, h = 7): this {
    return this.push(new THREE.SphereGeometry(r, w, h), o)
  }
  box(w: number, h: number, d: number, o?: PartOpts): this {
    return this.push(new THREE.BoxGeometry(w, h, d), o)
  }
  cyl(rTop: number, rBot: number, h: number, o?: PartOpts, seg = 8): this {
    return this.push(new THREE.CylinderGeometry(rTop, rBot, h, seg, 1), o)
  }
  cone(r: number, h: number, o?: PartOpts, seg = 8): this {
    return this.push(new THREE.ConeGeometry(r, h, seg, 1), o)
  }
  /** Capsule along local Y. `len` is the straight middle section. */
  capsule(r: number, len: number, o?: PartOpts, seg = 8): this {
    return this.push(new THREE.CapsuleGeometry(r, len, 3, seg), o)
  }
  torus(r: number, tube: number, o?: PartOpts, radial = 6, tubular = 16, arc = Math.PI * 2): this {
    return this.push(new THREE.TorusGeometry(r, tube, radial, tubular, arc), o)
  }
  /** Lathe around Y from [radius, y] pairs. */
  lathe(profile: [number, number][], o?: PartOpts, seg = 10): this {
    return this.push(new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), seg), o)
  }
  tube(points: V3[], r: number, o?: PartOpts, tubular = 40, radial = 6): this {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)))
    return this.push(new THREE.TubeGeometry(curve, tubular, r, radial, false), o)
  }
  /** Cylinder between two points, optionally tapering from r0 to r1. */
  seg(a: V3, b: V3, r0: number, c?: string, r1: number = r0, sides = 6): this {
    const va = new THREE.Vector3(...a)
    const vb = new THREE.Vector3(...b)
    const dir = vb.clone().sub(va)
    const len = dir.length()
    const mid = va.clone().add(vb).multiplyScalar(0.5)
    const q = new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize())
    const e = new THREE.Euler().setFromQuaternion(q)
    return this.cyl(r1, r0, len, { p: [mid.x, mid.y, mid.z], r: [e.x, e.y, e.z], c }, sides)
  }

  /** Ellipsoid at `c` with radii `r`, optionally rotated. Smooth normals. */
  ell(c: V3, r: V3, color: string, rot: V3 = [0, 0, 0], w = 18, h = 12): this {
    return this.push(new THREE.SphereGeometry(1, w, h), { p: c, s: r, r: rot, c: color })
  }

  /** Upper half of an ellipsoid (open below), for shells and mounds. */
  dome(c: V3, r: V3, color: string, w = 28, h = 12): this {
    return this.push(new THREE.SphereGeometry(1, w, h, 0, Math.PI * 2, 0, Math.PI / 2), { p: c, s: r, c: color })
  }

  /**
   * Smooth variable radius tube along a Catmull-Rom spine with rounded ends. `radii` has one entry per point,
   * either a number or [width, height] for an elliptical section. Width runs along the first section axis, which
   * is horizontal for any spine that is not vertical (and X for vertical spines). `paint` colors each vertex from
   * its position along the limb (t, 0..1) and its direction around the section (cs along width, sn along height).
   */
  limb(points: V3[], radii: Radii, o: PartOpts = {}, opt: LimbOpts = {}): this {
    return this.push(limbGeometry(points, radii, opt), o, opt.paint)
  }

  build(): THREE.BufferGeometry {
    const g = mergeGeometries(this.parts, false)
    for (const p of this.parts) p.dispose()
    this.parts = []
    return g
  }
}

export interface Fitted {
  geo: THREE.BufferGeometry
  /** Half extents of the bounding box before normalizing. */
  size: V3
}

/** Centers a geometry on x and z with its lowest point at y = 0. */
export function groundCenter(geo: THREE.BufferGeometry): V3 {
  geo.computeBoundingBox()
  const b = geo.boundingBox!
  const c = b.getCenter(new THREE.Vector3())
  geo.translate(-c.x, -b.min.y, -c.z)
  geo.computeBoundingBox()
  const s = geo.boundingBox!.getSize(new THREE.Vector3())
  return [s.x, s.y, s.z]
}

/** Moves the geometry so its bounding sphere is centered on the origin. Returns the old center. */
export function recenter(geo: THREE.BufferGeometry): V3 {
  geo.computeBoundingBox()
  const c = geo.boundingBox!.getCenter(new THREE.Vector3())
  geo.translate(-c.x, -c.y, -c.z)
  geo.computeBoundingSphere()
  return [c.x, c.y, c.z]
}

const mixC = new THREE.Color()
export const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** Countershading: `back` on top fading to `belly` underneath. `edge` is where the fade sits (-1 bottom, 1 top). */
export function countershade(back: string, belly: string, edge = 0.0, soft = 0.55): Paint {
  const bc = new THREE.Color(back)
  const lc = new THREE.Color(belly)
  return (_t, _cs, sn, out) => out.copy(lc).lerp(bc, smooth(edge - soft, edge + soft, sn))
}

/** Wraps a paint so `fn` can tweak the color after the base shade. */
export function paintWith(base: Paint, fn: (t: number, cs: number, sn: number, out: THREE.Color) => void): Paint {
  return (t, cs, sn, out, scratch) => {
    base(t, cs, sn, out, scratch)
    fn(t, cs, sn, out)
  }
}

export function lerpHex(out: THREE.Color, hex: string, k: number): THREE.Color {
  return out.lerp(mixC.set(hex), k)
}

const scratchV = new THREE.Vector3()

/** Point and unit tangent on a Catmull-Rom spine, t in 0..1 over the whole spine. Used to place details on a limb. */
export function spineAt(points: V3[], t: number): { p: V3; tan: V3 } {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)))
  const p = curve.getPoint(t)
  scratchV.copy(curve.getTangent(t))
  return { p: [p.x, p.y, p.z], tan: [scratchV.x, scratchV.y, scratchV.z] }
}

function radiusAt(vals: number[], u: number): number {
  const n = vals.length
  const i1 = Math.min(n - 1, Math.max(0, Math.floor(u)))
  const f = u - i1
  const g = (i: number) => vals[Math.min(n - 1, Math.max(0, i))]
  const p0 = g(i1 - 1)
  const p1 = g(i1)
  const p2 = g(i1 + 1)
  const p3 = g(i1 + 2)
  return 0.5 * (2 * p1 + (-p0 + p2) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f + (-p0 + 3 * p1 - 3 * p2 + p3) * f * f * f)
}

/** Raw limb geometry: indexed, smooth normals, uv, plus a temporary `paint` attribute (t, cs, sn). */
export function limbGeometry(points: V3[], radiiIn: Radii, opt: LimbOpts = {}): THREE.BufferGeometry {
  const seg = opt.seg ?? 6
  const radial = opt.radial ?? 12
  const cap = opt.cap ?? 4
  const n = points.length
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)))
  const radii = typeof radiiIn === 'number' ? points.map(() => radiiIn) : radiiIn
  const rw = radii.map((r) => (typeof r === 'number' ? r : r[0]))
  const rh = radii.map((r) => (typeof r === 'number' ? r : r[1]))
  const steps = (n - 1) * seg
  const T = new THREE.Vector3()
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const P = new THREE.Vector3()
  // Rings: each ring is { center, a, b, w, h, t }. Poles are single vertices.
  interface Ring { c: THREE.Vector3; a: THREE.Vector3; b: THREE.Vector3; w: number; h: number; t: number; pole?: boolean }
  const rings: Ring[] = []
  const main: Ring[] = []
  curve.getTangent(0, T)
  const ref = opt.ref ? new THREE.Vector3(...opt.ref) : Math.abs(T.y) > 0.85 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0)
  if (Math.abs(ref.dot(T)) > 0.98) ref.set(ref.x === 1 ? 0 : 1, 0, 0)
  a.crossVectors(ref, T).normalize()
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    curve.getPoint(t, P)
    curve.getTangent(t, T)
    a.addScaledVector(T, -a.dot(T)).normalize()
    b.crossVectors(T, a)
    const u = t * (n - 1)
    main.push({ c: P.clone(), a: a.clone(), b: b.clone(), w: Math.max(0.0005, radiusAt(rw, u)), h: Math.max(0.0005, radiusAt(rh, u)), t })
  }
  const capRings = (end: Ring, dir: number): Ring[] => {
    const out: Ring[] = []
    const tan = end.a.clone().cross(end.b).multiplyScalar(dir)
    const r = (end.w + end.h) / 2
    for (let j = 1; j <= cap; j++) {
      const phi = (j / (cap + 1)) * (Math.PI / 2)
      out.push({ c: end.c.clone().addScaledVector(tan, Math.sin(phi) * r), a: end.a, b: end.b, w: end.w * Math.cos(phi), h: end.h * Math.cos(phi), t: end.t })
    }
    out.push({ c: end.c.clone().addScaledVector(tan, r), a: end.a, b: end.b, w: 0, h: 0, t: end.t, pole: true })
    return out
  }
  if (cap > 0) {
    rings.push(...capRings(main[0], -1).reverse())
    rings.push(...main)
    rings.push(...capRings(main[main.length - 1], 1))
  } else rings.push(...main)
  const pos: number[] = []
  const uv: number[] = []
  const pnt: number[] = []
  const idx: number[] = []
  const rowStart: number[] = []
  const rowPole: boolean[] = []
  rings.forEach((rg, ri) => {
    rowStart.push(pos.length / 3)
    rowPole.push(!!rg.pole)
    const count = rg.pole ? 1 : radial
    for (let k = 0; k < count; k++) {
      const ang = (k / radial) * Math.PI * 2
      const cs = Math.cos(ang)
      const sn = Math.sin(ang)
      pos.push(rg.c.x + rg.a.x * cs * rg.w + rg.b.x * sn * rg.h, rg.c.y + rg.a.y * cs * rg.w + rg.b.y * sn * rg.h, rg.c.z + rg.a.z * cs * rg.w + rg.b.z * sn * rg.h)
      uv.push(k / radial, ri / (rings.length - 1))
      pnt.push(rg.t, cs, sn)
    }
  })
  const vi = (ri: number, k: number) => (rowPole[ri] ? rowStart[ri] : rowStart[ri] + (k % radial))
  for (let ri = 0; ri < rings.length - 1; ri++) {
    for (let k = 0; k < radial; k++) {
      const v00 = vi(ri, k)
      const v01 = vi(ri, k + 1)
      const v10 = vi(ri + 1, k)
      const v11 = vi(ri + 1, k + 1)
      if (v00 !== v01) idx.push(v00, v01, v10)
      if (v10 !== v11) idx.push(v01, v11, v10)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setAttribute('paint', new THREE.Float32BufferAttribute(pnt, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}
