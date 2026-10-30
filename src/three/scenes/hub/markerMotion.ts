/** How a case marker should read. Hover and keyboard focus share one state, so nothing depends on a pointer. */

export type MarkerId = 'case' | 'cold'

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
const pressed: Record<MarkerId, boolean> = { case: false, cold: false }
const listeners = new Set<Listener>()

export function markerPressed(id: MarkerId): boolean {
  return pressed[id]
}

export function setMarkerPressed(id: MarkerId, value: boolean): void {
  if (pressed[id] === value) return
  pressed[id] = value
  for (const listener of listeners) listener()
}

export function subscribeMarkerPressed(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
