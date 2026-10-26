import { describe, expect, it } from 'vitest'
import { caseInset, hudInsets, layoutMode, type Rect } from './layout'

const rect = (left: number, top: number, right: number, bottom: number): Rect => ({ left, top, right, bottom })

describe('layoutMode', () => {
  it('maps the target devices', () => {
    expect(layoutMode(1920, 1080)).toBe('wide')
    expect(layoutMode(1366, 768)).toBe('wide')
    expect(layoutMode(1280, 800)).toBe('wide')
    expect(layoutMode(800, 1280)).toBe('stack')
    expect(layoutMode(360, 780)).toBe('stack')
    expect(layoutMode(780, 360)).toBe('compact-landscape')
  })
  it('does not call a tall narrow window compact', () => {
    expect(layoutMode(480, 500)).toBe('stack')
  })
})

describe('hudInsets', () => {
  it('desktop: right panel becomes a right inset, dock a bottom inset', () => {
    const ins = hudInsets(1366, 768, { panel: rect(918, 76, 1338, 744), dock: rect(28, 600, 890, 744), bar: rect(0, 20, 1366, 64) }, true, 420)
    expect(ins.right).toBe(1366 - 918 + 14)
    expect(ins.bottom).toBe(768 - 600 + 10)
    expect(ins.top).toBe(70)
  })
  it('phone portrait: the bottom sheet is a bottom inset, nothing on the right', () => {
    const ins = hudInsets(360, 780, { panel: rect(8, 430, 352, 772), dock: null, bar: rect(0, 6, 360, 50) }, true, 420)
    expect(ins.right).toBe(0)
    expect(ins.bottom).toBe(780 - 430 + 10)
    expect(ins.top).toBe(56)
  })
  it('phone portrait: the dock above the sheet wins when it is higher', () => {
    const ins = hudInsets(360, 780, { panel: rect(8, 470, 352, 772), dock: rect(8, 330, 352, 462), bar: null }, true, 420)
    expect(ins.bottom).toBe(780 - 330 + 10)
  })
  it('phone landscape: panel on the right half, dock bottom left', () => {
    const ins = hudInsets(780, 360, { panel: rect(400, 50, 772, 354), dock: rect(8, 260, 392, 354), bar: rect(0, 4, 780, 46) }, true, 420)
    expect(ins.right).toBe(780 - 400 + 14)
    expect(ins.bottom).toBe(360 - 260 + 10)
  })
  it('uses no desktop fallback in stacked mode and caps it on short landscape', () => {
    expect(hudInsets(360, 780, { panel: null, dock: null, bar: null }, true, 420).right).toBe(0)
    expect(hudInsets(780, 360, { panel: null, dock: null, bar: null }, true, 420).right).toBe(390)
    expect(hudInsets(1366, 768, { panel: null, dock: null, bar: null }, false, 360).right).toBe(360)
  })
  it('hub: only the panel counts when not vertical', () => {
    const ins = hudInsets(360, 780, { panel: rect(8, 400, 352, 772), dock: rect(0, 100, 360, 200), bar: rect(0, 0, 360, 60) }, false, 360)
    expect(ins).toEqual({ right: 0, top: 0, bottom: 390 })
  })
  it('keeps caseInset for the desktop fallback', () => {
    expect(caseInset('lab-a')).toBe(420)
    expect(caseInset('items')).toBe(0)
  })
})
