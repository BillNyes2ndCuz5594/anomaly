import { describe, expect, it } from 'vitest'
import {
  BEDROCK_ITEM_IDS, clearModeSession, isValidFeedback, isValidItemId,
  loadModeSession, MAX_TURN_TOKEN, modeSessionKey, saveModeSession,
  validateModeEnvelope, validateModeSession, type ModeSession,
} from './modeSession'

function createMemoryStorage(seed: Record<string, string> = {}) {
  const map = new Map<string, string>(Object.entries(seed))
  return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => { map.set(k, v) }, removeItem: (k: string) => { map.delete(k) } }
}

const sample = (overrides?: Partial<ModeSession>): ModeSession => ({
  version: 1, mode: 'containment', caseId: '02-2', seed: 's1', questionIndex: 0,
  phase: 'question', turnToken: 0, feedback: null, resources: { charge: 1, integrity: 3 }, board: [], ...overrides,
})

describe('modeSessionKey and envelope validation', () => {
  it('constructs versioned keys for containment and reactor', () => {
    expect(modeSessionKey('containment', '02-2')).toBe('anomaly:containment:v1:02-2')
    expect(modeSessionKey('reactor', '02-2')).toBe('anomaly:reactor:v1:02-2')
  })

  it('validates item IDs, item membership, and feedback structures', () => {
    expect(isValidItemId('E6.1-01')).toBe(true)
    for (const bad of ['', 123, null]) expect(isValidItemId(bad)).toBe(false)
    expect(isValidItemId('E6.1-01', BEDROCK_ITEM_IDS)).toBe(true)
    expect(isValidItemId('DOES-NOT-EXIST', BEDROCK_ITEM_IDS)).toBe(false)
    expect(isValidFeedback({ itemId: 'E6.1-01', correct: true })).toBe(true)
    expect(isValidFeedback({ itemId: 'E6.1-01', correct: false, explanation: 'why' })).toBe(true)
    expect(isValidFeedback({ itemId: 'DOES-NOT-EXIST', correct: true }, BEDROCK_ITEM_IDS)).toBe(false)
    for (const bad of [null, { itemId: '', correct: true }, { itemId: 'E6.1-01', correct: 'yes' }]) expect(isValidFeedback(bad)).toBe(false)
  })

  it('enforces monotonic turn token boundary below MAX_SAFE_INTEGER', () => {
    const base = sample()
    expect(validateModeEnvelope({ ...base, turnToken: MAX_TURN_TOKEN })).not.toBeNull()
    for (const bad of [Number.MAX_SAFE_INTEGER, 9007199254740992]) expect(validateModeEnvelope({ ...base, turnToken: bad })).toBeNull()
    expect(MAX_TURN_TOKEN + 1).toBe(Number.MAX_SAFE_INTEGER)
  })

  it('rejects invalid versions, ranges, and envelope fields', () => {
    const base = sample()
    expect(validateModeSession(base)).not.toBeNull()
    for (const v of [0, 2, '1', undefined]) expect(validateModeSession({ ...base, version: v })).toBeNull()
    for (const q of [-1, 11, 1.5, Number.NaN, '0']) expect(validateModeSession({ ...base, questionIndex: q })).toBeNull()
    for (const t of [-1, 1.2, Number.NaN]) expect(validateModeSession({ ...base, turnToken: t })).toBeNull()
    for (const c of ['invalid', '', '02-3']) expect(validateModeSession({ ...base, caseId: c }, { caseId: '02-2' })).toBeNull()
    expect(validateModeSession({ ...base, seed: '' })).toBeNull()
    expect(validateModeSession({ ...base, mode: 'unknown' })).toBeNull()
    for (const p of ['garbage', '', 'invalid']) expect(validateModeSession({ ...base, phase: p })).toBeNull()
  })

  it('rejects missing, nonnumeric, and out-of-bounds resources', () => {
    const base = sample()
    for (const r of [
      {}, { charge: 'bad' }, { charge: null }, { charge: undefined },
      { charge: 1 }, { integrity: 3 }, { charge: -1, integrity: 3 },
      { charge: 101, integrity: 3 }, { charge: 1, integrity: 11 },
      { charge: 1, integrity: -1 }, { charge: 1, integrity: 'bad' },
    ]) expect(validateModeSession({ ...base, resources: r })).toBeNull()

    const rBase = sample({ mode: 'reactor', resources: { instability: 4, streak: 0, shields: 0 } })
    expect(validateModeSession(rBase)).not.toBeNull()
    for (const r of [
      {}, { instability: 4 }, { instability: 'bad', streak: 0, shields: 0 },
      { instability: 11, streak: 0, shields: 0 }, { instability: -1, streak: 0, shields: 0 },
      { instability: 4, streak: -1, shields: 0 }, { instability: 4, streak: 101, shields: 0 },
      { instability: 4, streak: 0, shields: 11 }, { instability: 4, streak: 0, shields: null },
    ]) expect(validateModeSession({ ...rBase, resources: r })).toBeNull()
  })

  it('validates board structure and rejects malformed positions and entries', () => {
    const base = sample()
    expect(validateModeSession({ ...base, board: [] })).not.toBeNull()
    expect(validateModeSession({ ...base, board: [{ lane: 0, position: 1, type: 'anomaly' }] })).not.toBeNull()
    for (const b of [
      null, {}, [null], ['invalid'], [null, 'invalid'], [{}],
      [{ lane: 0 }], [{ position: 0 }], [{ lane: -1, position: 0 }],
      [{ lane: 3, position: 0 }], [{ lane: 0, position: -1 }], [{ lane: 0, position: 5 }],
      [{ lane: 'bad', position: 0 }], [{ lane: 0, position: 'bad' }],
      Array.from({ length: 31 }, () => ({ lane: 0, position: 0 })),
    ]) expect(validateModeSession({ ...base, board: b })).toBeNull()

    const rBase = sample({ mode: 'reactor', resources: { instability: 4, streak: 0, shields: 0 }, board: [] })
    expect(validateModeSession(rBase)).not.toBeNull()
    expect(validateModeSession({ ...rBase, board: [{ lane: 0, position: 0 }] })).toBeNull()
    expect(validateModeSession({ ...rBase, board: {} })).toBeNull()
  })
})

describe('modeSession storage operations', () => {
  it('handles round trips for containment and reactor sessions', () => {
    const storage = createMemoryStorage()
    const containment = sample({ board: [{ lane: 1, position: 0, type: 'magnet' }] })
    const reactor = sample({ mode: 'reactor', questionIndex: 3, resources: { instability: 3, streak: 1, shields: 0 } })
    saveModeSession(storage, 'containment', '02-2', containment)
    saveModeSession(storage, 'reactor', '02-2', reactor)
    expect(loadModeSession(storage, 'containment', '02-2')).toEqual(containment)
    expect(loadModeSession(storage, 'reactor', '02-2')).toEqual(reactor)
  })

  it('safely rejects corrupted JSON, primitives, and blocked storage', () => {
    const storage = createMemoryStorage({ 'anomaly:containment:v1:02-2': '{broken-json', 'anomaly:reactor:v1:02-2': '12345' })
    expect(loadModeSession(storage, 'containment', '02-2')).toBeNull()
    expect(loadModeSession(storage, 'reactor', '02-2')).toBeNull()
    const throwing = {
      getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('quota') }, removeItem: () => { throw new Error('disabled') },
    }
    expect(loadModeSession(throwing, 'containment', '02-2')).toBeNull()
    expect(() => saveModeSession(throwing, 'containment', '02-2', sample())).not.toThrow()
    expect(() => clearModeSession(throwing, 'containment', '02-2')).not.toThrow()
    expect(loadModeSession(null, 'containment', '02-2')).toBeNull()
  })

  it('clearing one mode leaves other modes, Gold Rush, and profile intact', () => {
    const storage = createMemoryStorage({
      'anomaly:containment:v1:02-2': JSON.stringify(sample()),
      'anomaly:reactor:v1:02-2': JSON.stringify(sample({ mode: 'reactor', resources: { instability: 1, streak: 0, shields: 0 } })),
      'anomaly:gold:02-2': JSON.stringify({ game: { intel: 10 } }),
      'anomaly.v1': JSON.stringify({ profile: { agent: 3 } }),
    })
    clearModeSession(storage, 'containment', '02-2')
    expect(loadModeSession(storage, 'containment', '02-2')).toBeNull()
    expect(loadModeSession(storage, 'reactor', '02-2')).not.toBeNull()
    expect(storage.getItem('anomaly:gold:02-2')).not.toBeNull()
    expect(storage.getItem('anomaly.v1')).not.toBeNull()
  })

  it('rejects mismatched envelopes even with an otherwise accepting callback', () => {
    const storage = createMemoryStorage()
    const acceptAll = (s: ModeSession) => s
    for (const bad of [{ version: 0 }, { mode: 'reactor' }, { caseId: '01-1' }, { turnToken: 9007199254740992 }]) {
      saveModeSession(storage, 'containment', '02-2', { ...sample(), ...bad })
      expect(loadModeSession(storage, 'containment', '02-2', acceptAll)).toBeNull()
    }
  })

  it('safely rejects malformed saved sessions on default reload', () => {
    const storage = createMemoryStorage()
    for (const bad of [
      { phase: 'garbage' }, { resources: {} }, { resources: { charge: 'bad' } },
      { resources: { charge: null } }, { resources: { charge: 1 } },
      { board: {} }, { board: [null, 'invalid'] }, { board: [{ lane: 0, position: 'bad' }] },
      { feedback: { itemId: 'DOES-NOT-EXIST', correct: true } },
    ]) {
      saveModeSession(storage, 'containment', '02-2', { ...sample(), ...bad })
      expect(loadModeSession(storage, 'containment', '02-2')).toBeNull()
    }
  })

  it('supports custom validators and catches validator exceptions', () => {
    const storage = createMemoryStorage()
    saveModeSession(storage, 'containment', '02-2', sample())
    expect(loadModeSession(storage, 'containment', '02-2', (s) => s.turnToken === 0 ? s : null)).toEqual(sample())
    expect(loadModeSession(storage, 'containment', '02-2', () => null)).toBeNull()
    expect(loadModeSession(storage, 'containment', '02-2', () => { throw new Error('fail') })).toBeNull()
  })

  it('preserves saved answer feedback across reload without duplicate rewards', () => {
    const storage = createMemoryStorage()
    type State = ModeSession<{ charge: number; integrity: number }>
    function applyAnswer(state: State, correct: boolean, token: number): State {
      if (state.turnToken !== token || state.phase !== 'question' || state.feedback !== null) return state
      return {
        ...state, phase: 'action', turnToken: state.turnToken + 1,
        feedback: { itemId: 'E6.1-01', correct },
        resources: { ...state.resources, charge: state.resources.charge + (correct ? 2 : 0) },
      }
    }
    const before = sample({ resources: { charge: 1, integrity: 3 }, turnToken: 1, phase: 'question' }) as State
    const after = applyAnswer(before, true, 1)
    expect(after.resources.charge).toBe(3); expect(after.turnToken).toBe(2)
    saveModeSession(storage, 'containment', '02-2', after)
    const reloaded = loadModeSession<State>(storage, 'containment', '02-2')
    expect(reloaded?.feedback).toEqual({ itemId: 'E6.1-01', correct: true })
    expect(reloaded?.resources).toEqual({ charge: 3, integrity: 3 })
    expect(reloaded?.turnToken).toBe(2)
    expect(applyAnswer(reloaded!, true, 1).resources.charge).toBe(3)
    expect(applyAnswer(reloaded!, true, 2).resources.charge).toBe(3)
  })
})
