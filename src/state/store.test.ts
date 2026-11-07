import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createJSONStorage } from 'zustand/middleware'
import { makeProfile, STORAGE_KEY, useGame } from './store'

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

describe('useGame persistence merge hardening', () => {
  let local: ReturnType<typeof fakeStorage>

  beforeEach(() => {
    local = fakeStorage()
    vi.stubGlobal('localStorage', local)
    useGame.persist.setOptions({ storage: createJSONStorage(() => local) })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    useGame.setState({
      profile: null,
      intel: 0,
      paints: [],
      activePaint: null,
      lastCaseId: null,
      cases: {},
      mastery: {},
      progress: {},
      itemHistory: [],
      codex: [],
    })
  })

  it('does not overwrite action functions when rehydrating hostile keys', async () => {
    const hostileBlob = JSON.stringify({
      state: {
        recordItem: 'hostile-string',
        addIntel: null,
        unlockCodex: 12345,
        setActivePaint: false,
        setLastCaseId: 'not-a-function',
        setCaseStatus: {},
        setSettings: 'corrupted',
        createProfile: null,
        clearProfile: 99,
        intel: 42,
        profile: makeProfile(3, 'DEMO'),
      },
      version: 1,
    })

    local.setItem(STORAGE_KEY, hostileBlob)
    await useGame.persist.rehydrate()

    const st = useGame.getState()
    expect(typeof st.recordItem).toBe('function')
    expect(typeof st.addIntel).toBe('function')
    expect(typeof st.unlockCodex).toBe('function')
    expect(typeof st.setActivePaint).toBe('function')
    expect(typeof st.setLastCaseId).toBe('function')
    expect(typeof st.setCaseStatus).toBe('function')
    expect(typeof st.setSettings).toBe('function')
    expect(typeof st.createProfile).toBe('function')
    expect(typeof st.clearProfile).toBe('function')

    expect(st.intel).toBe(42)
    expect(st.profile?.agentNumber).toBe(3)

    // Gameplay actions still work
    st.addIntel(8)
    expect(useGame.getState().intel).toBe(50)

    const outcome = st.recordItem('ms-ps1-1', 'q1', true, '2026-11-06')
    expect(outcome.stage).toBeDefined()
    expect(useGame.getState().progress['ms-ps1-1']).toBeDefined()
  })

  it('safely handles truncated and malformed settings objects in merge', () => {
    const merge = useGame.persist.getOptions().merge
    if (!merge) throw new Error('merge option must be defined')

    const current = useGame.getState()

    // Non-object or null persisted state
    expect(() => merge(null, current)).not.toThrow()
    expect(() => merge(undefined, current)).not.toThrow()
    expect(() => merge('corrupted-string', current)).not.toThrow()
    expect(() => merge(12345, current)).not.toThrow()

    // Hostile keys in persisted object passed directly to merge
    const hostilePersisted = {
      recordItem: 'malicious',
      addIntel: 'malicious',
      settings: {
        textSize: 2,
        helpLevel: 'invalid-level',
      },
    }
    const mergedHostile = merge(hostilePersisted, current) as typeof current
    expect(typeof mergedHostile.recordItem).toBe('function')
    expect(typeof mergedHostile.addIntel).toBe('function')
    expect(mergedHostile.settings.textSize).toBe(2)
    expect(mergedHostile.settings.helpLevel).toBe('regular')

    // Truncated and malformed settings
    const malformedCases = [
      { settings: null },
      { settings: 'bad-settings' },
      { settings: [] },
      { settings: {} },
      { settings: { helpLevel: null } },
      { settings: { helpLevel: 'extra' } },
      { settings: { textSize: 1 } },
    ]

    for (const testCase of malformedCases) {
      expect(() => {
        const res = merge(testCase, current) as typeof current
        expect(res.settings).toBeDefined()
        expect(['extra', 'regular', 'challenge']).toContain(res.settings.helpLevel)
      }).not.toThrow()
    }
  })
})
