export type V3 = [number, number, number]

export function vlen(a: V3): number {
  return Math.hypot(a[0], a[1], a[2])
}

export function vsub(a: V3, b: V3): V3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

export function vadd(a: V3, b: V3): V3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}

export function vscale(a: V3, s: number): V3 {
  return [a[0] * s, a[1] * s, a[2] * s]
}

export function vdot(a: V3, b: V3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

export function vnorm(a: V3): V3 {
  const l = vlen(a)
  if (l < 1e-8) return [0, 0, 1]
  return [a[0] / l, a[1] / l, a[2] / l]
}

/**
 * Where a step fly starts. The point is never closer to `look` than `rest` is,
 * then `push` backs it up further, so a fitted subject only looks smaller while the camera moves.
 * `from` and a previous camera may tilt the direction when they still face the fitted view.
 */
export function flyStart(rest: V3, look: V3, previous: V3 | null, from: V3, push: number): V3 {
  const restVec = vsub(rest, look)
  const restDist = Math.max(1e-4, vlen(restVec))
  const restDir = vnorm(restVec)
  let dir = restDir
  if (push > 0) {
    const hinted = vnorm(vadd(restVec, vscale(from, 0.35)))
    if (vdot(hinted, restDir) > 0.2) dir = hinted
    if (previous) {
      const prevDir = vnorm(vsub(previous, look))
      if (vdot(prevDir, restDir) > 0.55) dir = vnorm(vadd(vscale(restDir, 0.6), vscale(prevDir, 0.4)))
    }
  }
  return vadd(look, vscale(dir, restDist * (1 + Math.max(0, push))))
}

let memory: V3 | null = null

/** Remember a settled camera so the next step can leave from it. */
export function noteCamera(pos: V3): void {
  memory = [pos[0], pos[1], pos[2]]
}

export function peekCamera(): V3 | null {
  return memory
}

export function resetCameraMemory(): void {
  memory = null
}
