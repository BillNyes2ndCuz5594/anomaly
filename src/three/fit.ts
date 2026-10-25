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
  const { f, r, u } = basis(position, target)
  const tanV = Math.tan((fovDeg * Math.PI) / 360)
  const tanH = tanV * aspect
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  let behind = false
  for (const c of boxCorners(box)) {
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
    const e = projectBox(box, at(d, t), t, o.fovDeg, aspect)
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
    const e = projectBox(box, pos, target, o.fovDeg, aspect)
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
