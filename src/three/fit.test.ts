import { describe, expect, it } from 'vitest'
import { fitBox, insideNdc, projectBox, sweepYaw, translateBox, unionBox, type Box } from './fit'

const body: Box = { min: [-1.4, 0, -0.5], max: [1.4, 5.2, 0.5] }
const ring: Box = { min: [-2, 0, -2], max: [2, 0.05, 2] }
const whole = unionBox(body, ring)

describe('fitBox', () => {
  it('keeps the whole box inside the view at every aspect ratio', () => {
    for (const fov of [35, 40]) {
      for (const aspect of [0.6, 1, 1.24, 1.6, 1.78, 2.4, 3]) {
        const r = fitBox(whole, { fovDeg: fov, aspect, margin: 0.08, elevation: 0.12 })
        const e = projectBox(whole, r.position, r.target, fov, aspect)
        expect(insideNdc(e), `fov ${fov} aspect ${aspect}`).toBe(true)
      }
    }
  })

  it('leaves about the requested margin and is not wasteful', () => {
    const r = fitBox(whole, { fovDeg: 35, aspect: 1.6, margin: 0.08 })
    const e = projectBox(whole, r.position, r.target, 35, 1.6)
    const used = Math.max(-e.minX, e.maxX, -e.minY, e.maxY)
    expect(used).toBeLessThanOrEqual(1 / 1.08 + 1e-3)
    expect(used).toBeGreaterThan(0.8)
  })

  it('is limited by height on wide canvases and by width on tall ones', () => {
    const wide = fitBox(body, { fovDeg: 35, aspect: 2.4 })
    const tall = fitBox(body, { fovDeg: 35, aspect: 0.5 })
    const ew = projectBox(body, wide.position, wide.target, 35, 2.4)
    const et = projectBox(body, tall.position, tall.target, 35, 0.5)
    expect(Math.max(ew.maxY, -ew.minY)).toBeGreaterThan(0.85)
    expect(Math.max(et.maxX, -et.minX)).toBeGreaterThan(0.85)
    expect(tall.distance).toBeGreaterThan(wide.distance)
  })

  it('refits when the aspect changes (resize)', () => {
    const a = fitBox(whole, { fovDeg: 35, aspect: 1.6 })
    const b = fitBox(whole, { fovDeg: 35, aspect: 0.6 })
    expect(b.distance).not.toBeCloseTo(a.distance, 2)
    expect(insideNdc(projectBox(whole, b.position, b.target, 35, 0.6))).toBe(true)
  })

  it('honours a smaller free frame (area beside a HUD panel)', () => {
    const r = fitBox(whole, { fovDeg: 40, aspect: 1.78, frame: { w: 0.6, h: 0.7 } })
    const e = projectBox(whole, r.position, r.target, 40, 1.78)
    expect(Math.max(-e.minX, e.maxX)).toBeLessThanOrEqual(0.6 / 1.08 + 1e-3)
    expect(Math.max(-e.minY, e.maxY)).toBeLessThanOrEqual(0.7 / 1.08 + 1e-3)
  })

  it('fits a box that is off center and viewed from an angle', () => {
    const b = translateBox(whole, [3, 0, -2])
    const r = fitBox(b, { fovDeg: 35, aspect: 1.3, azimuth: 0.6, elevation: 0.3 })
    expect(insideNdc(projectBox(b, r.position, r.target, 35, 1.3))).toBe(true)
  })
})

describe('sweepYaw', () => {
  it('a full spin bounds the box at every angle', () => {
    const s = sweepYaw(body, Math.PI)
    const rad = Math.hypot(1.4, 0.5)
    expect(s.max[0]).toBeCloseTo(rad, 1)
    expect(s.max[2]).toBeCloseTo(rad, 1)
    expect(s.min[1]).toBe(0)
    expect(s.max[1]).toBe(5.2)
  })
  it('a small sway grows the depth only a little', () => {
    const s = sweepYaw(body, 0.5)
    expect(s.max[0]).toBeGreaterThan(1.4)
    expect(s.max[0]).toBeLessThan(1.7)
  })
  it('a sway around an offset yaw bounds both ends', () => {
    const s = sweepYaw(body, 0.3, 24, -0.6)
    const at = (a: number) => Math.abs(1.4 * Math.cos(a)) + Math.abs(0.5 * Math.sin(a))
    expect(s.max[0]).toBeGreaterThanOrEqual(at(-0.9) - 1e-6)
    expect(s.max[0]).toBeGreaterThanOrEqual(at(-0.3) - 1e-6)
  })
  it('zero sweep keeps the box', () => {
    const s = sweepYaw(body, 0)
    expect(s.max[0]).toBeCloseTo(1.4)
    expect(s.max[2]).toBeCloseTo(0.5)
  })
})
