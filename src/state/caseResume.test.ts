import { describe, expect, it } from 'vitest'
import { caseResumeKey, clearCaseResume, loadCaseResume, saveCaseResume, type CaseResume } from './caseResume'

function fakeStorage() {
  const data = new Map<string, string>()
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  }
}

const sampleState: CaseResume = {
  v: 1, day: new Date().toDateString(), kind: 'case', caseId: '03-1', step: 'items',
  itemIds: ['item-1', 'item-2'], itemIndex: 1,
  answers: [{ itemId: 'item-1', picked: 0, correct: true, keyTagged: 0, eliminated: 0, hintsUsed: 0, intel: 10 }],
  benchmarks: ['SC.5.L.14.1'], stagesBefore: { 'SC.5.L.14.1': 'unseen' }, stageUps: 1, paint: null,
}

describe('caseResume', () => {
  it('generates the expected storage key', () => {
    expect(caseResumeKey('case', '03-1')).toBe('anomaly.case.case.03-1')
    expect(caseResumeKey('cold', 'cold-1')).toBe('anomaly.case.cold.cold-1')
  })

  it('performs a round trip save and load', () => {
    const storage = fakeStorage()
    saveCaseResume(storage, sampleState)
    expect(loadCaseResume(storage, 'case', '03-1')).toEqual(sampleState)
  })

  it('rejects bad JSON, wrong day, and mismatched case/kind', () => {
    const storage = fakeStorage()
    storage.setItem(caseResumeKey('case', '03-1'), 'invalid {')
    expect(loadCaseResume(storage, 'case', '03-1')).toBeNull()
    saveCaseResume(storage, { ...sampleState, day: 'Mon Jan 01 2020' })
    expect(loadCaseResume(storage, 'case', '03-1')).toBeNull()
    saveCaseResume(storage, sampleState)
    expect(loadCaseResume(storage, 'case', '99-9')).toBeNull()
    expect(loadCaseResume(storage, 'cold', '03-1')).toBeNull()
  })

  it('rejects state with invalid fields or types', () => {
    const storage = fakeStorage()
    const k = caseResumeKey('case', '03-1')
    for (const bad of [{ v: 2 }, { itemIndex: -1 }, { answers: [{ notAnAnswer: true }] }, { stagesBefore: 'bad' }]) {
      storage.setItem(k, JSON.stringify({ ...sampleState, ...bad }))
      expect(loadCaseResume(storage, 'case', '03-1')).toBeNull()
    }
  })

  it('clears saved state', () => {
    const storage = fakeStorage()
    saveCaseResume(storage, sampleState)
    clearCaseResume(storage, 'case', '03-1')
    expect(loadCaseResume(storage, 'case', '03-1')).toBeNull()
  })
})
