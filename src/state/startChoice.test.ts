import { afterEach, describe, expect, it, vi } from 'vitest'
import { content } from '../content'
import type { Route } from '../lib/router'
import {
  caseIdFromRoute,
  DEFAULT_CASE_ID,
  orderCasesForHub,
  unitNumber,
  validCaseId,
} from './startChoice'

describe('startChoice helpers', () => {
  it('handles invalid/missing/unknown case IDs with fallback to DEFAULT_CASE_ID (04-1)', () => {
    const known = ['03-1', '04-1', '02-2']
    expect(DEFAULT_CASE_ID).toBe('04-1')
    expect(validCaseId(null, known)).toBe('04-1')
    expect(validCaseId(undefined, known)).toBe('04-1')
    expect(validCaseId('', known)).toBe('04-1')
    expect(validCaseId('99-9', known)).toBe('04-1')
    expect(validCaseId(123, known)).toBe('04-1')
    expect(validCaseId('03-1', known)).toBe('03-1')

    // When DEFAULT_CASE_ID is not in known, returns known[0]
    expect(validCaseId('unknown', ['01-1', '01-2'])).toBe('01-1')
    expect(validCaseId(null, ['01-1', '01-2'])).toBe('01-1')
  })

  it('caseIdFromRoute extracts case ID for every route name', () => {
    const caseRoute: Route = { name: 'case', id: '04-1' }
    const goldRoute: Route = { name: 'gold', id: '02-2' }
    const containmentRoute: Route = { name: 'containment', id: '02-2' }
    const reactorRoute: Route = { name: 'reactor', id: '02-2' }
    const coldRoute: Route = { name: 'cold', id: 'cold-1' }
    const hubRoute: Route = { name: 'hub' }
    const titleRoute: Route = { name: 'title' }
    const settingsRoute: Route = { name: 'settings' }
    const visualsRoute: Route = { name: 'visuals', view: 'scenes' }

    expect(caseIdFromRoute(caseRoute)).toBe('04-1')
    expect(caseIdFromRoute(goldRoute)).toBe('02-2')
    expect(caseIdFromRoute(containmentRoute)).toBe('02-2')
    expect(caseIdFromRoute(reactorRoute)).toBe('02-2')

    expect(caseIdFromRoute(coldRoute)).toBeNull()
    expect(caseIdFromRoute(hubRoute)).toBeNull()
    expect(caseIdFromRoute(titleRoute)).toBeNull()
    expect(caseIdFromRoute(settingsRoute)).toBeNull()
    expect(caseIdFromRoute(visualsRoute)).toBeNull()
  })

  it('unitNumber parses unit labels or defaults to 99 safely', () => {
    expect(unitNumber('Unit 4: Matter')).toBe(4)
    expect(unitNumber("Unit 4: Earth's Processes and Resources")).toBe(4)
    expect(unitNumber('Unit 2: Cells')).toBe(2)
    expect(unitNumber('Special Unit')).toBe(99)
    expect(unitNumber('')).toBe(99)
  })

  it('orderCasesForHub puts 04-1 and 02-2 first given real content without mutating content.cases', () => {
    const originalFirstId = content.cases[0].id
    const originalLength = content.cases.length

    const ordered = orderCasesForHub(content.cases)

    // Does not mutate
    expect(content.cases[0].id).toBe(originalFirstId)
    expect(content.cases).toHaveLength(originalLength)

    // Includes every case exactly once
    expect(ordered).toHaveLength(originalLength)
    const originalIds = [...content.cases.map((c) => c.id)].sort()
    const orderedIds = [...ordered.map((c) => c.id)].sort()
    expect(orderedIds).toEqual(originalIds)

    // 02-2 and 04-1 are Unit 4 cases and come first (in source order: 02-2 then 04-1)
    expect(ordered[0].id).toBe('02-2')
    expect(ordered[1].id).toBe('04-1')
  })
})

describe('store merge of old save without lastCaseId gives null', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  function fakeStorage(initialData: Record<string, string> = {}) {
    const data = new Map<string, string>(Object.entries(initialData))
    return {
      data,
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    }
  }

  it('store merge of old save without lastCaseId gives null', async () => {
    const storage = fakeStorage({
      'anomaly.v1': JSON.stringify({
        version: 1,
        state: {
          settings: { sound: true },
          intel: 10,
        },
      }),
    })
    vi.stubGlobal('localStorage', storage)
    const { useGame } = await import('./store')
    await useGame.persist.rehydrate()
    expect(useGame.getState().lastCaseId).toBeNull()

    useGame.getState().setLastCaseId('04-1')
    expect(useGame.getState().lastCaseId).toBe('04-1')
  })
})
