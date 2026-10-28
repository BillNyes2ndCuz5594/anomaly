import { describe, expect, it } from 'vitest'
import {
  AUTO_MAX_TIER,
  autoStartTier,
  dprForTier,
  initialAutoState,
  isPostTier,
  resolveTier,
  rollingFps,
  stepAuto,
  stepAdaptive,
  initialAdaptiveState,
  DPR_STEPS,
  type AdaptiveState,
  type AutoState,
} from './quality'

function run(state: AutoState, fps: number, seconds: number, stepMs = 500): AutoState {
  let s = state
  for (let t = 0; t < seconds * 1000; t += stepMs) s = stepAuto(s, fps, stepMs)
  return s
}

describe('auto tier logic', () => {
  it('starts medium on webgl2 and high on webgpu', () => {
    expect(autoStartTier('webgl2')).toBe('medium')
    expect(autoStartTier('webgpu')).toBe('high')
  })

  it('steps down after 3 s under 45 fps', () => {
    let s = initialAutoState('high')
    s = run(s, 30, 2.5)
    expect(s.tier).toBe('high')
    s = run(s, 30, 0.5)
    expect(s.tier).toBe('medium')
  })

  it('does not step down if fps recovers before 3 s', () => {
    let s = initialAutoState('high')
    s = run(s, 30, 2.5)
    s = run(s, 60, 0.5)
    s = run(s, 30, 2.5)
    expect(s.tier).toBe('high')
  })

  it('steps up after 8 s over 58 fps, never above high', () => {
    let s = initialAutoState('low')
    s = run(s, 60, 7.5)
    expect(s.tier).toBe('low')
    s = run(s, 60, 0.5)
    expect(s.tier).toBe('medium')
    s = run(s, 60, 8)
    expect(s.tier).toBe('high')
    s = run(s, 60, 60)
    expect(s.tier).toBe(AUTO_MAX_TIER)
  })

  it('never goes below low', () => {
    const s = run(initialAutoState('low'), 5, 30)
    expect(s.tier).toBe('low')
  })

  it('holds steady between 45 and 58 fps', () => {
    const s = run(initialAutoState('medium'), 52, 60)
    expect(s.tier).toBe('medium')
  })

  it('resets timers after a step', () => {
    let s = run(initialAutoState('high'), 30, 3)
    expect(s.tier).toBe('medium')
    expect(s.lowMs).toBe(0)
    s = run(s, 30, 2.5)
    expect(s.tier).toBe('medium')
  })
})

describe('tiers', () => {
  it('caps dpr per tier', () => {
    expect(dprForTier('low', 2)).toBeLessThanOrEqual(1)
    expect(dprForTier('medium', 3)).toBe(1.25)
    expect(dprForTier('high', 3)).toBe(1.75)
    expect(dprForTier('ultra', 2)).toBe(2)
    expect(dprForTier('ultra', 1)).toBe(1)
  })

  it('resolves auto to the auto tier and fixed settings to themselves', () => {
    expect(resolveTier('auto', 'medium')).toBe('medium')
    expect(resolveTier('ultra', 'low')).toBe('ultra')
  })

  it('low has no post fx', () => {
    expect(isPostTier('low')).toBe(false)
    expect(isPostTier('medium')).toBe(true)
  })
})

describe('rollingFps', () => {
  it('computes fps over a window and drops old frames', () => {
    const stamps: number[] = []
    for (let i = 0; i <= 120; i++) stamps.push(i * (1000 / 60))
    expect(rollingFps(stamps, 2000)).toBeCloseTo(60, 0)
    expect(stamps[0]).toBeGreaterThanOrEqual(0)
    expect(rollingFps([], 100)).toBe(0)
  })

  it('still reports slow renderers using the last few frames', () => {
    const stamps = [0, 700, 1400, 2100]
    expect(rollingFps(stamps, 2200)).toBeCloseTo(1.43, 1)
    expect(rollingFps([0, 700, 1400, 2100], 9000)).toBe(0)
  })
})

function runA(state: AdaptiveState, fps: number, seconds: number, stepMs = 500): AdaptiveState {
  let s = state
  for (let t = 0; t < seconds * 1000; t += stepMs) s = stepAdaptive(s, fps, stepMs)
  return s
}

describe('adaptive resolution', () => {
  it('scales dpr by the step and never below 0.5', () => {
    expect(dprForTier('high', 2, 0.8)).toBeCloseTo(1.4)
    expect(dprForTier('low', 1, 0.5)).toBe(0.5)
    expect(dprForTier('medium', 1, 0.65)).toBeCloseTo(0.65)
  })

  it('lowers resolution after 2 s of slow frames, before the tier', () => {
    let s = initialAdaptiveState('high')
    s = runA(s, 30, 1.5)
    expect(s.dprStep).toBe(0)
    s = runA(s, 30, 0.5)
    expect(s.dprStep).toBe(1)
    expect(s.tier).toBe('high')
  })

  it('drops the tier only after the lowest resolution step, and keeps that step', () => {
    let s = initialAdaptiveState('high')
    s = runA(s, 30, 2 * (DPR_STEPS.length - 1))
    expect(s.dprStep).toBe(DPR_STEPS.length - 1)
    expect(s.tier).toBe('high')
    s = runA(s, 30, 2)
    expect(s.tier).toBe('medium')
    expect(s.dprStep).toBe(DPR_STEPS.length - 1)
  })

  it('recovers resolution first, then the tier, after 8 s of fast frames', () => {
    let s = initialAdaptiveState('medium', 2)
    s = runA(s, 60, 8)
    expect(s.dprStep).toBe(1)
    s = runA(s, 60, 8)
    expect(s.dprStep).toBe(0)
    expect(s.tier).toBe('medium')
    s = runA(s, 60, 8)
    expect(s.tier).toBe('high')
  })

  it('does not step on a brief dip', () => {
    let s = initialAdaptiveState('high')
    s = runA(s, 30, 1.5)
    s = runA(s, 60, 0.5)
    s = runA(s, 30, 1.5)
    expect(s.dprStep).toBe(0)
  })

  it('backs off exponentially when a step up is followed by a step down', () => {
    let s = initialAdaptiveState('high', 1)
    s = runA(s, 60, 8)
    expect(s.dprStep).toBe(0)
    s = runA(s, 30, 2)
    expect(s.dprStep).toBe(1)
    expect(s.upNeedMs).toBe(16000)
    // Needs 16 s now, so 15.5 s of fast frames changes nothing.
    s = runA(s, 60, 15.5)
    expect(s.dprStep).toBe(1)
    s = runA(s, 60, 0.5)
    expect(s.dprStep).toBe(0)
    s = runA(s, 30, 2)
    expect(s.upNeedMs).toBe(32000)
  })

  it('never oscillates faster than the growing wait under a borderline load', () => {
    // Fast at low resolution, slow at full resolution: count steps over 10 minutes.
    let s = initialAdaptiveState('high', 1)
    let changes = 0
    for (let t = 0; t < 600000; t += 500) {
      const next = stepAdaptive(s, s.dprStep === 0 ? 30 : 60, 500)
      if (next.dprStep !== s.dprStep || next.tier !== s.tier) changes++
      s = next
    }
    expect(changes).toBeLessThan(24)
    expect(s.upNeedMs).toBe(64000)
  })

  it('stays put on a mid range fps', () => {
    const s = runA(initialAdaptiveState('medium'), 52, 120)
    expect(s.dprStep).toBe(0)
    expect(s.tier).toBe('medium')
  })
})
