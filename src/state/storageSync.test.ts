import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createJSONStorage } from 'zustand/middleware'
import { goldStorageKey } from '../modes/gold/goldRush'
import { caseResumeKey } from './caseResume'
import { handleGameStorageEvent, makeProfile, STORAGE_KEY, storedProfileDiffers, useGame } from './store'
import { adoptOtherTabAgent } from './storageSync'

function fakeStorage() {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => {
      m.set(k, v)
    },
    removeItem: (k: string) => {
      m.delete(k)
    },
  }
}

function blob(profile: ReturnType<typeof makeProfile> | null, intel = 0): string {
  return JSON.stringify({ state: { profile, intel }, version: 1 })
}

describe('cross-tab agent sync', () => {
  beforeEach(() => {
    const local = fakeStorage()
    vi.stubGlobal('localStorage', local)
    useGame.persist.setOptions({ storage: createJSONStorage(() => local) })
    useGame.setState({ profile: makeProfile(3, 'DEMO'), intel: 9 })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    useGame.setState({ profile: null, intel: 0 })
  })

  it('detects a different stored agent', () => {
    const a = makeProfile(3, 'DEMO')
    expect(storedProfileDiffers(blob(a), a)).toBe(false)
    expect(storedProfileDiffers(blob(makeProfile(7, 'DEMO')), a)).toBe(true)
    expect(storedProfileDiffers(blob(makeProfile(3, 'OTHER')), a)).toBe(true)
    expect(storedProfileDiffers(blob(null), a)).toBe(true)
    expect(storedProfileDiffers('not json', a)).toBe(false)
  })

  it('adopts the newer agent when another tab switched', async () => {
    const next = blob(makeProfile(7, 'DEMO'), 50)
    localStorage.setItem(STORAGE_KEY, next)
    handleGameStorageEvent({ key: STORAGE_KEY, newValue: next })
    await Promise.resolve()
    expect(useGame.getState().profile?.agentNumber).toBe(7)
    expect(useGame.getState().intel).toBe(50)
  })

  it('a stale tab drops its open case and practice saves and restarts at the title', () => {
    const session = fakeStorage()
    const keys: string[] = []
    const store = { ...session, get length() { return keys.length }, key: (i: number) => keys[i] ?? null,
      removeItem: (k: string) => { session.removeItem(k); keys.splice(keys.indexOf(k), 1) } }
    for (const k of [caseResumeKey('case', '04-1'), goldStorageKey('03-1'), 'anomaly.chunkReloadAt']) { keys.push(k); session.setItem(k, '1') }
    vi.stubGlobal('sessionStorage', store)
    const loc = { hash: '#/case/04-1', reload: vi.fn() }
    const adopt = () => adoptOtherTabAgent({ location: loc as unknown as Location })
    handleGameStorageEvent({ key: STORAGE_KEY, newValue: blob(makeProfile(7, 'DEMO')) }, adopt)
    expect(keys).toEqual(['anomaly.chunkReloadAt'])
    expect(loc.hash).toBe('#/')
    expect(loc.reload).toHaveBeenCalledOnce()
    vi.unstubAllGlobals()
  })

  it('does nothing for the same agent, other keys, or a removed key', () => {
    const spy = vi.spyOn(useGame.persist, 'rehydrate')
    handleGameStorageEvent({ key: STORAGE_KEY, newValue: blob(makeProfile(3, 'DEMO')) })
    handleGameStorageEvent({ key: 'other.key', newValue: blob(makeProfile(7, 'DEMO')) })
    handleGameStorageEvent({ key: STORAGE_KEY, newValue: null })
    expect(spy).not.toHaveBeenCalled()
    expect(useGame.getState().profile?.agentNumber).toBe(3)
  })
})
