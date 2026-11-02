import { describe, expect, it } from 'vitest'
import fixture from '../content/__fixtures__/pack-test.json'
import { content, vitalsCase } from '../content'
import type { CaseDef } from '../content/schema'
import { caseStatus, hubBenchmarkGroups, shortDate } from './hubList'

const fixtureCase = fixture.case as unknown as CaseDef
const label = (id: string) => `label ${id}`

describe('hub case status', () => {
  it('reads New, Open, and Closed with the date', () => {
    expect(caseStatus(undefined)).toEqual({ word: 'New', date: null, text: 'New' })
    expect(caseStatus({ closed: false, date: '2026-10-24' }).text).toBe('Open')
    expect(caseStatus({ closed: true, date: '2026-10-24' })).toEqual({ word: 'Closed', date: 'Oct 24', text: 'Closed Oct 24' })
    expect(caseStatus({ closed: true, date: 'junk' }).text).toBe('Closed')
    expect(shortDate('2027-01-05')).toBe('Jan 5')
  })
})

describe('hub mastery groups', () => {
  it('lists every category once the packs are in, with the VITALS benchmarks under Life Science', () => {
    const g = hubBenchmarkGroups(content.cases, [], label)
    expect(g.map((x) => x.category)).toEqual(['nature', 'earth', 'physical', 'life'])
    const life = g.find((x) => x.category === 'life')
    expect(life?.label).toBe('Life Science')
    for (const b of vitalsCase.benchmarks) expect(life?.benchmarks.map((x) => x.id)).toContain(b)
    expect(life?.benchmarks.find((b) => b.id === 'SC.5.L.14.1')?.label).toBe('label SC.5.L.14.1')
  })

  it('unions every case, keeps category order, and adds benchmarks in progress once', () => {
    const g = hubBenchmarkGroups([vitalsCase, fixtureCase], ['SC.5.N.1.1', 'SC.5.L.14.1', 'SC.5.E.7.1'], label)
    expect(g.map((x) => x.category)).toEqual(['nature', 'earth', 'physical', 'life'])
    expect(g[2].benchmarks.map((b) => b.id)).toEqual(['SC.5.P.8.1', 'SC.5.P.9.1'])
    expect(g[3].benchmarks.map((b) => b.id)).toEqual(['SC.5.L.14.1', 'SC.5.L.14.2', 'SC.3.L.15.1'])
    const all = g.flatMap((x) => x.benchmarks.map((b) => b.id))
    expect(new Set(all).size).toBe(all.length)
  })
})
