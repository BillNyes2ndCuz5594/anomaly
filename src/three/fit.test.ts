import { describe, expect, it } from 'vitest'
import { fillFraction, fitBox, fitPoints, hull2d, insideNdc, meanProjectedArea, outlinePoints, pointsBox, polygonArea, projectBox, projectPoints, ringPoints, sphereDirections, sweepPoints, sweepYaw, translateBox, unionBox, yawPoints, boxCorners, type Box, type V3 } from './fit'

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


describe('silhouette fit', () => {
  const wideFlat: Box = { min: [-3, 0, -0.8], max: [3, 0.7, 0.8] }
  const tallNarrow: Box = { min: [-0.5, 0, -0.5], max: [0.5, 3.4, 0.5] }
  const opts = { fovDeg: 35, aspect: 646 / 282, margin: 0.08, elevation: 0.24 }

  it('a wide flat box and a tall narrow box both fill about the same share of the frame', () => {
    const fills = [wideFlat, tallNarrow].map((b) => {
      const pts = sweepPoints(boxCorners(b), 0.3, 12, -0.55)
      const pose = fitPoints(pts, opts)
      expect(insideNdc(projectPoints(pts, pose.position, pose.target, 35, opts.aspect))).toBe(true)
      return fillFraction(pts, pose, opts)
    })
    for (const f of fills) expect(f).toBeGreaterThan(0.93)
    expect(Math.abs(fills[0] - fills[1])).toBeLessThan(0.06)
  })

  it('fitting the displayed yaw range beats fitting a full spin for a wide flat shape', () => {
    const shown = sweepPoints(boxCorners(wideFlat), 0.3, 12, -0.55)
    const spin = sweepPoints(boxCorners(wideFlat), Math.PI, 36)
    const a = fitPoints(shown, opts)
    const b = fitPoints(spin, opts)
    // Same shape, same view: the camera sits closer (the shape is drawn larger) when only the shown angles count.
    expect(a.distance).toBeLessThan(b.distance * 0.95)
    expect(fillFraction(shown, b, opts)).toBeLessThan(0.97)
  })

  it('fits the real silhouette tighter than the corners of the turned bounding box', () => {
    // A long thin plate turned 40 degrees: the axis aligned box around it is much wider than the plate itself.
    const plate = boxCorners({ min: [-3, 0, -0.1], max: [3, 0.3, 0.1] })
    const turned = yawPoints(plate, 0.7)
    const tightBox = fitBox(pointsBox(turned), opts)
    const tight = fitPoints(turned, opts)
    expect(tight.distance).toBeLessThan(tightBox.distance)
  })

  it('keeps every point inside the frame, at wide and tall aspects, with a free frame', () => {
    const pts = sweepPoints(boxCorners(wideFlat), 0.5, 12, -0.4)
    for (const aspect of [0.6, 1.3, 2.3, 3]) {
      const o = { fovDeg: 35, aspect, margin: 0.1, elevation: 0.2, frame: { w: 0.7, h: 0.8 } }
      const pose = fitPoints(pts, o)
      const e = projectPoints(pts, pose.position, pose.target, 35, aspect)
      expect(Math.max(-e.minX, e.maxX)).toBeLessThanOrEqual(0.7 / 1.1 + 1e-3)
      expect(Math.max(-e.minY, e.maxY)).toBeLessThanOrEqual(0.8 / 1.1 + 1e-3)
    }
  })

  it('fitBox gives the same pose as fitPoints on the box corners', () => {
    const a = fitBox(wideFlat, opts)
    const b = fitPoints(boxCorners(wideFlat), opts)
    expect(a.distance).toBeCloseTo(b.distance, 6)
  })
})

describe('point set helpers', () => {
  it('hull and area of a unit square with an interior point', () => {
    const h = hull2d([[0, 0], [1, 0], [1, 1], [0, 1], [0.5, 0.5]])
    expect(h.length).toBe(4)
    expect(polygonArea(h)).toBeCloseTo(1, 9)
  })

  it('outlinePoints keeps real vertices that reach the extremes of a cloud', () => {
    const cloud: number[] = []
    for (let i = 0; i < 500; i++) cloud.push(Math.sin(i * 1.7) * 2, Math.cos(i * 0.9) * 0.5 + 0.5, Math.sin(i * 0.37) * 1)
    const pts = outlinePoints(cloud, 64)
    expect(pts.length).toBeLessThan(80)
    const box = pointsBox(pts)
    let maxX = -Infinity
    for (let i = 0; i < cloud.length; i += 3) maxX = Math.max(maxX, cloud[i])
    expect(box.max[0]).toBeCloseTo(maxX, 9)
    for (const p of pts) {
      const found = (() => {
        for (let i = 0; i < cloud.length; i += 3) if (cloud[i] === p[0] && cloud[i + 1] === p[1] && cloud[i + 2] === p[2]) return true
        return false
      })()
      expect(found).toBe(true)
    }
  })

  it('sphereDirections are unit length', () => {
    for (const d of sphereDirections(40)) expect(Math.hypot(...d)).toBeCloseTo(1, 6)
  })

  it('sweepPoints and ringPoints', () => {
    const pts: V3[] = [[1, 0, 0]]
    expect(sweepPoints(pts, 0, 8, 0)).toHaveLength(1)
    expect(sweepPoints(pts, 1, 8, 0)).toHaveLength(9)
    for (const r of ringPoints(2, 0.1, 16)) expect(Math.hypot(r[0], r[2])).toBeCloseTo(2, 9)
  })

  it('projected area is larger side on than end on for a long box', () => {
    const pts = boxCorners({ min: [-2, 0, -0.3], max: [2, 1, 0.3] })
    expect(meanProjectedArea(pts, 0, 0.01, 0)).toBeGreaterThan(meanProjectedArea(pts, Math.PI / 2, 0.01, 0) * 3)
  })
})
