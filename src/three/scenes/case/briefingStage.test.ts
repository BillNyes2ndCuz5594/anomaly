import { describe, expect, it } from 'vitest'
import { BAR_BASE, BAR_TOP, lampScale, partTint, scanFade, scanHeight, scanPhase } from './briefingStage'

describe('briefing scan', () => {
  it('holds a mid lip height when motion is frozen', () => {
    expect(scanPhase(12.4, true)).toBe(0.4)
    const y = scanHeight(scanPhase(12.4, true))
    expect(y).toBeGreaterThan(BAR_BASE)
    expect(y).toBeLessThan(BAR_BASE + BAR_TOP)
    expect(y).toBeLessThan(1)
  })

  it('loops inside 0..1 and never reaches the head', () => {
    for (const t of [0, 0.2, 3.5, 19, 40]) {
      const p = scanPhase(t, false)
      expect(p).toBeGreaterThanOrEqual(0)
      expect(p).toBeLessThan(1)
      expect(scanHeight(p)).toBeLessThanOrEqual(BAR_BASE + BAR_TOP + 1e-9)
      expect(scanFade(p)).toBeGreaterThanOrEqual(0)
      expect(scanFade(p)).toBeLessThanOrEqual(1)
    }
  })
})

describe('lamp scale', () => {
  it('is steady when frozen and stays in a narrow band while breathing', () => {
    expect(lampScale(4, true)).toBe(1)
    for (const t of [0, 0.4, 1.2, 8]) {
      const s = lampScale(t, false)
      expect(s).toBeGreaterThanOrEqual(0.88)
      expect(s).toBeLessThanOrEqual(1)
    }
  })
})

describe('part tints', () => {
  it('separates the shell from the structure, and keeps leaf and root on the meaning colors', () => {
    expect(partTint('a', 'skin')).not.toBe(partTint('a', 'skeleton'))
    expect(partTint('p', 'bark')).not.toBe(partTint('p', 'stem'))
    expect(partTint('p', 'leaf')).toBe('#009E73')
    expect(partTint('p', 'root')).toBe('#E69F00')
    expect(partTint('p', 'spore')).toBe('#56B4E9')
  })
})
