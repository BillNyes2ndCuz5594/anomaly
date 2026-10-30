// Keeps the 3D layer alive when the GPU goes away under it (pure logic, unit tested).
//
// Phones drop GPU contexts all the time: a tab sits in the background, memory gets tight, the driver resets.
// three logs "Device Lost" and stops drawing, but the canvas stays mounted, so the stage stays empty until a
// full reload. Here a lost context remounts the canvas with a fresh renderer, and repeated trouble falls back
// to the WebGL2 backend for the rest of the session.

/** Losses (or 3D layer crashes) inside this window count toward the WebGL2 fallback. */
export const LOSS_WINDOW_MS = 60_000
/** After this many losses in the window, the next renderer uses WebGL2. */
export const LOSSES_BEFORE_WEBGL = 2
/** Stop remounting after this many losses in the window: show the 2D interface instead of a flicker loop. */
export const MAX_LOSSES = 5
/** Small pause before a remount so a resetting GPU process can come back. */
export const REMOUNT_DELAY_MS = 250

export interface LossDecision {
  /** Remount the canvas with a new renderer. */
  remount: boolean
  /** Use three's WebGL2 backend from now on. */
  forceWebGL: boolean
  /** Loss times still inside the window, including this one. */
  recent: number[]
}

export function onGpuLoss(prev: readonly number[], now: number, api: 'WebGPU' | 'WebGL' | string, alreadyWebGL: boolean): LossDecision {
  const recent = [...prev.filter((t) => now - t < LOSS_WINDOW_MS), now]
  const forceWebGL = alreadyWebGL || (api === 'WebGPU' && recent.length >= LOSSES_BEFORE_WEBGL)
  return { remount: recent.length <= MAX_LOSSES, forceWebGL, recent }
}

/** True for the errors a browser throws when a lazy chunk from an older deploy is gone. */
export function isChunkLoadError(err: unknown): boolean {
  const msg = err instanceof Error ? `${err.name} ${err.message}` : String(err)
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported|ChunkLoadError|Unable to preload CSS/i.test(msg)
}

const FALLBACK_KEY = 'anomaly.webglFallback'
let forced = false

/** WebGL2 fallback chosen at runtime (survives a reload within the session). */
export function runtimeForceWebGL(): boolean {
  if (forced) return true
  try {
    return typeof sessionStorage !== 'undefined' && sessionStorage.getItem(FALLBACK_KEY) === '1'
  } catch {
    return false
  }
}

export function setRuntimeForceWebGL(): void {
  forced = true
  try {
    sessionStorage.setItem(FALLBACK_KEY, '1')
  } catch {
    // Private mode: the in-memory flag still covers this page.
  }
}

/** Shared loss bookkeeping for every canvas on the page (the stage and the small item canvas). */
const losses: number[] = []
export function noteGpuLoss(api: string): LossDecision {
  const d = onGpuLoss(losses, performance.now(), api, runtimeForceWebGL())
  losses.length = 0
  losses.push(...d.recent)
  if (d.forceWebGL) setRuntimeForceWebGL()
  return d
}

/** Reload once to pick up a newer deploy when a lazy chunk is gone. Returns false if it already tried. */
export function reloadForNewDeploy(): boolean {
  const KEY = 'anomaly.chunkReloadAt'
  try {
    const last = Number(sessionStorage.getItem(KEY) || 0)
    if (Date.now() - last < 30_000) return false
    sessionStorage.setItem(KEY, String(Date.now()))
  } catch {
    return false
  }
  window.location.reload()
  return true
}
