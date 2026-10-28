import { describe, expect, it } from 'vitest'
import { motionMode, routeMs, ROUTE_BUDGET_MS, stepDirection, veilKind } from './motionMode'

describe('motion mode', () => {
  it('stays still for reduced motion and the still flag', () => {
    expect(motionMode({ reduced: true, still: false, tier: 'high' })).toBe('still')
    expect(motionMode({ reduced: false, still: true, tier: 'ultra' })).toBe('still')
  })
  it('uses a cheap fade on the low tier and the full veil otherwise', () => {
    expect(motionMode({ reduced: false, still: false, tier: 'low' })).toBe('fade')
    expect(motionMode({ reduced: false, still: false, tier: 'medium' })).toBe('full')
    expect(motionMode({ reduced: false, still: false, tier: 'high' })).toBe('full')
  })
  it('keeps every route transition inside the input budget', () => {
    for (const mode of ['full', 'fade', 'still'] as const) {
      const t = routeMs(mode)
      expect(t.cover + t.reveal).toBeLessThanOrEqual(ROUTE_BUDGET_MS)
      expect(t.cover).toBeLessThanOrEqual(200)
    }
  })
  it('picks a veil that matches the route pair', () => {
    expect(veilKind('title', 'hub')).toBe('deploy')
    expect(veilKind('hub', 'case')).toBe('scan')
    expect(veilKind('case', 'hub')).toBe('scan')
    expect(veilKind('hub', 'settings')).toBe('dissolve')
    expect(veilKind('settings', 'hub')).toBe('dissolve')
    expect(veilKind('hub', 'visuals')).toBe('dissolve')
  })
  it('treats a later step as forward', () => {
    expect(stepDirection(1, 3)).toBe('forward')
    expect(stepDirection(3, 3)).toBe('forward')
    expect(stepDirection(4, 1)).toBe('back')
  })
})
