import { describe, expect, it } from 'vitest'
import { helpRules, normalizeHelpLevel } from './helpLevel'

describe('helpLevel', () => {
  it('normalizes valid levels', () => {
    expect(normalizeHelpLevel('extra')).toBe('extra')
    expect(normalizeHelpLevel('regular')).toBe('regular')
    expect(normalizeHelpLevel('challenge')).toBe('challenge')
  })

  it('normalizes missing or invalid levels to regular', () => {
    expect(normalizeHelpLevel(undefined)).toBe('regular')
    expect(normalizeHelpLevel(null)).toBe('regular')
    expect(normalizeHelpLevel('')).toBe('regular')
    expect(normalizeHelpLevel('unknown')).toBe('regular')
    expect(normalizeHelpLevel(123)).toBe('regular')
    expect(normalizeHelpLevel(['extra'])).toBe('regular')
    expect(normalizeHelpLevel({ level: 'challenge' })).toBe('regular')
  })

  it('determines help rules for extra help', () => {
    for (let key = 0; key < 4; key++) {
      const rules = helpRules('extra', key)
      expect(rules.canEliminate).toBe(true)
      expect(rules.autoStruck).not.toBeNull()
      expect(rules.autoStruck).not.toBe(key)
      expect([0, 1, 2, 3]).toContain(rules.autoStruck)
    }
  })

  it('determines help rules for regular', () => {
    for (let key = 0; key < 4; key++) {
      const rules = helpRules('regular', key)
      expect(rules.autoStruck).toBeNull()
      expect(rules.canEliminate).toBe(true)
    }
  })

  it('determines help rules for challenge', () => {
    for (let key = 0; key < 4; key++) {
      const rules = helpRules('challenge', key)
      expect(rules.autoStruck).toBeNull()
      expect(rules.canEliminate).toBe(false)
    }
  })
})
