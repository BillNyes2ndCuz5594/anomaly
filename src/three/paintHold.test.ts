import { describe, expect, it } from 'vitest'
import { isStageVisual, lumaSpread, meanAbsLumaDelta, visualToken } from './paintHold'
import type { Visual } from '../content/schema'

describe('paint hold', () => {
  it('scores a flat buffer at 0 and a mixed buffer higher', () => {
    const flat = new Uint8Array(16)
    flat.fill(12)
    expect(lumaSpread(flat)).toBe(0)
    const mixed = new Uint8Array([0, 0, 0, 255, 255, 255, 255, 255])
    expect(lumaSpread(mixed)).toBeGreaterThan(20)
  })

  it('tokens stage visuals and ignores tables', () => {
    const organ = { kind: 'organ', highlight: ['heart'] } as Visual
    const birds = { kind: 'specimen', ids: ['brown-pelican', 'barred-owl'], captions: ['a', 'b'] } as Visual
    const table = { kind: 'table', title: 't', columns: ['a'], rows: [['b']] } as Visual
    expect(isStageVisual(organ)).toBe(true)
    expect(isStageVisual(table)).toBe(false)
    expect(visualToken(organ)).toBe('organ:heart')
    expect(visualToken(birds)).toBe('specimen:brown-pelican,barred-owl')
    expect(visualToken(organ)).not.toBe(visualToken(birds))
  })

  it('treats a copied frame as the same picture', () => {
    const a = new Uint8Array([10, 20, 30, 255, 200, 10, 10, 255])
    expect(meanAbsLumaDelta(a, a)).toBe(0)
    const b = new Uint8Array([255, 255, 255, 255, 0, 0, 0, 255])
    expect(meanAbsLumaDelta(a, b)).toBeGreaterThan(20)
  })
})