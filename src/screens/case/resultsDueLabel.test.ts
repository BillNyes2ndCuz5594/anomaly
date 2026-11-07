import { describe, expect, it } from 'vitest'
import { dueLabel } from './Results'

describe('dueLabel', () => {
  it('returns human empty status for null, undefined, or empty string', () => {
    expect(dueLabel(null)).toBe('No review yet')
    expect(dueLabel(undefined)).toBe('No review yet')
    expect(dueLabel('')).toBe('No review yet')
  })

  it('formats valid ISO date in UTC with weekday, month, and day', () => {
    expect(dueLabel('2026-04-12')).toBe('Sun, Apr 12')
  })
})
