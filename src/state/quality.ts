// Quality tiers and the Auto controller (pure logic, unit tested).

export type Tier = 'low' | 'medium' | 'high' | 'ultra'
export type QualitySetting = Tier | 'auto'
export type Backend = 'webgpu' | 'webgl2' | 'none'

export const TIERS: readonly Tier[] = ['low', 'medium', 'high', 'ultra']
export const QUALITY_SETTINGS: readonly QualitySetting[] = ['auto', 'low', 'medium', 'high', 'ultra']

export interface TierConfig {
  /** Max device pixel ratio the canvas may use. */
  dprCap: number
  antialias: boolean
  bloom: boolean
  vignette: boolean
  grain: boolean
  contactShadow: boolean
  /** Dust particle count for the scenes. */
  particles: number
}

export const TIER_CONFIG: Record<Tier, TierConfig> = {
  low: { dprCap: 0.75, antialias: false, bloom: false, vignette: false, grain: false, contactShadow: false, particles: 90 },
  medium: { dprCap: 1.25, antialias: true, bloom: true, vignette: false, grain: false, contactShadow: false, particles: 220 },
  high: { dprCap: 1.75, antialias: true, bloom: true, vignette: true, grain: true, contactShadow: true, particles: 420 },
  ultra: { dprCap: 2, antialias: true, bloom: true, vignette: true, grain: true, contactShadow: true, particles: 700 },
}

export const AUTO_MAX_TIER: Tier = 'high'
export const FPS_LOW = 45
export const FPS_HIGH = 58
export const STEP_DOWN_MS = 3000
export const STEP_UP_MS = 8000

export function isPostTier(tier: Tier): boolean {
  const c = TIER_CONFIG[tier]
  return c.bloom || c.vignette || c.grain
}

/** DPR to hand to the canvas for a tier on a display with the given device pixel ratio. */
export function dprForTier(tier: Tier, devicePixelRatio: number, scale = 1): number {
  const cap = TIER_CONFIG[tier].dprCap
  return Math.max(0.5, Math.min(devicePixelRatio || 1, cap) * scale)
}

/** Resolution multipliers Auto walks through before it gives up a whole tier. Index 0 is full resolution. */
export const DPR_STEPS: readonly number[] = [1, 0.8, 0.65]
/** Sustained slow frames before Auto lowers resolution one step (a tier drop after the last step). */
export const DPR_DOWN_MS = 2000
/** A step down this soon after a step up counts as oscillation and doubles the wait before the next step up. */
export const OSCILLATION_MS = 30000
export const MAX_UP_MS = 64000

/** Tier Auto starts at, before any FPS data exists. */
export function autoStartTier(backend: Backend): Tier {
  return backend === 'webgpu' ? 'high' : 'medium'
}

/** `?tier=low|medium|high|ultra` pins the tier and turns Auto off (proof and debugging). */
export function urlTier(): Tier | null {
  if (typeof window === 'undefined') return null
  const v = new URLSearchParams(window.location.search).get('tier')
  return v && (TIERS as readonly string[]).includes(v) ? (v as Tier) : null
}

/** `?backend=webgl2` forces three's WebGL2 backend even when WebGPU exists. */
export function urlForceWebGL(): boolean {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('backend') === 'webgl2'
}

/** True when the Auto controller is allowed to change the tier. */
export function isAutoActive(setting: QualitySetting): boolean {
  return setting === 'auto' && urlTier() === null
}

export function resolveTier(setting: QualitySetting, autoTier: Tier): Tier {
  const pinned = urlTier()
  if (pinned) return pinned
  return setting === 'auto' ? autoTier : setting
}

export interface AutoState {
  tier: Tier
  /** Milliseconds fps has been continuously below FPS_LOW. */
  lowMs: number
  /** Milliseconds fps has been continuously above FPS_HIGH. */
  highMs: number
}

export function initialAutoState(tier: Tier): AutoState {
  return { tier, lowMs: 0, highMs: 0 }
}

/**
 * Feed one FPS sample (the rolling-window fps, sampled every `dtMs`).
 * Steps down after fps stays under 45 for 3 s, steps up after fps stays over 58 for 8 s,
 * never above AUTO_MAX_TIER and never below low. A step resets both timers.
 */
export function stepAuto(state: AutoState, fps: number, dtMs: number): AutoState {
  let lowMs = fps < FPS_LOW ? state.lowMs + dtMs : 0
  let highMs = fps > FPS_HIGH ? state.highMs + dtMs : 0
  let tier = state.tier
  const idx = TIERS.indexOf(tier)
  if (lowMs >= STEP_DOWN_MS) {
    if (idx > 0) tier = TIERS[idx - 1]
    lowMs = 0
    highMs = 0
  } else if (highMs >= STEP_UP_MS) {
    if (idx < TIERS.indexOf(AUTO_MAX_TIER)) tier = TIERS[idx + 1]
    lowMs = 0
    highMs = 0
  }
  return { tier, lowMs, highMs }
}

/**
 * Rolling-window fps from frame timestamps (ms). Keeps frames inside the window, but never
 * fewer than the last 3 so slow renderers (a few fps) still report a number. A stall longer
 * than 5 s reports 0.
 */
export function rollingFps(stamps: number[], now: number, windowMs = 2000): number {
  while (stamps.length > 3 && now - stamps[0] > windowMs) stamps.shift()
  if (stamps.length < 2) return 0
  if (now - stamps[stamps.length - 1] > 5000) return 0
  const span = stamps[stamps.length - 1] - stamps[0]
  return span > 0 ? ((stamps.length - 1) * 1000) / span : 0
}

export interface AdaptiveState {
  tier: Tier
  /** Index into DPR_STEPS, 0 is full resolution. */
  dprStep: number
  lowMs: number
  highMs: number
  /** Running clock in ms, advanced by every sample. */
  clockMs: number
  /** Clock value of the last step up, or -Infinity. */
  lastUpAt: number
  /** Fast frames needed before the next step up. Doubles after every oscillation, up to MAX_UP_MS. */
  upNeedMs: number
}

export function initialAdaptiveState(tier: Tier, dprStep = 0): AdaptiveState {
  return { tier, dprStep, lowMs: 0, highMs: 0, clockMs: 0, lastUpAt: -Infinity, upNeedMs: STEP_UP_MS }
}

/**
 * Auto controller with adaptive resolution. Under 45 fps for 2 s lowers the resolution one step;
 * once the lowest step is reached the next 2 s drop the tier (resolution stays low so the cheaper tier
 * does not cost more pixels than it saves). Over 58 fps for 8 s raises resolution first, then the tier.
 * A step down within 30 s of a step up doubles the step up wait, so it never oscillates.
 */
export function stepAdaptive(state: AdaptiveState, fps: number, dtMs: number): AdaptiveState {
  const clockMs = state.clockMs + dtMs
  let lowMs = fps < FPS_LOW ? state.lowMs + dtMs : 0
  let highMs = fps > FPS_HIGH ? state.highMs + dtMs : 0
  let { tier, dprStep, lastUpAt, upNeedMs } = state
  const tierIdx = TIERS.indexOf(tier)
  if (lowMs >= DPR_DOWN_MS) {
    if (clockMs - lastUpAt < OSCILLATION_MS) upNeedMs = Math.min(upNeedMs * 2, MAX_UP_MS)
    if (dprStep < DPR_STEPS.length - 1) dprStep++
    else if (tierIdx > 0) tier = TIERS[tierIdx - 1]
    lowMs = 0
    highMs = 0
  } else if (highMs >= upNeedMs) {
    if (dprStep > 0) dprStep--
    else if (tierIdx < TIERS.indexOf(AUTO_MAX_TIER)) tier = TIERS[tierIdx + 1]
    if (dprStep !== state.dprStep || tier !== state.tier) lastUpAt = clockMs
    lowMs = 0
    highMs = 0
  }
  return { tier, dprStep, lowMs, highMs, clockMs, lastUpAt, upNeedMs }
}
