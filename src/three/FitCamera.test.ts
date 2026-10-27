import { describe, expect, it } from 'vitest'
import { dampFactor, PUSH_IN } from './FitCamera'

describe('camera easing', () => {
  it('damps by a bounded, frame rate independent amount', () => {
    expect(dampFactor(9, 0)).toBe(0)
    expect(dampFactor(9, 10)).toBeCloseTo(1 - Math.exp(-0.9), 6)
    // two half steps equal one full step
    const half = dampFactor(9, 0.05)
    expect(1 - (1 - half) * (1 - half)).toBeCloseTo(dampFactor(9, 0.1), 6)
  })
  it('only ever starts further away than the fit, a small amount', () => {
    expect(PUSH_IN).toBeGreaterThan(0)
    expect(PUSH_IN).toBeLessThan(0.25)
  })
})
