import { afterEach, describe, expect, it } from 'vitest'
import { caseResumeKey, caseResumeOwner, loadCaseResume, saveCaseResume, type CaseResume } from './caseResume'
import { makeProfile, useGame } from './store'

function memory() {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => {
      m.set(k, v)
    },
  }
}

function resume(owner: string): CaseResume {
  return {
    v: 1,
    owner,
    day: new Date().toDateString(),
    kind: 'case',
    caseId: '03-1',
    step: 'items',
    itemIds: ['a'],
    itemIndex: 0,
    answers: [],
    benchmarks: ['SC.5.P.8.1'],
    stagesBefore: {},
    stageUps: 0,
    paint: null,
  }
}

describe('case checkpoint ownership', () => {
  afterEach(() => {
    useGame.setState({ profile: null })
  })

  it('builds the owner from the sanitized class code and agent number', () => {
    expect(caseResumeOwner(makeProfile(14, 'demo'))).toBe(caseResumeOwner({ classCode: 'DEMO', agentNumber: 14 }))
    expect(caseResumeOwner({ classCode: 'DEMO', agentNumber: 14 })).not.toBe(
      caseResumeOwner({ classCode: 'DEMO', agentNumber: 15 }),
    )
    expect(caseResumeOwner({ classCode: 'DEMO', agentNumber: 14 })).not.toBe(
      caseResumeOwner({ classCode: 'OTHER', agentNumber: 14 }),
    )
  })

  it('loads a checkpoint for the agent who wrote it', () => {
    useGame.setState({ profile: makeProfile(14, 'DEMO') })
    const store = memory()
    saveCaseResume(store, resume(caseResumeOwner()))
    expect(loadCaseResume(store, 'case', '03-1')?.caseId).toBe('03-1')
  })

  it('rejects a checkpoint when a different agent is active', () => {
    useGame.setState({ profile: makeProfile(14, 'DEMO') })
    const store = memory()
    saveCaseResume(store, resume(caseResumeOwner()))

    useGame.setState({ profile: makeProfile(20, 'DEMO') })
    expect(loadCaseResume(store, 'case', '03-1')).toBeNull()

    useGame.setState({ profile: makeProfile(14, 'OTHER') })
    expect(loadCaseResume(store, 'case', '03-1')).toBeNull()
  })

  it('accepts an explicit owner and rejects a mismatch', () => {
    const store = memory()
    saveCaseResume(store, resume('DEMO|14'))
    expect(loadCaseResume(store, 'case', '03-1', 'DEMO|14')).not.toBeNull()
    expect(loadCaseResume(store, 'case', '03-1', 'DEMO|15')).toBeNull()
  })

  it('treats an old checkpoint with no owner as a mismatch', () => {
    useGame.setState({ profile: makeProfile(14, 'DEMO') })
    const store = memory()
    const old: Record<string, unknown> = { ...resume(caseResumeOwner()) }
    delete old.owner
    store.setItem(caseResumeKey('case', '03-1'), JSON.stringify(old))
    expect(loadCaseResume(store, 'case', '03-1')).toBeNull()
  })
})
