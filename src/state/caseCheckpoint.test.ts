import { afterEach, describe, expect, it, vi } from 'vitest'
import { caseResumeKey, loadCaseResume, restoreLab, saveCaseResume, type CaseResume } from './caseResume'
import { useSession } from './session'
import { makeProfile, useGame } from './store'
import { initLab, labReduce, type GenericLab } from '../screens/case/labGenericData'
import fixture from '../content/__fixtures__/pack-test.json'

const lab = fixture.case.lab as GenericLab
function memory() {
  const data = new Map<string, string>()
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v) }, removeItem: (k: string) => { data.delete(k) } }
}
afterEach(() => { vi.unstubAllGlobals(); useGame.setState({ profile: null }) })

describe('tab learning context', () => {
  it('rejects malformed JSON safely', () => {
    const storage = memory()
    storage.setItem(caseResumeKey('case', '03-1'), '{broken')
    expect(loadCaseResume(storage, 'case', '03-1')).toBeNull()
  })

  it('restores validated placements and the current card, but rejects all stale pairs', () => {
    const fresh = initLab(lab)
    const placed = labReduce(lab, fresh, { type: 'place', target: 'solid' })
    const saved = { step: 'lab', placed: placed.placed, current: placed.current }
    expect(restoreLab(lab, saved, 'lab').placed).toEqual({ ice: 'solid' })
    expect(restoreLab(lab, saved, 'lab').current).toBe(placed.current)
    for (const bad of [null, [], { ...saved, step: 'lab-a' }, { ...saved, current: 'gone' },
      { ...saved, placed: { ice: 'gone' } }, { ...saved, placed: { ice: 'liquid' } },
      { ...saved, placed: { ice: 'solid', gone: 'solid' } }, { ...saved, placed: [] }]) {
      expect(restoreLab(lab, bad, 'lab')).toEqual(fresh)
    }
  })

  it('validates match targets and ordered slots with the existing rules', () => {
    const match: GenericLab = { kind: 'match', intro: '', left: [{ id: 'a', name: 'A' }], right: [{ id: 'b', name: 'B' }], pairs: [{ left: 'a', right: 'b', why: '' }] }
    expect(restoreLab(match, { step: 'lab', placed: { a: 'b' }, current: null }, '').placed).toEqual({ a: 'b' })
    expect(restoreLab(match, { step: 'lab', placed: { a: 'old' }, current: null }, '').placed).toEqual({})
    const order: GenericLab = { kind: 'order', intro: '', prompt: '', steps: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], why: '' }
    expect(restoreLab(order, { step: 'lab', placed: { a: '1' }, current: null }, '').placed).toEqual({ a: '1' })
    expect(restoreLab(order, { step: 'lab', placed: { b: '1' }, current: null }, '').placed).toEqual({})
  })

  it('reopens the same agent submission without scoring again, then continues', () => {
    vi.stubGlobal('sessionStorage', memory())
    useGame.setState({ profile: makeProfile(14, 'DEMO') })
    useSession.getState().start('03-1')
    useSession.getState().go('items')
    const item = useSession.getState().items[0]
    const answer = { itemId: item.id, picked: item.key, correct: true, keyTagged: 0, eliminated: 0, hintsUsed: 0, intel: 10 }
    useSession.getState().addAnswer(answer, true, null)
    const before = useGame.getState()
    const record = vi.spyOn(before, 'recordItem')
    const intel = vi.spyOn(before, 'addIntel')
    useSession.getState().start('03-1')
    expect(useSession.getState().itemIndex).toBe(0)
    expect(useSession.getState().pendingFeedback).toEqual(answer)
    useSession.getState().addAnswer(answer, true, null)
    expect(useSession.getState().answers).toEqual([answer])
    expect(useSession.getState().stageUps).toBe(1)
    expect(record).not.toHaveBeenCalled()
    expect(intel).not.toHaveBeenCalled()
    record.mockRestore(); intel.mockRestore()
    useSession.getState().setItemIndex(1)
    useSession.getState().start('03-1')
    expect(useSession.getState().itemIndex).toBe(1)
    expect(useSession.getState().pendingFeedback).toBeNull()
    useSession.getState().saveLab(null)
    expect(loadCaseResume(sessionStorage, 'case', '03-1')?.lab).toBeNull()
  })

  it('keeps the last answer feedback until continuing to debrief', () => {
    vi.stubGlobal('sessionStorage', memory())
    useSession.getState().start('03-1')
    useSession.getState().go('items')
    const items = useSession.getState().items
    for (const [index, item] of items.entries()) {
      useSession.getState().setItemIndex(index)
      useSession.getState().addAnswer({ itemId: item.id, picked: item.key, correct: true, keyTagged: 0, eliminated: 0, hintsUsed: 0, intel: 10 }, false, null)
    }
    useSession.getState().start('03-1')
    expect(useSession.getState().step).toBe('items')
    expect(useSession.getState().itemIndex).toBe(items.length - 1)
    expect(useSession.getState().pendingFeedback?.itemId).toBe(items.at(-1)?.id)
    useSession.getState().go('debrief')
    useSession.getState().start('03-1')
    expect(useSession.getState().step).toBe('debrief')
    expect(useSession.getState().pendingFeedback).toBeNull()
  })

  it('ignores stale or malformed feedback markers and keeps the owner check', () => {
    vi.stubGlobal('sessionStorage', memory())
    useGame.setState({ profile: makeProfile(14, 'DEMO') })
    useSession.getState().start('03-1')
    useSession.getState().go('items')
    const saved = loadCaseResume(sessionStorage, 'case', '03-1') as CaseResume
    for (const marker of [{ itemId: 'gone', picked: 0 }, { itemId: saved.itemIds[0], picked: 99 }, { itemId: saved.itemIds[0], picked: 0 }, []]) {
      saveCaseResume(sessionStorage, { ...saved, pendingFeedback: marker as CaseResume['pendingFeedback'] })
      useSession.getState().start('03-1')
      expect(useSession.getState().pendingFeedback).toBeNull()
    }
    useGame.setState({ profile: makeProfile(15, 'DEMO') })
    expect(loadCaseResume(sessionStorage, 'case', '03-1')).toBeNull()
  })
})
