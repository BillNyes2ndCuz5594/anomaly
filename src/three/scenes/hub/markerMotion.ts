/** How a case marker should read. Hover and keyboard focus share one state, so nothing depends on a pointer. */

/** A case id such as '03-1', or 'cold' for the cold case. */
export type MarkerId = string

export interface MarkerFlags {
  hover: boolean
  focused: boolean
  pressed: boolean
}

export type MarkerAttention = 'rest' | 'attention' | 'press'

const SCALE: Record<MarkerAttention, number> = { rest: 1, attention: 1.12, press: 0.94 }
const GLOW: Record<MarkerAttention, number> = { rest: 1, attention: 1.28, press: 1.5 }

/** Press wins. Otherwise hover and focus are the same cue. */
export function markerAttention(flags: MarkerFlags): MarkerAttention {
  if (flags.pressed) return 'press'
  if (flags.hover || flags.focused) return 'attention'
  return 'rest'
}

export function markerScale(flags: MarkerFlags): number {
  return SCALE[markerAttention(flags)]
}

/** Multiplier on the marker's own glow (a cold case at rest can already be dimmer). */
export function markerGlowMul(flags: MarkerFlags): number {
  return GLOW[markerAttention(flags)]
}

/**
 * World radius of a round target whose diameter is at least `minPx`.
 * Capped so the two Florida markers cannot swallow each other, and floored so a desktop click stays easy.
 */
export function markerHitRadius(viewportHeight: number, distance: number, fovDeg: number, minPx = 44, cap = 0.72, floor = 0.55): number {
  const h = Math.max(1, viewportHeight)
  const dist = Math.max(0.01, distance)
  const worldHeight = 2 * dist * Math.tan((fovDeg * Math.PI) / 360)
  const radius = (minPx / h) * worldHeight * 0.5
  return Math.min(cap, Math.max(floor, radius))
}

/** Reduced motion and ?still=1 both hold the scene. */
export function sceneCalm(reduced: boolean, still: boolean): boolean {
  return reduced || still
}

type Listener = () => void
const pressed: Record<MarkerId, boolean> = {}
const listeners = new Set<Listener>()

export function markerPressed(id: MarkerId): boolean {
  return pressed[id] ?? false
}

export function setMarkerPressed(id: MarkerId, value: boolean): void {
  if ((pressed[id] ?? false) === value) return
  pressed[id] = value
  for (const listener of listeners) listener()
}

export function subscribeMarkerPressed(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// ---------- placing many case markers ----------

export interface MarkerSpot {
  id: string
  lon: number
  lat: number
}

export interface MarkerPlace extends MarkerSpot {
  /** Gem height above the table. Neighbours alternate so labels do not line up. */
  height: number
  /** 1 puts the label to the right of the gem, -1 to the left (east side markers, near the side panel). */
  side: 1 | -1
}

/** Smallest gap between two markers, in degrees (about 0.4 world units on the table). */
export const MARKER_MIN_SEP = 0.6
/** Markers east of this longitude put their label on the left, away from the side panel. */
export const MARKER_LABEL_FLIP_LON = -81.0
const HEIGHTS = [1.75, 1.35, 2.15] as const

/**
 * Places case markers (in case order) so none sits on another: a marker too close to an earlier one, or to a
 * fixed one (the cold case), fans out on a golden angle spiral that only ever moves west, north or south, never
 * further east toward the side panel. Every space case uses the Cape, so ten of them can share one spot.
 */
export function layoutMarkers(list: readonly MarkerSpot[], fixed: readonly MarkerSpot[] = []): MarkerPlace[] {
  const taken: MarkerSpot[] = [...fixed]
  const out: MarkerPlace[] = []
  list.forEach((m, i) => {
    let lon = m.lon
    let lat = m.lat
    const clash = () => taken.some((o) => Math.hypot(o.lon - lon, o.lat - lat) < MARKER_MIN_SEP)
    for (let k = 1; clash() && k < 200; k++) {
      const a = k * 2.399963
      const r = MARKER_MIN_SEP * 0.75 * Math.sqrt(k)
      lon = m.lon - Math.abs(Math.cos(a)) * r
      lat = m.lat + Math.sin(a) * r
    }
    taken.push({ id: m.id, lon, lat })
    out.push({ id: m.id, lon, lat, height: HEIGHTS[i % HEIGHTS.length], side: lon > MARKER_LABEL_FLIP_LON ? -1 : 1 })
  })
  return out
}
