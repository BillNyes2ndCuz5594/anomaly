import { describe, expect, it } from 'vitest'
import { parseHash } from './router'

describe('parseHash', () => {
  it('parses the spec routes', () => {
    expect(parseHash('')).toEqual({ name: 'title' })
    expect(parseHash('#/')).toEqual({ name: 'title' })
    expect(parseHash('#/hub')).toEqual({ name: 'hub' })
    expect(parseHash('#/settings')).toEqual({ name: 'settings' })
    expect(parseHash('#/case/03-1')).toEqual({ name: 'case', id: '03-1' })
    expect(parseHash('#/cold/residue')).toEqual({ name: 'cold', id: 'residue' })
  })
  it('falls back to the title for unknown routes', () => {
    expect(parseHash('#/nope')).toEqual({ name: 'title' })
    expect(parseHash('#/case/<script>')).toEqual({ name: 'title' })
  })
})
