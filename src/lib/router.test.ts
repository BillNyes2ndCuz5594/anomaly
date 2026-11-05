import { describe, expect, it } from 'vitest'
import { parseHash, isUnknownHash } from './router'

describe('parseHash', () => {
  it('parses the spec routes', () => {
    expect(parseHash('')).toEqual({ name: 'title' })
    expect(parseHash('#/')).toEqual({ name: 'title' })
    expect(parseHash('#/hub')).toEqual({ name: 'hub' })
    expect(parseHash('#/settings')).toEqual({ name: 'settings' })
    expect(parseHash('#/case/03-1')).toEqual({ name: 'case', id: '03-1' })
    expect(parseHash('#/cold/residue')).toEqual({ name: 'cold', id: 'residue' })
    expect(parseHash('#/gold/02-2')).toEqual({ name: 'gold', id: '02-2' })
    expect(parseHash('#/containment/02-2')).toEqual({ name: 'containment', id: '02-2' })
    expect(parseHash('#/reactor/02-2')).toEqual({ name: 'reactor', id: '02-2' })
  })
  it('falls back to the title for unknown routes', () => {
    expect(parseHash('#/nope')).toEqual({ name: 'title' })
    expect(parseHash('#/case/<script>')).toEqual({ name: 'title' })
    expect(parseHash('#/containment/03-1')).toEqual({ name: 'title' })
    expect(parseHash('#/reactor/04-1')).toEqual({ name: 'title' })
  })
})

describe('isUnknownHash', () => {
  it('flags paths the router does not know', () => {
    expect(isUnknownHash('#/nonsense/route')).toBe(true)
    expect(isUnknownHash('#/hub/extra')).toBe(true)
  })
  it('passes known routes and the title', () => {
    for (const h of ['', '#', '#/', '#/hub', '#/settings', '#/case/00-1', '#/cold/x', '#/gold/02-2', '#/containment/02-2', '#/reactor/02-2', '#/hub?still=1']) expect(isUnknownHash(h)).toBe(false)
  })
})

describe('routeNeedsProfile', () => {
  it('correctly gates routes needing profile', async () => {
    const { routeNeedsProfile } = await import('./router')
    expect(routeNeedsProfile('title', false)).toBe(false)
    expect(routeNeedsProfile('settings', false)).toBe(false)
    expect(routeNeedsProfile('hub', false)).toBe(true)
    expect(routeNeedsProfile('case', false)).toBe(true)
    expect(routeNeedsProfile('cold', false)).toBe(true)
    expect(routeNeedsProfile('gold', false)).toBe(true)
    expect(routeNeedsProfile('containment', false)).toBe(true)
    expect(routeNeedsProfile('reactor', false)).toBe(true)
    expect(routeNeedsProfile('hub', true)).toBe(false)
    expect(routeNeedsProfile('containment', true)).toBe(false)
    expect(routeNeedsProfile('reactor', true)).toBe(false)
  })
})
