import { describe, expect, it } from 'vitest'
import { createLoadGate } from './loadGate'

describe('createLoadGate', () => {
  it('admits the first call synchronously and rejects subsequent calls until settled', () => {
    const gate = createLoadGate()
    expect(gate.isBusy('case-01')).toBe(false)
    expect(gate.admit('case-01')).toBe(true)
    expect(gate.isBusy('case-01')).toBe(true)
    expect(gate.admit('case-01')).toBe(false)

    gate.settle('case-01')
    expect(gate.isBusy('case-01')).toBe(false)
    expect(gate.admit('case-01')).toBe(true)
  })

  it('keeps track of distinct keys independently', () => {
    const gate = createLoadGate()
    expect(gate.admit('case-01')).toBe(true)
    expect(gate.admit('case-02')).toBe(true)
    expect(gate.admit('case-01')).toBe(false)
    expect(gate.admit('case-02')).toBe(false)

    gate.settle('case-01')
    expect(gate.admit('case-01')).toBe(true)
    expect(gate.admit('case-02')).toBe(false)
  })

  it('clears all busy flags on clear', () => {
    const gate = createLoadGate()
    gate.admit('a')
    gate.admit('b')
    gate.clear()
    expect(gate.isBusy('a')).toBe(false)
    expect(gate.isBusy('b')).toBe(false)
    expect(gate.admit('a')).toBe(true)
  })
})
