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
const UP = new THREE.Vector3(0, 1, 0)

/**
 * Tiny procedural modeling kit: add primitives, get one merged BufferGeometry.
 * Everything is converted to non-indexed with position, normal, uv and color so parts always merge.
 */
export class Builder {
  private parts: THREE.BufferGeometry[] = []

  private push(g: THREE.BufferGeometry, o: PartOpts = {}): this {
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(...(o.p ?? [0, 0, 0])),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...(o.r ?? [0, 0, 0]))),
      new THREE.Vector3(...(o.s ?? [1, 1, 1])),
    )
    g.applyMatrix4(m)
    const flat = g.index ? g.toNonIndexed() : g
    if (flat !== g) g.dispose()
    flat.deleteAttribute('uv1')
    tmpColor.set(o.c ?? '#ffffff')
    const n = flat.attributes.position.count
    const col = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      col[i * 3] = tmpColor.r
      col[i * 3 + 1] = tmpColor.g
      col[i * 3 + 2] = tmpColor.b
    }
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
