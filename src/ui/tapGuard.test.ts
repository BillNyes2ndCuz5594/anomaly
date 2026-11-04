import { describe, expect, it } from 'vitest'
import { createTapGuard } from './tapGuard'

describe('tap guard', () => {
  it('accepts only one submit in the same event turn until the item changes', () => {
    const guard = createTapGuard()
    expect(Array.from({ length: 30 }, () => guard('item', Infinity, 0)).filter(Boolean)).toHaveLength(1)
    expect(guard('item', Infinity, 10000)).toBe(false)
    expect(guard('next item', Infinity, 10000)).toBe(true)
  })
  it('checks a success feedback lock without extending it', () => {
    const guard = createTapGuard()
    expect(guard('feedback', 0, 0)).toBe(true)
    expect(guard('feedback', 400, 0)).toBe(true)
    expect(guard('feedback', 0, 200)).toBe(false)
    expect(guard('feedback', 0, 400)).toBe(true)
  })
  it('throttles feedback per target without delaying a different answer', () => {
    const guard = createTapGuard()
    expect(guard('wrong', 450, 0)).toBe(true)
    expect(guard('wrong', 450, 449)).toBe(false)
    expect(guard('right', 450, 449)).toBe(true)
    expect(guard('wrong', 450, 450)).toBe(true)
  })
})
