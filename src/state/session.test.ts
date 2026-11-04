import { beforeEach, describe, expect, it, vi } from 'vitest'
import fixture from '../content/__fixtures__/pack-test.json'
import type { CaseDef } from '../content/schema'

function fakeStorage() {
  const data = new Map<string, string>()
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  }
}

const fixtureCase = fixture.case as unknown as CaseDef

describe('case steps', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', fakeStorage())
    vi.stubGlobal('sessionStorage', fakeStorage())
  })

  it('keeps the seven VITALS steps', async () => {
    const { stepsFor } = await import('./session')
    const { vitalsCase } = await import('../content')
    const ids = ['briefing', 'lab-a', 'lab-b', 'lab-c', 'items', 'debrief', 'results']
    expect(stepsFor('case', vitalsCase).map((s) => s.id)).toEqual(ids)
    expect(stepsFor('case').map((s) => s.id)).toEqual(ids)
  })

  it('gives every other case one Field Lab', async () => {
    const { stepsFor } = await import('./session')
    const steps = stepsFor('case', fixtureCase)
    expect(steps.map((s) => s.id)).toEqual(['briefing', 'lab', 'items', 'debrief', 'results'])
    expect(steps.map((s) => s.label)).toEqual(['Briefing', 'Field Lab', 'Evidence', 'Debrief', 'Results'])
  })

  it('leaves the cold case alone', async () => {
    const { stepsFor } = await import('./session')
    expect(stepsFor('cold', fixtureCase).map((s) => s.id)).toEqual(['briefing', 'items', 'debrief', 'results'])
  })

  it('starts VITALS with its case, plan and benchmarks, and walks its steps', async () => {
    const { useSession } = await import('./session')
    useSession.getState().start('03-1', 'case')
    const s = useSession.getState()
    expect(s.caseDef?.id).toBe('03-1')
    expect(s.items.map((i) => i.benchmark)).toEqual(['SC.5.L.14.1', 'SC.5.L.14.1', 'SC.5.L.14.2', 'SC.5.L.14.2', 'SC.3.L.15.1'])
    expect(s.benchmarks).toEqual(['SC.5.L.14.1', 'SC.5.L.14.2', 'SC.3.L.15.1'])
    s.next()
    expect(useSession.getState().step).toBe('lab-a')
  })

  it('a generic case steps from briefing to the Field Lab to the evidence', async () => {
    const { useSession } = await import('./session')
    useSession.setState({ caseId: '90-1', caseDef: fixtureCase, kind: 'case', step: 'briefing' })
    useSession.getState().next()
    expect(useSession.getState().step).toBe('lab')
    useSession.getState().next()
    expect(useSession.getState().step).toBe('items')
  })

  it('has no case on the cold case', async () => {
    const { useSession } = await import('./session')
    const { loadAllPacks } = await import('../content')
    await loadAllPacks()
    useSession.getState().start('cold-1', 'cold')
    expect(useSession.getState().caseDef).toBeNull()
    expect(useSession.getState().items.every((i) => i.pool === 'cold')).toBe(true)
  })

  it('resumes case progress on reload and clears when reaching results', async () => {
    const { useSession } = await import('./session')
    useSession.getState().start('03-1', 'case')
    const originalIds = useSession.getState().items.map((i) => i.id)

    useSession.getState().go('items')
    const answer = { itemId: originalIds[0], picked: 0, correct: true, keyTagged: 0, eliminated: 0, hintsUsed: 0, intel: 10 }
    useSession.getState().addAnswer(answer, false, null)
    useSession.getState().setItemIndex(1)

    useSession.setState({ caseId: null, caseDef: null, step: 'briefing', items: [], itemIndex: 0, answers: [] })
    useSession.getState().start('03-1', 'case')
    const resumed = useSession.getState()
    expect(resumed.step).toBe('items')
    expect(resumed.itemIndex).toBe(1)
    expect(resumed.items.map((i) => i.id)).toEqual(originalIds)
    expect(resumed.answers.length).toBe(1)

    resumed.go('results')
    expect(sessionStorage.getItem('anomaly.case.case.03-1')).toBeNull()
  })

  it('clamps itemIndex to answers length and advances to debrief if items completed', async () => {
    const { useSession } = await import('./session')
    useSession.getState().start('03-1', 'case')
    const items = useSession.getState().items
    useSession.getState().go('items')
    for (const item of items) {
      useSession.getState().addAnswer({ itemId: item.id, picked: 0, correct: true, keyTagged: 0, eliminated: 0, hintsUsed: 0, intel: 10 }, false, null)
    }
    useSession.getState().setItemIndex(0)
    useSession.setState({ caseId: null, items: [], answers: [], itemIndex: 0 })

    useSession.getState().start('03-1', 'case')
    expect(useSession.getState().step).toBe('debrief')
    expect(useSession.getState().itemIndex).toBe(items.length)
  })
})
