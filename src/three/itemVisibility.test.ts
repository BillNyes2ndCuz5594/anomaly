import { describe, expect, it } from 'vitest'
import { shouldRender } from './itemVisibility'

describe('shouldRender', () => {
  it('renders while on screen and the tab is showing', () => {
    expect(shouldRender(true, false)).toBe(true)
  })
  it('pauses while scrolled off screen', () => {
    expect(shouldRender(false, false)).toBe(false)
  })
  it('pauses while the tab is hidden even on screen', () => {
    expect(shouldRender(true, true)).toBe(false)
  })
  it('stays paused when off screen and hidden', () => {
    expect(shouldRender(false, true)).toBe(false)
  })
})
