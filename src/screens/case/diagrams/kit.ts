// Shared palette, props and path math for the scene diagrams (docs/SPEC.md section 2).
// Navy sky from the svg shell, cyan line work, amber for emphasis, Okabe-Ito colours for meaning.
import type { ComponentType } from 'react'
import { AMBER } from '../diagramLabels'

export const CY = '#3ee6ff'
export const AM = AMBER
export const PALE = '#e6f1ff'
export const INK = '#0a1426'
export const NAVY = '#16294a'
export const SLATE = '#27415f'
export const STEEL = '#9fb3c8'
export const SOIL = '#5a3d26'
export const LEAF = '#4fbf6b'

// Okabe-Ito
export const BLUE = '#0072B2'
export const ORANGE = '#E69F00'
export const GREEN = '#009E73'
export const VERM = '#D55E00'
export const SKY = '#56B4E9'
export const YELLOW = '#F0E442'
export const PURPLE = '#CC79A7'

export interface DiagramProps {
  labels: string[]
  art: boolean
}
export type Diagram = ComponentType<DiagramProps>

const f = (n: number) => +n.toFixed(1)

/** An open arrowhead (chevron) with its tip at (x, y), pointing along angle a in radians. */
export function head(x: number, y: number, a: number, s = 9): string {
  const l = a + Math.PI * 0.82
  const r = a - Math.PI * 0.82
  return `M ${f(x + Math.cos(l) * s)} ${f(y + Math.sin(l) * s)} L ${f(x)} ${f(y)} L ${f(x + Math.cos(r) * s)} ${f(y + Math.sin(r) * s)}`
}

/** A polyline along an ellipse from angle a0 to a1 (radians, screen space so positive turns clockwise). */
export function arcPath(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 28): string {
  const pts = Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n
    return `${f(cx + Math.cos(a) * rx)} ${f(cy + Math.sin(a) * ry)}`
  })
  return `M ${pts.join(' L ')}`
}

/** The direction of travel at angle a along an ellipse, for an arrowhead at the arc end. */
export function arcTangent(rx: number, ry: number, a: number, forward = true): number {
  const t = Math.atan2(Math.cos(a) * ry, -Math.sin(a) * rx)
  return forward ? t : t + Math.PI
}

/** A lumpy closed blob around (x, y): rocks, pebbles, clouds of particles. Deterministic per seed. */
export function blob(x: number, y: number, rx: number, ry: number, seed: number, n = 9, rough = 0.22): string {
  const pts = Array.from({ length: n }, (_, i) => {
    const j = Math.sin((seed + 1) * 12.9898 + i * 78.233) * 43758.5453
    const k = 1 - rough + (j - Math.floor(j)) * rough * 2
    const a = (i / n) * Math.PI * 2
    return [x + Math.cos(a) * rx * k, y + Math.sin(a) * ry * k]
  })
  return smooth(pts)
}

/** A smooth closed curve through the points (quadratic through each, joined at the midpoints). */
export function smooth(pts: number[][]): string {
  const n = pts.length
  const mid = (a: number[], b: number[]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  const m0 = mid(pts[n - 1], pts[0])
  let d = `M ${f(m0[0])} ${f(m0[1])}`
  for (let i = 0; i < n; i++) {
    const p = pts[i]
    const m = mid(p, pts[(i + 1) % n])
    d += ` Q ${f(p[0])} ${f(p[1])} ${f(m[0])} ${f(m[1])}`
  }
  return `${d} Z`
}

/** Deterministic 0..1 noise for scattering small details. */
export const rnd = (n: number): number => {
  const a = Math.sin(n * 91.7) * 43758.5
  return a - Math.floor(a)
}
