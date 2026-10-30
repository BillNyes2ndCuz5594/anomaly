import { specimenGeo } from './creatures'
import { pairRatios, MIN_PAIR_RATIO, MIN_ROW_RATIO } from './specimenSizes'
import { meanProjectedArea, outlinePoints, ringPoints, scalePoints, sweepPoints, translatePoints, type Box, type V3 } from '../fit'

/** The yaw specimens rest at, and how far they sway around it, in the item panels and Lab C. */
export const DISPLAY_YAW = -0.55
const DISPLAY_RANGE = 0.6
/** Silhouette area every specimen is scaled to, as a fraction of fit squared, so a slim snake-like animal and a wide crab take similar room. */
const AREA_REF = 0.36
/** No specimen may end up longer than this many times `fit`. */
const MAX_REACH = 1.5
/**
 * A scan may stand this much taller than the procedural box it is fitted into. The camera frames this headroom, or a
 * tall head (the brown pelican beside a shorter bird) crosses the top margin once the pair is sized honestly.
 */
export const SCAN_HEIGHT = 1.05
const PAIR_GAP = 0.5
const ROW_GAP = 0.3

interface Shape {
  /** Silhouette proxy at scale 1, grounded and centered like the geometry. */
  points: V3[]
  /** Mean silhouette area at scale 1 over the displayed yaw range. */
  area: number
  /** Longest horizontal size at scale 1. */
  reach: number
}

const shapes = new Map<string, Shape>()

function shapeOf(id: string): Shape {
  let s = shapes.get(id)
  if (!s) {
    const g = specimenGeo(id)
    const points = outlinePoints(g.geo.getAttribute('position').array as ArrayLike<number>, 128)
    s = { points, area: meanProjectedArea(points, DISPLAY_YAW, DISPLAY_RANGE, 0.24), reach: Math.max(g.size[0], g.size[2]) }
    shapes.set(id, s)
  }
  return s
}

/** Mean silhouette area of the procedural model at scale 1 over the displayed yaw range (hero scans match it). */
export const specimenArea = (id: string): number => shapeOf(id).area

/** Longest horizontal size of the procedural model at scale 1. */
export const shapeReach = (id: string): number => shapeOf(id).reach

/**
 * Scale that gives a specimen the same projected silhouette area as every other one at `fit` (area, not the largest
 * dimension, so wide flat animals are not left small and long thin ones are not left huge).
 */
export function specimenScale(id: string, fit: number): number {
  const s = shapeOf(id)
  return Math.min(Math.sqrt((AREA_REF * fit * fit) / s.area), (fit * MAX_REACH) / s.reach)
}

/** Radius of the pedestal ring that suits a specimen: it follows the animal's footprint instead of one size for all. */
export function specimenRing(id: string, fit: number): number {
  const s = shapeOf(id)
  const r = 0.5 * s.reach * specimenScale(id, fit)
  return Math.min(fit * 0.74, Math.max(fit * 0.46, r * 0.82))
}

/** World box of a specimen standing on y = 0 at the origin, before any turning. */
export function specimenBox(id: string, fit: number): Box {
  const g = specimenGeo(id)
  const k = specimenScale(id, fit)
  return { min: [(-g.size[0] / 2) * k, 0, (-g.size[2] / 2) * k], max: [(g.size[0] / 2) * k, g.size[1] * k, (g.size[2] / 2) * k] }
}

/**
 * Silhouette points of a specimen and its base ring over the yaw range it is shown at (rest `yaw`, swaying by
 * +-`sway`; pass Math.PI for a full spin). This is what the camera fits, so the model fills its panel for the
 * angles it really takes, not for a worst case spin.
 */
export function specimenOutline(id: string, fit: number, yaw: number, sway = 0): V3[] {
  const k = specimenScale(id, fit)
  const head: V3 = [0, specimenGeo(id).size[1] * SCAN_HEIGHT * k, 0]
  return [...sweepPoints(scalePoints(shapeOf(id).points, k), sway, 16, yaw), head, ...ringPoints(specimenRing(id, fit), 0.02, 28)]
}

export interface PlacedSpecimen {
  id: string
  /** World `fit` after the honest-size multiplier. */
  fit: number
  yaw: number
  /** Extra turn of the whole specimen so the right half of a row faces back into it. */
  flip: number
  x: number
}

/**
 * One evidence row: honest relative sizes, facing into the pair, spaced so neighbours do not touch. `points` is the
 * camera fit cloud (silhouette, scan headroom, and base ring).
 */
export function placeEvidence(ids: string[], fit: number, yaw: number, sway: number, reachOf?: (id: string) => number): { placed: PlacedSpecimen[]; points: V3[]; notToScale: boolean } {
  const { fits, notToScale } = pairSizing(ids, fit, undefined, reachOf)
  const slots = ids.map((id, i) => {
    const face = ids.length > 1 && i >= ids.length / 2
    return { id, fit: fit * fits[i], yaw: face ? Math.PI - yaw : yaw, flip: face ? Math.PI - 2 * yaw : 0 }
  })
  const outlines = slots.map((s) => specimenOutline(s.id, s.fit, s.yaw, sway))
  const gap = ids.length >= 3 ? ROW_GAP : PAIR_GAP
  const ext = outlines.map((pts) => {
    const xs = pts.map((p) => p[0])
    return { l: -Math.min(...xs), r: Math.max(...xs) }
  })
  const raw: number[] = []
  let cursor = 0
  ext.forEach((e, i) => {
    if (i > 0) cursor += ext[i - 1].r + e.l + gap
    raw.push(cursor)
  })
  const mid = ids.length ? (raw[0] - ext[0].l + raw[raw.length - 1] + ext[ext.length - 1].r) / 2 : 0
  const placed = slots.map((s, i) => ({ ...s, x: raw[i] - mid }))
  const points = outlines.flatMap((pts, i) => translatePoints(pts, [placed[i].x, 0, 0]))
  return { placed, points, notToScale }
}

export interface PairSizing {
  /** Multiplier on the shared `fit` for each id, largest displayed specimen at 1. */
  fits: number[]
  /** True when at least one specimen was drawn larger than its real size ratio, so the panel must say so. */
  notToScale: boolean
}

/**
 * Per-specimen `fit` multipliers so the drawn lengths (longest horizontal reach of the normalised model) follow the real
 * length ratios, with the small ones never below `cap` of the largest. Single specimens are left alone. `reachOf` is the
 * model's own horizontal reach at scale 1 (the procedural proxy by default, the scan once it has loaded).
 */
export function pairSizing(ids: string[], fit: number, cap = ids.length >= 3 ? MIN_ROW_RATIO : MIN_PAIR_RATIO, reachOf: (id: string) => number = shapeReach): PairSizing {
  const { ratios, notToScale } = pairRatios(ids, cap)
  if (ids.length < 2) return { fits: ids.map(() => 1), notToScale: false }
  const drawn = ids.map((id) => reachOf(id) * specimenScale(id, fit))
  // The animal with the largest real length is the anchor; the others are sized from its drawn length.
  const anchor = ratios.indexOf(Math.max(...ratios))
  const m = ids.map((_, i) => (drawn[anchor] * ratios[i]) / drawn[i])
  const top = Math.max(...m)
  return { fits: m.map((v) => v / top), notToScale }
}
