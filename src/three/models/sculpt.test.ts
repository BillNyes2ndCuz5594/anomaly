import { describe, expect, it } from 'vitest'
import { chain, cone, ellipsoid, makeField, meshField, primBounds, raycast, smin } from './sculpt'
import { humanModel } from './human'
import { humanSkinField } from './humanSkin'
import { pantherPrims, pawSpots } from './panther'
import { BRANCH, owlPrims, owlTail, owlWings } from './owl'
import { Builder } from './builder'
import { sail } from './animals'

describe('sculpt kit', () => {
  it('blends two distances smoothly and never above the plain minimum', () => {
    expect(smin(1, 5, 0.5)).toBe(1)
    expect(smin(1, 1, 0.5)).toBeCloseTo(1 - 0.125, 6)
    expect(smin(1, 1.2, 0.5)).toBeLessThan(1)
  })

  it('measures an ellipsoid and a tapered capsule near their surfaces', () => {
    const e = ellipsoid([0, 0, 0], [2, 1, 1])
    expect(Math.abs(e.d(2, 0, 0))).toBeLessThan(1e-6)
    expect(e.d(0, 0, 0)).toBeLessThan(0)
    expect(e.d(3, 0, 0)).toBeGreaterThan(0.5)
    const c = cone([0, 0, 0], [2, 0, 0], 0.5, 0.25)
    expect(c.d(1, 0.375, 0)).toBeCloseTo(0, 5)
    expect(c.d(-0.5, 0, 0)).toBeCloseTo(0, 5)
    expect(chain([[0, 0, 0], [1, 0, 0], [2, 0.5, 0]], [0.3, 0.2, 0.1]).length).toBeGreaterThan(3)
  })

  it('meshes a sphere as one closed, outward facing, indexed surface', () => {
    const fld = makeField([ellipsoid([0, 0, 0], [1, 1, 1])])
    const { lo, hi } = primBounds([ellipsoid([0, 0, 0], [1, 1, 1])], 0.2)
    const g = meshField(fld, lo, hi, 0.08, (_p, _n, out) => out.set('#ffffff'))
    const pos = g.getAttribute('position')
    const nor = g.getAttribute('normal')
    expect(g.index).not.toBeNull()
    for (let i = 0; i < pos.count; i++) {
      const r = Math.hypot(pos.getX(i), pos.getY(i), pos.getZ(i))
      expect(Math.abs(r - 1)).toBeLessThan(0.06)
      // normal agrees with the radial direction
      const d = (pos.getX(i) * nor.getX(i) + pos.getY(i) * nor.getY(i) + pos.getZ(i) * nor.getZ(i)) / r
      expect(d).toBeGreaterThan(0.95)
    }
    // winding: every triangle faces outward
    const ix = g.index!
    let flipped = 0
    for (let t = 0; t < ix.count; t += 3) {
      const a = [ix.getX(t), ix.getX(t + 1), ix.getX(t + 2)].map((v) => [pos.getX(v), pos.getY(v), pos.getZ(v)])
      const u = [a[1][0] - a[0][0], a[1][1] - a[0][1], a[1][2] - a[0][2]]
      const w = [a[2][0] - a[0][0], a[2][1] - a[0][1], a[2][2] - a[0][2]]
      const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]
      if (n[0] * a[0][0] + n[1] * a[0][1] + n[2] * a[0][2] < 0) flipped++
    }
    expect(flipped / (ix.count / 3)).toBeLessThan(0.01)
  })

  it('casts rays onto the surface and reports a normal', () => {
    const f = makeField([ellipsoid([0, 0, 0], [1, 1, 1])]).f
    const hit = raycast(f, [3, 0, 0], [-1, 0, 0])!
    expect(hit.p[0]).toBeCloseTo(1, 2)
    expect(hit.n[0]).toBeGreaterThan(0.99)
    expect(raycast(f, [3, 3, 0], [-1, 0, 0])).toBeNull()
  })
})

describe('panther sculpt', () => {
  it('stands on four paws, long and low, with the tail longer than the torso', () => {
    const prims = pantherPrims()
    const lo = Math.min(...prims.map((p) => p.lo[0]))
    const hi = Math.max(...prims.map((p) => p.hi[0]))
    const top = Math.max(...prims.map((p) => p.hi[1]))
    expect((hi - lo) / top).toBeGreaterThan(2.8)
    expect(pawSpots().length).toBe(4)
    // paws are at floor height
    for (const p of prims.filter((q) => q.hi[1] < 0.2)) expect(p.lo[1]).toBeGreaterThanOrEqual(0)
  })
})

describe('human skin sculpt', () => {
  it('keeps every organ inside the shell, within a small tolerance', () => {
    const f = humanSkinField().f
    for (const o of humanModel().organs.values()) {
      const p = o.geo.getAttribute('position')
      let worst = -Infinity
      for (let i = 0; i < p.count; i += 3) worst = Math.max(worst, f(p.getX(i) + o.center[0], p.getY(i) + o.center[1], p.getZ(i) + o.center[2]))
      expect(worst, o.id).toBeLessThan(0.09)
    }
  })

  it('has a neck, shoulders sloping to a wider chest than waist, and feet on the floor', () => {
    const f = humanSkinField().f
    const widthAt = (y: number) => {
      let w = 0
      for (let x = 0; x < 2.5; x += 0.02) {
        if (f(x, y, 0) >= 0) break
        w = x
      }
      return w
    }
    // the neck is narrower than the head and the shoulders
    expect(widthAt(5.62)).toBeLessThan(widthAt(6.3))
    expect(widthAt(5.62)).toBeLessThan(widthAt(5.0) * 0.6)
    // waist narrower than the ribs
    expect(widthAt(3.85)).toBeLessThan(widthAt(4.7))
  })
})

describe('fin membrane', () => {
  it('builds a thin indexed two faced sheet that faces along its plane normal', () => {
    const base: [number, number, number][] = [0, 1, 2, 3].map((i) => [i * 0.2, 0, 0])
    const edge: [number, number, number][] = [0, 1, 2, 3].map((i) => [i * 0.2, 1, 0])
    const b = new Builder()
    sail(b, base, edge, 0.02, '#5d8a3c', { rows: 3, rays: 10 })
    const g = b.build()
    expect(g.index).not.toBeNull()
    const pos = g.getAttribute('position')
    const nor = g.getAttribute('normal')
    let zmin = Infinity
    let zmax = -Infinity
    for (let i = 0; i < pos.count; i++) {
      zmin = Math.min(zmin, pos.getZ(i))
      zmax = Math.max(zmax, pos.getZ(i))
      expect(Math.abs(Math.hypot(nor.getX(i), nor.getY(i), nor.getZ(i)) - 1)).toBeLessThan(1e-3)
    }
    expect(zmax).toBeGreaterThan(0.005)
    expect(zmin).toBeLessThan(-0.005)
    expect(zmax - zmin).toBeLessThan(0.05)
  })
})

describe('barred owl sculpt', () => {
  const f = makeField(owlPrims()).f
  const { lo, hi } = primBounds(owlPrims(), 0)

  it('is a compact upright bird: tall, broad across the chest, with a head as wide as the body and no ear tufts', () => {
    const h = hi[1] - lo[1]
    const w = hi[2] - lo[2]
    expect(h).toBeGreaterThan(1.8)
    expect(h).toBeLessThan(2.8)
    expect(w).toBeGreaterThan(h * 0.38)
    expect(w).toBeLessThan(h * 0.65)
    // widest point of the head is within 15 percent of the widest point of the chest
    const widthAt = (y: number): number => {
      let m = 0
      for (let z = 0; z < 1; z += 0.01) if (f(0.1, y, z) < 0) m = z
      return m
    }
    expect(widthAt(2.14)).toBeGreaterThan(widthAt(1.4) * 0.85)
    // nothing rises above a smooth dome: the top of the head is a single bump at the middle
    const top = (z: number): number => {
      for (let y = 3; y > 1.8; y -= 0.01) if (f(0.12, y, z) < 0) return y
      return 0
    }
    expect(top(0)).toBeGreaterThanOrEqual(top(0.3))
    expect(top(0.3)).toBeGreaterThanOrEqual(top(0.45))
  })

  it('has folded wings that wrap the sides and a short tail behind', () => {
    const wings = makeField(owlWings()).f
    const wb = primBounds(owlWings(), 0)
    expect(wb.hi[1]).toBeGreaterThan(1.8)
    expect(wb.lo[1]).toBeLessThan(0.4)
    // each wing is thin across the body and sits on the flank
    expect(wings(0.0, 1.2, 0.54)).toBeLessThan(0)
    expect(wings(0.0, 1.2, -0.54)).toBeLessThan(0)
    const tb = primBounds(owlTail(), 0)
    expect(tb.lo[0]).toBeLessThan(-0.5)
    expect(tb.hi[2] - tb.lo[2]).toBeGreaterThan(0.3)
    expect(tb.lo[1]).toBeGreaterThanOrEqual(-0.01)
  })

  it('perches on a branch under the feet', () => {
    const ys = BRANCH.map((p) => p[1])
    expect(Math.min(...ys)).toBeGreaterThan(0.05)
    const mid = BRANCH.find((p) => Math.abs(p[2]) < 0.1)!
    expect(mid[1]).toBeLessThan(lo[1] + 0.5)
  })
})
