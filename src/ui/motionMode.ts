import type { Tier } from '../state/quality'

/** full: themed motion. fade: opacity only (low tier). still: nothing moves. */
export type MotionMode = 'full' | 'fade' | 'still'

/**
 * How a route veil travels.
 * launch: title into the hub (iris).
 * warp: hub to a case and back (depth push).
 * scan: a short wipe. dissolve: a short fade.
 */
export type VeilKind = 'launch' | 'warp' | 'scan' | 'dissolve'

/** Small routes. Cover is the only moment input is held. */
export const ROUTE_COVER_MS = 150
export const ROUTE_REVEAL_MS = 380
export const ROUTE_FADE_COVER_MS = 90
export const ROUTE_FADE_REVEAL_MS = 180

/**
 * Signature moments. The cover stays short so a tap is never blocked for long.
 * The reveal is the show, and a tap skips that too.
 * launch 160 + 1120 = 1280 ms. warp 180 + 1080 = 1260 ms.
 */
export const LAUNCH_COVER_MS = 160
export const LAUNCH_REVEAL_MS = 1120
export const WARP_COVER_MS = 180
export const WARP_REVEAL_MS = 1080

/** Case step into results. It does not take the pointer. */
export const RESULTS_MS = 1120

/** Hard cap for the brisk routes (scan, dissolve, low tier, still). */
export const ROUTE_BUDGET_MS = 560

export function motionMode(opts: { reduced: boolean; still: boolean; tier: Tier }): MotionMode {
  if (opts.reduced || opts.still) return 'still'
  if (opts.tier === 'low') return 'fade'
  return 'full'
}

export function routeMs(mode: MotionMode, kind: VeilKind = 'scan'): { cover: number; reveal: number } {
  if (mode === 'still') return { cover: 0, reveal: 0 }
  if (mode === 'fade') return { cover: ROUTE_FADE_COVER_MS, reveal: ROUTE_FADE_REVEAL_MS }
  if (kind === 'launch') return { cover: LAUNCH_COVER_MS, reveal: LAUNCH_REVEAL_MS }
  if (kind === 'warp') return { cover: WARP_COVER_MS, reveal: WARP_REVEAL_MS }
  return { cover: ROUTE_COVER_MS, reveal: ROUTE_REVEAL_MS }
}

/** Pick a veil from the route names on either side of a hash change. */
export function veilKind(from: string, to: string): VeilKind {
  if (from === 'title' && (to === 'hub' || to === 'case' || to === 'cold')) return 'launch'
  if ((from === 'hub' && (to === 'case' || to === 'cold')) || ((from === 'case' || from === 'cold') && to === 'hub')) return 'warp'
  if (to === 'settings' || from === 'settings' || to === 'visuals' || from === 'visuals') return 'dissolve'
  return 'scan'
}

/** Forward dives into a case. Back climbs out to the hub. */
export function veilDir(from: string, to: string): 'forward' | 'back' {
  if ((from === 'case' || from === 'cold') && to === 'hub') return 'back'
  return 'forward'
}

export function stepDirection(fromIndex: number, toIndex: number): 'forward' | 'back' {
  return toIndex >= fromIndex ? 'forward' : 'back'
}
