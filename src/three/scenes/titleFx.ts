import type { MotionMode } from '../../ui/motionMode'

/** Title logo timing. The glint sweeps the letters; the reveal resolves them from scanlines on first load. */
export const GLINT_MS = 600
export const GLINT_PERIOD_MS = 8000
export const REVEAL_MS = 900
/** Pause after the reveal (or after load, with no reveal) before the first glint. */
export const GLINT_LEAD_MS = 400

let revealSpent = false

/**
 * Whether this mount should play the scan reveal. Full motion only, and only the first time in a page session.
 * Calling it spends the reveal, so call it once per mount.
 */
export function takeReveal(mode: MotionMode): boolean {
  if (mode !== 'full' || revealSpent) return false
  revealSpent = true
  return true
}

/** Test hook: forget that the reveal played. */
export function resetRevealForTest() {
  revealSpent = false
}

/** 0 to 1 resolve progress of the letters at `tMs` after mount. 1 means fully drawn. */
export function revealProgress(mode: MotionMode, tMs: number, playing: boolean): number {
  if (mode !== 'full' || !playing) return 1
  return Math.max(0, Math.min(1, tMs / REVEAL_MS))
}

/**
 * Progress 0 to 1 of the glint band at `tMs`, or -1 when no glint is running.
 * full: one glint every 8 s, after the reveal when there is one. fade: a single glint. still: none.
 */
export function glintProgress(mode: MotionMode, tMs: number, revealed: boolean): number {
  if (mode === 'still') return -1
  const first = (revealed ? REVEAL_MS : 0) + GLINT_LEAD_MS
  if (tMs < first) return -1
  const since = tMs - first
  const n = Math.floor(since / GLINT_PERIOD_MS)
  if (mode === 'fade' && n > 0) return -1
  const local = since - n * GLINT_PERIOD_MS
  return local < GLINT_MS ? local / GLINT_MS : -1
}
