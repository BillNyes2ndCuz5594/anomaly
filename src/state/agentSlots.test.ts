import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createJSONStorage } from 'zustand/middleware'
import {
  agentSlotKey,
  clearOpenCheckpoints,
  loadAgentSlot,
  migrateActiveAgentSlot,
  saveAgentSlot,
  switchToAgent,
  type AgentSlotSnapshot,
} from './agentSlots'
import { applyReport } from './reportApply'
import { emptyRecord } from './mastery'
import { makeProfile, STORAGE_KEY, useGame } from './store'
import type { ReportData } from '../lib/reportCode'

function createFakeStorage() {
  const store = new Map<string, string>()
  return {
    store,
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v)
    },
    removeItem: (k: string) => {
      store.delete(k)
    },
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size
    },
  }
}

describe('agentSlots', () => {
  beforeEach(() => {
    const fakeLocal = createFakeStorage()
    vi.stubGlobal('localStorage', fakeLocal)
    vi.stubGlobal('sessionStorage', createFakeStorage())
    ;(useGame as any).persist?.setOptions({
      storage: createJSONStorage(() => fakeLocal),
    })
    useGame.setState({
      profile: null,
      mastery: {},
      progress: {},
      itemHistory: [],
      codex: [],
      intel: 0,
      paints: [],
      cases: {},
      lastCaseId: null,
    })
  })

  it('generates consistent slot keys derived from sanitized class code and agent number', () => {
    expect(agentSlotKey(14, 'demo')).toBe('anomaly.slot.DEMO.14')
    expect(agentSlotKey(1, '')).toBe('anomaly.slot..1')
    expect(agentSlotKey(99, 'abc-123!')).toBe('anomaly.slot.ABC123.40')
  })

  it('saves and loads agent slot snapshots', () => {
    const fake = createFakeStorage()
    const snap: AgentSlotSnapshot = {
      v: 1,
      agentNumber: 14,
      classCode: 'DEMO',
      profile: makeProfile(14, 'DEMO'),
      mastery: { 'SC.5.P.8.1': 'rookie' },
      progress: {
        'SC.5.P.8.1': { ...emptyRecord(), attempts: 2, correct: 2, lastSeen: '2026-11-05', stage: 'rookie', nextDue: '2026-11-06' },
      },
      itemHistory: [{ itemId: 'item-1', correct: true, date: '2026-11-05' }],
      codex: ['c1'],
      intel: 25,
      paints: ['Orange'],
      cases: { '03-1': { closed: true, date: '2026-11-05', score: 3, total: 3 } },
      lastCaseId: '03-1',
    }

    saveAgentSlot(14, 'DEMO', snap, fake)
    const loaded = loadAgentSlot(14, 'DEMO', fake)
    expect(loaded).toEqual(snap)

    // Bad version or mismatched key returns null
    fake.setItem('anomaly.slot.DEMO.14', JSON.stringify({ ...snap, v: 2 }))
    expect(loadAgentSlot(14, 'DEMO', fake)).toBeNull()

    fake.setItem('anomaly.slot.DEMO.14', 'not json')
    expect(loadAgentSlot(14, 'DEMO', fake)).toBeNull()
  })

  it('proves agent A progress is invisible to new agent B, and returning to A restores A', () => {
    // 1. Agent A starts and earns progress
    useGame.getState().createProfile(14, 'DEMO')
    useGame.getState().recordItem('SC.5.P.8.1', 'item-1', true)
    useGame.getState().addIntel(30)
    useGame.getState().unlockCodex(['codex-sun'])
    useGame.getState().setCaseStatus('03-1', { closed: true, date: '2026-11-05', score: 5, total: 5 })
    useGame.getState().setLastCaseId('03-1')

    expect(useGame.getState().profile?.codename).toContain('14')
    expect(useGame.getState().intel).toBe(30)
    expect(useGame.getState().mastery['SC.5.P.8.1']).toBeDefined()
    expect(useGame.getState().cases['03-1']).toBeDefined()
    expect(useGame.getState().lastCaseId).toBe('03-1')

    // 2. Switch to fresh Agent B (agent 20, class DEMO)
    switchToAgent(20, 'DEMO')
    const bState = useGame.getState()
    expect(bState.profile?.agentNumber).toBe(20)
    expect(bState.intel).toBe(0)
    expect(Object.keys(bState.mastery).length).toBe(0)
    expect(Object.keys(bState.progress).length).toBe(0)
    expect(bState.itemHistory.length).toBe(0)
    expect(bState.codex.length).toBe(0)
    expect(Object.keys(bState.cases).length).toBe(0)
    expect(bState.lastCaseId).toBeNull()

    // 3. Agent B earns separate progress
    useGame.getState().recordItem('SC.5.E.7.1', 'item-water-1', true)
    useGame.getState().addIntel(15)
    useGame.getState().setLastCaseId('04-1')
    expect(useGame.getState().intel).toBe(15)
    expect(useGame.getState().lastCaseId).toBe('04-1')

    // 4. Switch back to Agent A
    switchToAgent(14, 'DEMO')
    const aRestored = useGame.getState()
    expect(aRestored.profile?.agentNumber).toBe(14)
    expect(aRestored.intel).toBe(30)
    expect(aRestored.mastery['SC.5.P.8.1']).toBeDefined()
    expect(aRestored.mastery['SC.5.E.7.1']).toBeUndefined() // B's benchmark not in A
    expect(aRestored.codex).toEqual(['codex-sun'])
    expect(aRestored.cases['03-1']).toBeDefined()
    expect(aRestored.lastCaseId).toBe('03-1') // A's lastCaseId restored

    // 5. Switch back to Agent B
    switchToAgent(20, 'DEMO')
    const bRestored = useGame.getState()
    expect(bRestored.profile?.agentNumber).toBe(20)
    expect(bRestored.intel).toBe(15)
    expect(bRestored.mastery['SC.5.E.7.1']).toBeDefined()
    expect(bRestored.mastery['SC.5.P.8.1']).toBeUndefined()
    expect(bRestored.lastCaseId).toBe('04-1')
  })

  it('keeps device settings shared across agent switches', () => {
    useGame.getState().createProfile(5, 'CLASS')
    useGame.getState().setSettings({ soundVolume: 0.35, sound: false, reducedMotion: true })

    switchToAgent(6, 'CLASS')
    expect(useGame.getState().settings.soundVolume).toBe(0.35)
    expect(useGame.getState().settings.sound).toBe(false)
    expect(useGame.getState().settings.reducedMotion).toBe(true)

    // Modifying settings under agent 6 persists to agent 5
    useGame.getState().setSettings({ soundVolume: 0.9 })
    switchToAgent(5, 'CLASS')
    expect(useGame.getState().settings.soundVolume).toBe(0.9)
  })

  it('isolates lastCaseId per agent', () => {
    switchToAgent(1, 'ORL')
    useGame.getState().setLastCaseId('case-alpha')

    switchToAgent(2, 'ORL')
    expect(useGame.getState().lastCaseId).toBeNull()
    useGame.getState().setLastCaseId('case-beta')

    switchToAgent(1, 'ORL')
    expect(useGame.getState().lastCaseId).toBe('case-alpha')

    switchToAgent(2, 'ORL')
    expect(useGame.getState().lastCaseId).toBe('case-beta')
  })

  it('prevents checkpoints from crossing agents', () => {
    const fakeSession = createFakeStorage()
    fakeSession.setItem('anomaly.case.case.03-1', JSON.stringify({ v: 1, step: 'lab-a' }))
    fakeSession.setItem('anomaly.checkpoint.03-1', JSON.stringify({ v: 1, step: 'lab-b' }))
    fakeSession.setItem('unrelated.key', 'keep-me')

    clearOpenCheckpoints(fakeSession)

    expect(fakeSession.getItem('anomaly.case.case.03-1')).toBeNull()
    expect(fakeSession.getItem('anomaly.checkpoint.03-1')).toBeNull()
    expect(fakeSession.getItem('unrelated.key')).toBe('keep-me')
  })

  it('migrates existing stored player during initial store hydration and completes hasHydrated', async () => {
    // Simulating player present before PR 6 saved in localStorage under STORAGE_KEY
    const legacyState = {
      state: {
        profile: makeProfile(10, 'PREV'),
        intel: 80,
        cases: { '03-1': { closed: true, date: '2026-11-04', score: 4, total: 4 } },
        lastCaseId: '03-1',
        mastery: {},
        progress: {},
        itemHistory: [],
        codex: [],
        paints: [],
        settings: {},
      },
      version: 1,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(legacyState))
    expect(loadAgentSlot(10, 'PREV')).toBeNull()

    // Trigger store hydration
    await (useGame as any).persist.rehydrate()

    // persist.hasHydrated() must be true, not swallowed by an exception
    expect((useGame as any).persist.hasHydrated()).toBe(true)

    // Slot was automatically migrated during hydration without calling helper afterward
    const slot = loadAgentSlot(10, 'PREV')
    expect(slot).not.toBeNull()
    expect(slot?.intel).toBe(80)
    expect(slot?.lastCaseId).toBe('03-1')
    expect(useGame.getState().profile?.agentNumber).toBe(10)
  })

  it('migrates existing stored state lazily without a reset', () => {
    // Simulating player present before PR 6: profile and progress exist in useGame, but no slot key in storage
    const fakeLocal = createFakeStorage()
    useGame.setState({
      profile: makeProfile(10, 'PREV'),
      intel: 80,
      cases: { '03-1': { closed: true, date: '2026-11-04', score: 4, total: 4 } },
      lastCaseId: '03-1',
    })

    // Calling migrateActiveAgentSlot populates the slot without resetting anything
    migrateActiveAgentSlot(fakeLocal)
    const slot = loadAgentSlot(10, 'PREV', fakeLocal)
    expect(slot).not.toBeNull()
    expect(slot?.intel).toBe(80)
    expect(slot?.lastCaseId).toBe('03-1')

    // Active state remains intact
    expect(useGame.getState().intel).toBe(80)
    expect(useGame.getState().profile?.agentNumber).toBe(10)
  })

  it('same-agent confirmation does not wipe anything', () => {
    useGame.getState().createProfile(7, 'ROOM')
    useGame.getState().addIntel(45)
    useGame.getState().recordItem('SC.5.P.8.1', 'it-1', true)

    // Confirmation with the same agent number and class code
    switchToAgent(7, 'ROOM')

    expect(useGame.getState().intel).toBe(45)
    expect(useGame.getState().mastery['SC.5.P.8.1']).toBeDefined()
  })

  it('routes report-code agent switches through snapshot boundary', () => {
    // Current agent 14 with progress
    useGame.getState().createProfile(14, 'DEMO')
    useGame.getState().addIntel(50)
    useGame.getState().setLastCaseId('03-1')

    // Report belongs to agent 30 in class DEMO
    const report: ReportData = {
      version: 1,
      day: 20000,
      agent: 30,
      classHash: 0,
      benchmarks: [{ id: 'SC.5.P.8.1', attempts: 3, correct: 3, stage: 'rookie' }],
      recent: [],
    }

    // Apply report with replaceAgent = true
    applyReport(report, 'DEMO', true)

    // Current agent is now 30 with the report's benchmarks
    expect(useGame.getState().profile?.agentNumber).toBe(30)
    expect(useGame.getState().mastery['SC.5.P.8.1']).toBeDefined()
    expect(useGame.getState().intel).toBe(0)

    // Switching back to agent 14 restores original agent 14's data
    switchToAgent(14, 'DEMO')
    expect(useGame.getState().profile?.agentNumber).toBe(14)
    expect(useGame.getState().intel).toBe(50)
    expect(useGame.getState().lastCaseId).toBe('03-1')
  })

  it('clearProfile saves current snapshot and resets state to prevent relabeling leak', () => {
    useGame.getState().createProfile(12, 'CLASS')
    useGame.getState().addIntel(75)

    useGame.getState().clearProfile()
    expect(useGame.getState().profile).toBeNull()
    expect(useGame.getState().intel).toBe(0)

    // Check that agent 12's slot was saved
    const slot = loadAgentSlot(12, 'CLASS')
    expect(slot).not.toBeNull()
    expect(slot?.intel).toBe(75)

    // A new student checking in as 13 does not get agent 12's intel
    useGame.getState().createProfile(13, 'CLASS')
    expect(useGame.getState().intel).toBe(0)
  })
})
