import { beforeEach, describe, expect, it } from 'vitest'
import { GLINT_LEAD_MS, GLINT_MS, GLINT_PERIOD_MS, REVEAL_MS, glintProgress, resetRevealForTest, revealProgress, takeReveal } from './titleFx'

beforeEach(() => resetRevealForTest())

describe('title reveal gate', () => {
  it('plays once per session, full motion only', () => {
    expect(takeReveal('fade')).toBe(false)
    expect(takeReveal('still')).toBe(false)
    expect(takeReveal('full')).toBe(true)
    expect(takeReveal('full')).toBe(false)
  })

  it('resolves over 900 ms and is complete when not playing or not full', () => {
    expect(revealProgress('full', 0, true)).toBe(0)
    expect(revealProgress('full', REVEAL_MS / 2, true)).toBeCloseTo(0.5)
    expect(revealProgress('full', REVEAL_MS * 3, true)).toBe(1)
    expect(revealProgress('full', 0, false)).toBe(1)
    expect(revealProgress('fade', 0, true)).toBe(1)
    expect(revealProgress('still', 0, true)).toBe(1)
  })
})

describe('title glint timing', () => {
  it('full: waits for the reveal, then sweeps 600 ms every 8 s', () => {
    const first = REVEAL_MS + GLINT_LEAD_MS
    expect(glintProgress('full', first - 1, true)).toBe(-1)
    expect(glintProgress('full', first, true)).toBe(0)
    expect(glintProgress('full', first + GLINT_MS / 2, true)).toBeCloseTo(0.5)
    expect(glintProgress('full', first + GLINT_MS, true)).toBe(-1)
    expect(glintProgress('full', first + GLINT_PERIOD_MS + 300, true)).toBeCloseTo(0.5)
    expect(glintProgress('full', first + GLINT_PERIOD_MS * 5 + 1, true)).toBeGreaterThanOrEqual(0)
  })

  it('full without a reveal starts after the lead only', () => {
    expect(glintProgress('full', GLINT_LEAD_MS, false)).toBe(0)
  })

  it('fade: exactly one glint', () => {
    expect(glintProgress('fade', GLINT_LEAD_MS + 300, false)).toBeCloseTo(0.5)
    expect(glintProgress('fade', GLINT_LEAD_MS + GLINT_PERIOD_MS + 300, false)).toBe(-1)
  })

  it('still: never', () => {
    for (const t of [0, 400, 1000, 9000, 20000]) expect(glintProgress('still', t, false)).toBe(-1)
  })
})
