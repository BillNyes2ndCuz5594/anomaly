import { describe, expect, it } from 'vitest'
import { carryDelta, carryForget, resetCarry } from './carry'

describe('shared element carry', () => {
  it('remembers a rect and slides a small move', () => {
    resetCarry()
    expect(carryDelta('.side-panel', { left: 10, top: 20 }, 48, true)).toBeNull()
    expect(carryDelta('.side-panel', { left: 18, top: 26 }, 48, true)).toEqual({ x: -8, y: -6 })
  })
  it('drops a jump that would cross the frame, and stays put when motion is off', () => {
    resetCarry()
    carryDelta('.dock', { left: 0, top: 0 }, 48, true)
    expect(carryDelta('.dock', { left: 400, top: 0 }, 48, true)).toBeNull()
    expect(carryDelta('.dock', { left: 12, top: 4 }, 48, false)).toBeNull()
    expect(carryDelta('.dock', { left: 20, top: 4 }, 48, true)).toEqual({ x: -8, y: 0 })
  })
  it('forgets a selector that left the screen', () => {
    resetCarry()
    carryDelta('.side-panel', { left: 4, top: 4 }, 48, true)
    carryForget('.side-panel')
    expect(carryDelta('.side-panel', { left: 20, top: 8 }, 48, true)).toBeNull()
  })
})
