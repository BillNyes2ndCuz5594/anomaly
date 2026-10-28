import { describe, expect, it } from 'vitest'
import { COUNT_MS, countValue, parseCountText } from './countUp'

describe('countValue', () => {
  it('starts at 0, ends exactly on the target and never goes backwards', () => {
    expect(countValue(5, -100)).toBe(0)
    expect(countValue(5, 0)).toBe(0)
    expect(countValue(5, COUNT_MS)).toBe(5)
    expect(countValue(5, COUNT_MS * 3)).toBe(5)
    let last = 0
    for (let t = 0; t <= COUNT_MS; t += 16) {
      const v = countValue(40, t)
      expect(v).toBeGreaterThanOrEqual(last)
      expect(v).toBeLessThanOrEqual(40)
      last = v
    }
  })
  it('eases out: more than half way after half the time', () => {
    expect(countValue(100, COUNT_MS / 2)).toBeGreaterThan(50)
  })
})

describe('parseCountText', () => {
  it('finds the first number and the text around it', () => {
    expect(parseCountText('3 OF 5 CORRECT')).toEqual({ before: '', n: 3, after: ' OF 5 CORRECT' })
    expect(parseCountText('12')).toEqual({ before: '', n: 12, after: '' })
  })
  it('returns null without a number', () => {
    expect(parseCountText('CASE CLOSED')).toBeNull()
  })
})
