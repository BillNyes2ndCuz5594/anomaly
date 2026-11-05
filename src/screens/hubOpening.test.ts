import { describe, expect, it } from 'vitest'
import { content } from '../content'
import { CASE_ART } from './hubArt'
import { orderCasesForHub, unitNumber } from '../state/startChoice'

describe('hub opening and art', () => {
  it('has an art entry for every case id and nothing else', () => {
    const caseIds = content.cases.map((c) => c.id).sort()
    const artIds = Object.keys(CASE_ART).sort()
    expect(artIds).toEqual(caseIds)
    for (const id of caseIds) {
      expect(typeof CASE_ART[id]).toBe('string')
      expect(CASE_ART[id].length).toBeGreaterThan(0)
    }
  })

  it('splits orderCasesForHub by unit 4 gives 02-2, 04-1 first and all 10 ids exactly once', () => {
    const ordered = orderCasesForHub(content.cases)
    const current = ordered.filter((c) => unitNumber(c.unitLabel) === 4)
    const others = ordered.filter((c) => unitNumber(c.unitLabel) !== 4)

    expect(ordered.map((c) => c.id).slice(0, 2)).toEqual(['02-2', '04-1'])
    expect(current.map((c) => c.id)).toEqual(['02-2', '04-1'])
    const allIds = [...current, ...others].map((c) => c.id)
    expect(allIds).toHaveLength(10)
    expect(new Set(allIds).size).toBe(10)
    expect(allIds.slice(0, 2)).toEqual(['02-2', '04-1'])
  })
})
