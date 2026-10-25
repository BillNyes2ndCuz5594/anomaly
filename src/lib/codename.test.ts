import { describe, expect, it } from 'vitest'
import {
  CALL_SIGNS,
  clampAgentNumber,
  generateCodename,
  sanitizeClassCode,
} from './codename'

describe('codename', () => {
  it('has 40 unique call signs', () => {
    expect(CALL_SIGNS).toHaveLength(40)
    expect(new Set(CALL_SIGNS).size).toBe(40)
  })

  it('matches the spec example with no class code', () => {
    expect(generateCodename(14, '')).toBe('AGENT KESTREL-14')
  })

  it('is deterministic', () => {
    expect(generateCodename(7, 'DEMO')).toBe(generateCodename(7, 'demo'))
    expect(generateCodename(7, 'DEMO')).toBe(generateCodename(7, ' d-e m_o!'))
  })

  it('gives 40 distinct call signs to agents 1-40 in one class', () => {
    const names = new Set<string>()
    for (let n = 1; n <= 40; n++) names.add(generateCodename(n, '5TH2'))
    const signs = new Set([...names].map((s) => s.replace(/^AGENT |-\d+$/g, '')))
    expect(signs.size).toBe(40)
  })

  it('differs between classes', () => {
    const a = generateCodename(14, 'ROOM12')
    const b = generateCodename(14, 'ROOM13')
    expect(a).not.toBe(b)
  })

  it('always ends with the agent number', () => {
    expect(generateCodename(40, 'ABC')).toMatch(/-40$/)
    expect(generateCodename(1, 'ABC')).toMatch(/-1$/)
  })

  it('clamps agent numbers to 1-40', () => {
    expect(clampAgentNumber(0)).toBe(1)
    expect(clampAgentNumber(99)).toBe(40)
    expect(clampAgentNumber(Number.NaN)).toBe(1)
    expect(clampAgentNumber(12.6)).toBe(13)
  })

  it('sanitizes class codes to A-Z0-9, max 8', () => {
    expect(sanitizeClassCode('ab-12 cd!')).toBe('AB12CD')
    expect(sanitizeClassCode('abcdefghijkl')).toBe('ABCDEFGH')
    expect(sanitizeClassCode('')).toBe('')
  })

  it('never produces dashes other than the number separator', () => {
    for (let n = 1; n <= 40; n++) {
      expect(generateCodename(n, 'X')).toMatch(/^AGENT [A-Z]+-\d{1,2}$/)
    }
  })
})
