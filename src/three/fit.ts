// Camera fit helper. Pure math (no three import) so it is cheap to unit test.
// Given a world space bounding box, a vertical fov and the canvas aspect, it finds the camera pose that
// keeps the whole box inside the view with a margin, for any aspect ratio. Used by every model viewport.

export type V3 = [number, number, number]
export interface Box {
  min: V3
  max: V3
}

export interface FitOptions {
  /** Vertical field of view in degrees. */
  fovDeg: number
  /** Canvas width over height. */
  aspect: number
  /** Extra space around the box as a fraction. 0.08 keeps 8 percent free. */
  margin?: number
  /** Camera height angle above the horizon, radians. */
  elevation?: number
  /** Camera angle around the box, radians. 0 looks down -z from +z. */
  azimuth?: number
  /**
   * The part of the canvas that is free for the model, as fractions of width and height.
   * The caller centers that part with a view offset. Defaults to the whole canvas.
   */
  frame?: { w: number; h: number }
}

export interface FitResult {
  position: V3
  target: V3
  distance: number
}

export interface Extents {
  minX: number
  maxX: number
  minY: number
  maxY: number
  /** True when any corner is at or behind the camera plane. */
  behind: boolean
}

export const boxCorners = (b: Box): V3[] => {
  const out: V3[] = []
  for (const x of [b.min[0], b.max[0]]) for (const y of [b.min[1], b.max[1]]) for (const z of [b.min[2], b.max[2]]) out.push([x, y, z])
  return out
}

export const boxCenter = (b: Box): V3 => [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2]

export const unionBox = (...boxes: Box[]): Box => ({
  min: [Math.min(...boxes.map((b) => b.min[0])), Math.min(...boxes.map((b) => b.min[1])), Math.min(...boxes.map((b) => b.min[2]))],
  max: [Math.max(...boxes.map((b) => b.max[0])), Math.max(...boxes.map((b) => b.max[1])), Math.max(...boxes.map((b) => b.max[2]))],
})

export const translateBox = (b: Box, d: V3): Box => ({
  min: [b.min[0] + d[0], b.min[1] + d[1], b.min[2] + d[2]],
  max: [b.max[0] + d[0], b.max[1] + d[1], b.max[2] + d[2]],
})

export const scaleBox = (b: Box, k: number): Box => ({
  min: [b.min[0] * k, b.min[1] * k, b.min[2] * k],
  max: [b.max[0] * k, b.max[1] * k, b.max[2] * k],
})

/**
 * The box a model sweeps while it turns about the vertical axis through the origin by up to +-maxYaw
 * (use Math.PI for a full spin) around `centerYaw`. The result bounds the model at every angle in between.
 */
export function sweepYaw(b: Box, maxYaw: number, steps = 32, centerYaw = 0): Box {
  const corners = boxCorners(b)
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (let i = 0; i <= steps; i++) {
    const a = centerYaw - maxYaw + (2 * maxYaw * i) / steps
    const c = Math.cos(a)
    const s = Math.sin(a)
    for (const [x, , z] of corners) {
      const rx = x * c + z * s
      const rz = -x * s + z * c
      minX = Math.min(minX, rx)
      maxX = Math.max(maxX, rx)
      minZ = Math.min(minZ, rz)
      maxZ = Math.max(maxZ, rz)
    }
  }
  return { min: [minX, b.min[1], minZ], max: [maxX, b.max[1], maxZ] }
}

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const norm = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}

/** Camera basis for a camera at `position` looking at `target` with world up +y. */
function basis(position: V3, target: V3) {
  const f = norm(sub(target, position))
  const r = norm(cross(f, [0, 1, 0]))
  const u = cross(r, f)
  return { f, r, u }
}

/** Projects the box corners to normalized device coordinates (-1 to 1 spans the canvas). */
export function projectBox(box: Box, position: V3, target: V3, fovDeg: number, aspect: number): Extents {
  return projectPoints(boxCorners(box), position, target, fovDeg, aspect)
}

/** Projects a point set to normalized device coordinates (-1 to 1 spans the canvas). */
export function projectPoints(points: V3[], position: V3, target: V3, fovDeg: number, aspect: number): Extents {
  const { f, r, u } = basis(position, target)
  const tanV = Math.tan((fovDeg * Math.PI) / 360)
  const tanH = tanV * aspect
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  let behind = false
  for (const c of points) {
    const v = sub(c, position)
    const z = dot(v, f)
    if (z <= 1e-4) {
      behind = true
      continue
    }
    const x = dot(v, r) / (z * tanH)
    const y = dot(v, u) / (z * tanV)
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
  }
  return { minX, maxX, minY, maxY, behind }
}

/** True when the extents sit inside the canvas, with `slack` extra room allowed (0 is the strict edge). */
export function insideNdc(e: Extents, slack = 0): boolean {
  const lim = 1 + slack
  return !e.behind && e.minX >= -lim && e.maxX <= lim && e.minY >= -lim && e.maxY <= lim
}

/** Finds the camera pose that fits the whole box, centered, at the given aspect. */
export function fitBox(box: Box, o: FitOptions): FitResult {
  return fitPoints(boxCorners(box), o)
}

/**
 * Finds the camera pose that fits a point set (a silhouette proxy, for example the swept outline of a model),
 * centered, at the given aspect. Tighter than a box for wide, flat or oddly shaped models.
 */
export function fitPoints(points: V3[], o: FitOptions): FitResult {
  const box = pointsBox(points)
  const margin = o.margin ?? 0.08
  const el = o.elevation ?? 0.1
  const az = o.azimuth ?? 0
  const fw = o.frame?.w ?? 1
  const fh = o.frame?.h ?? 1
  const aspect = Math.max(0.2, o.aspect)
  const dir: V3 = [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)]
  const limX = fw / (1 + margin)
  const limY = fh / (1 + margin)
  let target = boxCenter(box)
  let dist = 10
  const at = (d: number, t: V3): V3 => [t[0] + dir[0] * d, t[1] + dir[1] * d, t[2] + dir[2] * d]
  const fits = (d: number, t: V3) => {
    const e = projectPoints(points, at(d, t), t, o.fovDeg, aspect)
    if (e.behind) return false
    return Math.max(Math.abs(e.minX), Math.abs(e.maxX)) <= limX && Math.max(Math.abs(e.minY), Math.abs(e.maxY)) <= limY
  }
  const tanV = Math.tan((o.fovDeg * Math.PI) / 360)
  for (let pass = 0; pass < 3; pass++) {
    // Bisect on distance: farther is always smaller on screen.
    let lo = 0.1
    let hi = 2000
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2
      if (fits(mid, target)) hi = mid
      else lo = mid
    }
    dist = hi
    // Re-center on the projected extents so perspective skew does not push one side out.
    const pos = at(dist, target)
    const e = projectPoints(points, pos, target, o.fovDeg, aspect)
    const { r, u } = basis(pos, target)
    const mx = (e.minX + e.maxX) / 2
    const my = (e.minY + e.maxY) / 2
    const k = dist * tanV
    target = [target[0] + r[0] * mx * k * aspect + u[0] * my * k, target[1] + r[1] * mx * k * aspect + u[1] * my * k, target[2] + r[2] * mx * k * aspect + u[2] * my * k]
  }
  let lo = 0.1
  let hi = 2000
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    if (fits(mid, target)) hi = mid
    else lo = mid
  }
  dist = hi
  return { position: at(dist, target), target, distance: dist }
}

// ---------- point sets: silhouette proxies ----------

/** Axis aligned box around a point set. */
export function pointsBox(points: V3[]): Box {
  const min: V3 = [Infinity, Infinity, Infinity]
  const max: V3 = [-Infinity, -Infinity, -Infinity]
  for (const p of points) {
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], p[i])
      max[i] = Math.max(max[i], p[i])
    }
  }
  return { min, max }
}

export const translatePoints = (pts: V3[], d: V3): V3[] => pts.map((p) => [p[0] + d[0], p[1] + d[1], p[2] + d[2]])

export const scalePoints = (pts: V3[], k: number): V3[] => pts.map((p) => [p[0] * k, p[1] * k, p[2] * k])

/** Points on a flat ring of radius r at height y, for the base ring of a pedestal. */
export function ringPoints(r: number, y = 0, n = 24): V3[] {
  return Array.from({ length: n }, (_, i) => [Math.cos((i / n) * Math.PI * 2) * r, y, Math.sin((i / n) * Math.PI * 2) * r] as V3)
}

/** Convex hull (monotone chain) of 2D points, counter clockwise. */
export function hull2d(pts: [number, number][]): [number, number][] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  if (p.length < 3) return p
  const cr = (o: [number, number], a: [number, number], b: [number, number]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const lower: [number, number][] = []
  for (const q of p) {
    while (lower.length >= 2 && cr(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop()
    lower.push(q)
  }
  const upper: [number, number][] = []
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i]
    while (upper.length >= 2 && cr(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop()
    upper.push(q)
  }
  lower.pop()
  upper.pop()
  return lower.concat(upper)
}

export function polygonArea(poly: [number, number][]): number {
  let a = 0
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i]
    const [x1, y1] = poly[(i + 1) % poly.length]
    a += x0 * y1 - x1 * y0
  }
  return Math.abs(a) / 2
}

/** `n` roughly even directions on the sphere (Fibonacci lattice), plus the six axes. */
export function sphereDirections(n: number): V3[] {
  const out: V3[] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]
  const g = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n
    const r = Math.sqrt(1 - y * y)
    out.push([Math.cos(g * i) * r, y, Math.sin(g * i) * r])
  }
  return out
}

/**
 * A compact stand in for a vertex cloud: the vertex that sticks out farthest in each of `n` directions. These are
 * real vertices (never outside the mesh) and approximate its convex hull, which is what a camera fit needs, since
 * the projection of the hull is the hull of the projection from any angle. Wide flat shapes keep their rims.
 */
export function outlinePoints(verts: ArrayLike<number>, n = 96): V3[] {
  const count = Math.floor(verts.length / 3)
  const dirs = sphereDirections(n)
  const best = dirs.map(() => -1)
  const bestScore = dirs.map(() => -Infinity)
  for (let i = 0; i < count; i++) {
    const x = verts[i * 3]
    const y = verts[i * 3 + 1]
    const z = verts[i * 3 + 2]
    for (let d = 0; d < dirs.length; d++) {
      const sc = x * dirs[d][0] + y * dirs[d][1] + z * dirs[d][2]
      if (sc > bestScore[d]) {
        bestScore[d] = sc
        best[d] = i
      }
    }
  }
  const seen = new Set<number>()
  const out: V3[] = []
  for (const i of best) {
    if (i < 0 || seen.has(i)) continue
    seen.add(i)
    out.push([verts[i * 3], verts[i * 3 + 1], verts[i * 3 + 2]])
  }
  return out
}

/** Rotates points about the vertical axis. */
export function yawPoints(pts: V3[], a: number): V3[] {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return pts.map(([x, y, z]) => [x * c + z * s, y, -x * s + z * c])
}

/** Every position the points take while turning about the vertical axis by +-maxYaw around centerYaw. */
export function sweepPoints(pts: V3[], maxYaw: number, steps = 12, centerYaw = 0): V3[] {
  if (maxYaw <= 1e-6) return yawPoints(pts, centerYaw)
  const out: V3[] = []
  for (let i = 0; i <= steps; i++) out.push(...yawPoints(pts, centerYaw - maxYaw + (2 * maxYaw * i) / steps))
  return out
}

/** Area of the on screen silhouette (convex hull, orthographic, viewed from `elevation`) of points turned by `yaw`. */
export function projectedArea(pts: V3[], yaw: number, elevation = 0.2): number {
  const se = Math.sin(elevation)
  const ce = Math.cos(elevation)
  const flat = yawPoints(pts, yaw).map(([x, y, z]) => [x, y * ce - z * se] as [number, number])
  return polygonArea(hull2d(flat))
}

/** Mean silhouette area over a yaw range. */
export function meanProjectedArea(pts: V3[], centerYaw: number, halfRange: number, elevation = 0.2, steps = 4): number {
  let sum = 0
  for (let i = 0; i <= steps; i++) sum += projectedArea(pts, centerYaw - halfRange + (2 * halfRange * i) / steps, elevation)
  return sum / (steps + 1)
}

/**
 * How much of the free frame a point set takes at a camera pose: the larger of its width and height as a
 * fraction of what the frame allows (1 is touching the margin).
 */
export function fillFraction(pts: V3[], pose: FitResult, o: FitOptions): number {
  const aspect = Math.max(0.2, o.aspect)
  const e = projectPoints(pts, pose.position, pose.target, o.fovDeg, aspect)
  const fw = (o.frame?.w ?? 1) / (1 + (o.margin ?? 0.08))
  const fh = (o.frame?.h ?? 1) / (1 + (o.margin ?? 0.08))
  return Math.max((e.maxX - e.minX) / 2 / fw, (e.maxY - e.minY) / 2 / fh)
}

/**
 * Vertical field of view (degrees) that shows `halfWidth` world units either side of the view axis at `distance`
 * with the given margin, on a canvas of `aspect` (width / height). Never narrower than `baseFovDeg`, so wide
 * screens keep their look and only tall narrow screens widen the view.
 */
export function fovToFitWidth(halfWidth: number, distance: number, aspect: number, baseFovDeg: number, margin = 0.08): number {
  const tanH = (halfWidth * (1 + margin)) / Math.max(1e-6, distance)
  const fov = (2 * Math.atan(tanH / Math.max(1e-6, aspect)) * 180) / Math.PI
  return Math.max(baseFovDeg, fov)
}

/**
 * Like fovToFitWidth, but the field of view stops at `maxFovDeg` (strong perspective looks wrong) and the rest is
 * made up by moving the camera back: `distanceScale` multiplies the camera distance (1 when nothing is needed).
 */
export function widthFit(halfWidth: number, distance: number, aspect: number, baseFovDeg: number, maxFovDeg: number, margin = 0.08): { fovDeg: number; distanceScale: number } {
  const wanted = fovToFitWidth(halfWidth, distance, aspect, baseFovDeg, margin)
  const fovDeg = Math.min(wanted, maxFovDeg)
  const tanWanted = Math.tan((wanted * Math.PI) / 360)
  const tanHave = Math.tan((fovDeg * Math.PI) / 360)
  return { fovDeg, distanceScale: Math.max(1, tanWanted / tanHave) }
}
