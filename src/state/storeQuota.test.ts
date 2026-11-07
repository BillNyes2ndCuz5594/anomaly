import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('useGame persistence under QuotaExceededError', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new DOMException('full', 'QuotaExceededError')
      },
      removeItem: () => {},
    })
  })

  afterEach(async () => {
    const { useGame } = await import('./store')
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
    vi.unstubAllGlobals()
  })

  it('does not throw on store actions and preserves in-memory updates', async () => {
    const { useGame } = await import('./store')
    const st = useGame.getState()

    expect(() => {
      st.addIntel(25)
    }).not.toThrow()
    expect(useGame.getState().intel).toBe(25)

    expect(() => {
      st.setSettings({ sound: false })
    }).not.toThrow()
    expect(useGame.getState().settings.sound).toBe(false)

    expect(() => {
      st.setLastCaseId('case_test_quota')
    }).not.toThrow()
    expect(useGame.getState().lastCaseId).toBe('case_test_quota')

    expect(() => {
      st.setCaseStatus('case_01', {
        closed: true,
        date: '2026-11-06',
        score: 5,
        total: 5,
      })
    }).not.toThrow()
    expect(useGame.getState().cases['case_01']?.closed).toBe(true)
    expect(useGame.getState().cases['case_01']?.score).toBe(5)

    expect(() => {
      st.setCaseStatus('03-1', 'done' as any)
    }).not.toThrow()
    expect(useGame.getState().cases['03-1']).toBe('done')

    expect(() => {
      st.recordItem('SC.5.L.14.1', 'item-x', true)
    }).not.toThrow()
    const state = useGame.getState()
    expect(state.progress['SC.5.L.14.1']).toBeDefined()
    expect(state.progress['SC.5.L.14.1'].attempts).toBe(1)
    expect(state.progress['SC.5.L.14.1'].correct).toBe(1)
    expect(state.mastery['SC.5.L.14.1']).toBeDefined()
    expect(state.mastery['SC.5.L.14.1']).not.toBe('unseen')

    expect(() => {
      st.unlockCodex(['entry_1', 'entry_2'])
    }).not.toThrow()
    expect(useGame.getState().codex).toEqual(['entry_1', 'entry_2'])
  })
})
