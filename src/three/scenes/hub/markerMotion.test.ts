import { describe, expect, it } from 'vitest'
import {
  markerAttention,
  markerGlowMul,
  markerHitRadius,
  markerPressed,
  markerScale,
  sceneCalm,
  setMarkerPressed,
  subscribeMarkerPressed,
} from './markerMotion'

const rest = { hover: false, focused: false, pressed: false }

describe('markerAttention', () => {
  it('gives hover and keyboard focus the same scale and glow', () => {
    const hover = { hover: true, focused: false, pressed: false }
    const focus = { hover: false, focused: true, pressed: false }
    expect(markerAttention(hover)).toBe('attention')
    expect(markerAttention(focus)).toBe(markerAttention(hover))
    expect(markerScale(hover)).toBe(markerScale(focus))
    expect(markerGlowMul(hover)).toBe(markerGlowMul(focus))
    expect(markerScale(hover)).toBeGreaterThan(markerScale(rest))
  })

  it('shows press even when the pointer is already down on a focused marker', () => {
    const flags = { hover: true, focused: true, pressed: true }
    expect(markerAttention(flags)).toBe('press')
    expect(markerScale(flags)).toBeLessThan(1)
    expect(markerGlowMul(flags)).toBeGreaterThan(markerGlowMul({ hover: true, focused: false, pressed: false }))
  })

  it('rests at scale 1', () => {
    expect(markerScale(rest)).toBe(1)
    expect(markerGlowMul(rest)).toBe(1)
  })
})

describe('markerHitRadius', () => {
  it('grows toward the cap when the map is far on a short screen', () => {
    const radius = markerHitRadius(360, 22, 66)
    expect(radius).toBeGreaterThan(0.55)
    expect(radius).toBeLessThanOrEqual(0.72)
  })

  it('keeps a desktop target at the floor when 44 px is already covered', () => {
    expect(markerHitRadius(1080, 12, 40)).toBe(0.55)
  })
})

describe('sceneCalm', () => {
  it('holds for reduced motion or a still frame', () => {
    expect(sceneCalm(false, false)).toBe(false)
    expect(sceneCalm(true, false)).toBe(true)
    expect(sceneCalm(false, true)).toBe(true)
  })
})

describe('marker press store', () => {
  it('notifies on a real change and ignores a repeat', () => {
    setMarkerPressed('case', false)
    setMarkerPressed('cold', false)
    let calls = 0
    const stop = subscribeMarkerPressed(() => {
      calls += 1
    })
    setMarkerPressed('case', true)
    expect(markerPressed('case')).toBe(true)
    expect(markerPressed('cold')).toBe(false)
    expect(calls).toBe(1)
    setMarkerPressed('case', true)
    expect(calls).toBe(1)
    setMarkerPressed('case', false)
    expect(markerPressed('case')).toBe(false)
    expect(calls).toBe(2)
    stop()
    setMarkerPressed('case', true)
    expect(calls).toBe(2)
    setMarkerPressed('case', false)
  })
})
