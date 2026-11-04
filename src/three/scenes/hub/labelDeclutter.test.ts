import { describe, expect, it } from 'vitest'
import { declutterLabels } from './labelDeclutter'

const items = Array.from({ length: 8 }, (_, i) => ({ id: String(i), x: 100, y: 100, w: 80, h: 20, priority: i === 5 ? 100 : 5 }))

describe('declutterLabels', () => {
  it('keeps the highest priority at its original position', () => {
    expect(declutterLabels(items)['5']).toEqual({ visible: true, dy: 0 })
  })
  it('keeps visible rectangles apart and hides labels without a slot', () => {
    const result = declutterLabels(items)
    const visible = items.filter((item) => result[item.id].visible)
    expect(visible).toHaveLength(3)
    for (let i = 0; i < visible.length; i++) {
      for (const b of visible.slice(i + 1)) {
        const a = visible[i]
        expect(Math.abs(a.y + result[a.id].dy - b.y - result[b.id].dy)).toBeGreaterThanOrEqual((a.h + b.h) / 2 + 4)
      }
    }
  })
  it('is deterministic, preserves priority ties, and leaves inputs unchanged', () => {
    const before = structuredClone(items)
    expect(declutterLabels(items)).toEqual(declutterLabels(items))
    expect(declutterLabels(items)['0']).toEqual({ visible: true, dy: -24 })
    expect(items).toEqual(before)
    expect(declutterLabels([])).toEqual({})
  })
})
