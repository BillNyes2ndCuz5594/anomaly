import type { Tier } from '../state/quality'

/** full: themed motion. fade: opacity only (low tier). still: nothing moves. */
export type MotionMode = 'full' | 'fade' | 'still'

/** How a route veil travels. scan wipes, deploy irises, dissolve fades. */
export type VeilKind = 'scan' | 'deploy' | 'dissolve'

/** Full route cover. Kept under the reveal so a tap is never blocked for long. */
export const ROUTE_COVER_MS = 150
export const ROUTE_REVEAL_MS = 380
export const ROUTE_FADE_COVER_MS = 90
export const ROUTE_FADE_REVEAL_MS = 180

/** Hard cap: cover plus reveal stays under the input budget. */
export const ROUTE_BUDGET_MS = 560

export function motionMode(opts: { reduced: boolean; still: boolean; tier: Tier }): MotionMode {
  if (opts.reduced || opts.still) return 'still'
  if (opts.tier === 'low') return 'fade'
  return 'full'
}

export function routeMs(mode: MotionMode): { cover: number; reveal: number } {
  if (mode === 'still') return { cover: 0, reveal: 0 }
  if (mode === 'fade') return { cover: ROUTE_FADE_COVER_MS, reveal: ROUTE_FADE_REVEAL_MS }
  return { cover: ROUTE_COVER_MS, reveal: ROUTE_REVEAL_MS }
}

/** Pick a veil from the route names on either side of a hash change. */
export function veilKind(from: string, to: string): VeilKind {
  if (from === 'title' && (to === 'hub' || to === 'case' || to === 'cold')) return 'deploy'
  if (to === 'settings' || from === 'settings' || to === 'visuals' || from === 'visuals') return 'dissolve'
  return 'scan'
}

export function stepDirection(fromIndex: number, toIndex: number): 'forward' | 'back' {
  return toIndex >= fromIndex ? 'forward' : 'back'
}
