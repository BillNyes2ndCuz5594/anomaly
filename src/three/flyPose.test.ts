import { describe, expect, it } from 'vitest'
import { flyStart, noteCamera, noteWarpFly, peekCamera, resetCameraMemory, takeWarpFly, vlen, vsub, type V3 } from './flyPose'

const rest: V3 = [0, 3, 10]
const look: V3 = [0, 1, 0]

describe('fly start', () => {
  it('lands on the fitted pose when there is no push', () => {
    const p = flyStart(rest, look, null, [3, 2, 5], 0)
    expect(p[0]).toBeCloseTo(rest[0], 5)
    expect(p[1]).toBeCloseTo(rest[1], 5)
    expect(p[2]).toBeCloseTo(rest[2], 5)
  })
  it('never starts closer than the fit, so the subject only gets smaller', () => {
    const cases: V3[] = [
      [0, 0, 0],
      [3, 2.5, 5],
      [-4, 2, 4],
    ]
    for (const from of cases) {
      const p = flyStart(rest, look, [1, 4, 12], from, 0.16)
      expect(vlen(vsub(p, look))).toBeGreaterThanOrEqual(vlen(vsub(rest, look)) - 1e-6)
    }
  })
  it('ignores a previous camera that faces the other way', () => {
    const aligned = flyStart(rest, look, null, [0, 0, 0], 0.16)
    const behind = flyStart(rest, look, [0, 1, -8], [0, 0, 0], 0.16)
    expect(behind[2]).toBeGreaterThan(look[2])
    expect(behind[2]).toBeCloseTo(aligned[2], 4)
  })
})

describe('warp fly flag', () => {
  it('arms one long dolly and then clears', () => {
    noteWarpFly()
    expect(takeWarpFly()).toBe(true)
    expect(takeWarpFly()).toBe(false)
  })
})

describe('camera memory', () => {
  it('stores the last settled pose', () => {
    resetCameraMemory()
    expect(peekCamera()).toBeNull()
    noteCamera([1, 2, 3])
    expect(peekCamera()).toEqual([1, 2, 3])
    resetCameraMemory()
    expect(peekCamera()).toBeNull()
  })
})
