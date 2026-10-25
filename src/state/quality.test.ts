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
