import { describe, expect, it } from 'vitest'
import { nextWordIndex } from './rovingWords'

describe('nextWordIndex', () => {
  it('moves to next word on ArrowRight and ArrowDown', () => {
    expect(nextWordIndex(0, 'ArrowRight', 5)).toBe(1)
    expect(nextWordIndex(1, 'ArrowDown', 5)).toBe(2)
  })

  it('clamps at the end on forward arrows', () => {
    expect(nextWordIndex(4, 'ArrowRight', 5)).toBe(4)
    expect(nextWordIndex(4, 'ArrowDown', 5)).toBe(4)
  })

  it('moves to previous word on ArrowLeft and ArrowUp', () => {
    expect(nextWordIndex(3, 'ArrowLeft', 5)).toBe(2)
    expect(nextWordIndex(2, 'ArrowUp', 5)).toBe(1)
  })

  it('clamps at zero on backward arrows', () => {
    expect(nextWordIndex(0, 'ArrowLeft', 5)).toBe(0)
    expect(nextWordIndex(0, 'ArrowUp', 5)).toBe(0)
  })

  it('jumps to start on Home and end on End', () => {
    expect(nextWordIndex(3, 'Home', 5)).toBe(0)
    expect(nextWordIndex(1, 'End', 5)).toBe(4)
  })

  it('leaves index unchanged for unhandled keys', () => {
    expect(nextWordIndex(2, 'Tab', 5)).toBe(2)
    expect(nextWordIndex(2, 'Enter', 5)).toBe(2)
    expect(nextWordIndex(2, ' ', 5)).toBe(2)
  })

  it('handles empty or negative count safely', () => {
    expect(nextWordIndex(0, 'ArrowRight', 0)).toBe(0)
    expect(nextWordIndex(2, 'End', -1)).toBe(0)
  })
})
