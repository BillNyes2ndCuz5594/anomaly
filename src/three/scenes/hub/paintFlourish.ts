import type { MotionMode } from '../../../ui/motionMode'

/** The hub drone plays one flourish per newly unlocked paint. */
export const PAINT_SEEN_KEY = 'anomaly.paint-seen'
export const FLOURISH_MS = 800
/** Wait for the hub reveal to finish before the roll starts. */
export const FLOURISH_DELAY_MS = 600

export type Flourish = 'roll' | 'glow' | 'none'

type Store = Pick<Storage, 'getItem' | 'setItem'>

function safeStorage(): Store | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

/** How many paints the agent has already seen the flourish for. Unknown counts as none. */
export function readSeen(store: Store | null = safeStorage()): number {
  try {
    const n = Number(store?.getItem(PAINT_SEEN_KEY))
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
  } catch {
    return 0
  }
}

/** full: barrel roll. fade: glow pulse only. still: nothing. */
export function flourishFor(mode: MotionMode): Flourish {
  return mode === 'full' ? 'roll' : mode === 'fade' ? 'glow' : 'none'
}

/**
 * Called with the current paint count. Returns the flourish to play when there are paints the agent has not seen,
 * and records the count so it fires once per unlock, in every mode (still marks them seen without playing).
 */
export function claimFlourish(mode: MotionMode, paintCount: number, store: Store | null = safeStorage()): Flourish {
  const seen = readSeen(store)
  if (paintCount <= seen) return 'none'
  try {
    store?.setItem(PAINT_SEEN_KEY, String(paintCount))
  } catch {
    // Storage blocked: the flourish may repeat next visit. Harmless.
  }
  return flourishFor(mode)
}

/** Barrel roll angle in radians for progress p (0 to 1): one full turn, eased in and out. */
export function rollAngle(p: number): number {
  const k = Math.max(0, Math.min(1, p))
  return (k * k * (3 - 2 * k)) * Math.PI * 2
}

/** Glow boost for progress p: 0 at the ends, 1 at the middle. */
export function glowAmount(p: number): number {
  const k = Math.max(0, Math.min(1, p))
  return Math.sin(k * Math.PI)
}
