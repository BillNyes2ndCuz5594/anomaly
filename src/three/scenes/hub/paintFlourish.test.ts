import { describe, expect, it } from 'vitest'
import { claimFlourish, flourishFor, glowAmount, PAINT_SEEN_KEY, readSeen, rollAngle } from './paintFlourish'

function mem(initial?: string) {
  const m = new Map<string, string>()
  if (initial !== undefined) m.set(PAINT_SEEN_KEY, initial)
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m }
}

describe('paint flourish by mode', () => {
  it('rolls in full, glows in fade, nothing in still', () => {
    expect(flourishFor('full')).toBe('roll')
    expect(flourishFor('fade')).toBe('glow')
    expect(flourishFor('still')).toBe('none')
  })
})

describe('paint flourish fires once per unlock', () => {
  it('fires for an unseen paint, then not again', () => {
    const s = mem()
    expect(claimFlourish('full', 1, s)).toBe('roll')
    expect(claimFlourish('full', 1, s)).toBe('none')
    expect(s.m.get(PAINT_SEEN_KEY)).toBe('1')
  })

  it('fires again when another paint unlocks', () => {
    const s = mem('1')
    expect(claimFlourish('full', 1, s)).toBe('none')
    expect(claimFlourish('fade', 2, s)).toBe('glow')
    expect(claimFlourish('fade', 2, s)).toBe('none')
  })

  it('does nothing with no paints', () => {
    expect(claimFlourish('full', 0, mem())).toBe('none')
  })

  it('still plays nothing but marks the paint seen', () => {
    const s = mem()
    expect(claimFlourish('still', 1, s)).toBe('none')
    expect(claimFlourish('full', 1, s)).toBe('none')
  })

  it('treats junk storage as zero and survives blocked storage', () => {
    expect(readSeen(mem('abc'))).toBe(0)
    expect(readSeen(mem('-3'))).toBe(0)
    const broken = { getItem: () => { throw new Error('x') }, setItem: () => { throw new Error('x') } }
    expect(claimFlourish('full', 1, broken)).toBe('roll')
    expect(claimFlourish('full', 1, null)).toBe('roll')
  })
})

describe('paint flourish curves', () => {
  it('rolls one full turn, eased', () => {
    expect(rollAngle(0)).toBe(0)
    expect(rollAngle(1)).toBeCloseTo(Math.PI * 2)
    expect(rollAngle(0.5)).toBeCloseTo(Math.PI)
    expect(rollAngle(2)).toBeCloseTo(Math.PI * 2)
  })
  it('glow peaks mid way', () => {
    expect(glowAmount(0)).toBeCloseTo(0)
    expect(glowAmount(0.5)).toBeCloseTo(1)
    expect(glowAmount(1)).toBeCloseTo(0)
  })
})
