import { describe, expect, it } from 'vitest'
import { motionMode, RESULTS_MS, routeMs, ROUTE_BUDGET_MS, stepDirection, veilDir, veilKind } from './motionMode'

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
  it('keeps brisk routes inside the input budget and the cover short', () => {
    for (const mode of ['full', 'fade', 'still'] as const) {
      for (const kind of ['scan', 'dissolve'] as const) {
        const t = routeMs(mode, kind)
        expect(t.cover + t.reveal).toBeLessThanOrEqual(ROUTE_BUDGET_MS)
        expect(t.cover).toBeLessThanOrEqual(200)
      }
    }
  })
  it('gives the signature moments a long reveal and a short cover', () => {
    for (const kind of ['launch', 'warp'] as const) {
      const full = routeMs('full', kind)
      expect(full.cover).toBeLessThanOrEqual(200)
      expect(full.cover + full.reveal).toBeGreaterThanOrEqual(900)
      expect(full.cover + full.reveal).toBeLessThanOrEqual(1400)
      expect(routeMs('fade', kind)).toEqual({ cover: 90, reveal: 180 })
      expect(routeMs('still', kind)).toEqual({ cover: 0, reveal: 0 })
    }
    expect(RESULTS_MS).toBeGreaterThanOrEqual(900)
    expect(RESULTS_MS).toBeLessThanOrEqual(1400)
  })
  it('picks a veil that matches the route pair', () => {
    expect(veilKind('title', 'hub')).toBe('launch')
    expect(veilKind('title', 'case')).toBe('launch')
    expect(veilKind('hub', 'case')).toBe('warp')
    expect(veilKind('case', 'hub')).toBe('warp')
    expect(veilKind('hub', 'cold')).toBe('warp')
    expect(veilKind('cold', 'hub')).toBe('warp')
    expect(veilKind('hub', 'settings')).toBe('dissolve')
    expect(veilKind('settings', 'hub')).toBe('dissolve')
    expect(veilKind('hub', 'visuals')).toBe('dissolve')
    expect(veilDir('hub', 'case')).toBe('forward')
    expect(veilDir('case', 'hub')).toBe('back')
    expect(veilDir('title', 'hub')).toBe('forward')
  })
  it('treats a later step as forward', () => {
    expect(stepDirection(1, 3)).toBe('forward')
    expect(stepDirection(3, 3)).toBe('forward')
    expect(stepDirection(4, 1)).toBe('back')
  })
})