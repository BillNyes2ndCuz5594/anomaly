import { specimenGeo } from './creatures'
import { meanProjectedArea, outlinePoints, ringPoints, scalePoints, sweepPoints, type Box, type V3 } from '../fit'

/** The yaw specimens rest at, and how far they sway around it, in the item panels and Lab C. */
export const DISPLAY_YAW = -0.55
const DISPLAY_RANGE = 0.6
/** Silhouette area every specimen is scaled to, as a fraction of fit squared, so a slim snake-like animal and a wide crab take similar room. */
const AREA_REF = 0.36
/** No specimen may end up longer than this many times `fit`. */
const MAX_REACH = 1.5

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
  return [...sweepPoints(scalePoints(shapeOf(id).points, k), sway, 16, yaw), ...ringPoints(specimenRing(id, fit), 0.02, 28)]
}
