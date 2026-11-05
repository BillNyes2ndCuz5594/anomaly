import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createJSONStorage } from 'zustand/middleware'
import { loadAgentSlot, switchToAgent } from './agentSlots'
import {
  DEFAULT_DRONE_PAINT_COLOR,
  DRONE_PAINT_COLORS,
  DRONE_PAINT_OPTIONS,
  dronePaintColor,
  dronePaintId,
  STORAGE_KEY,
   unlockedDronePaintOptions,
  useGame,
} from './store'
import {
  applyDroneShellPaint,
  createDroneShellMaterial,
  DEFAULT_DRONE_SHELL_COLOR,
} from '../three/scenes/hub/Drone'

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

describe('dronePaint store and material', () => {
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
      activePaint: null,
      cases: {},
      lastCaseId: null,
    })
  })

  it('rejects locked and unknown paints and keeps activePaint unchanged', () => {
    expect(useGame.getState().activePaint).toBeNull()
    expect(useGame.getState().setActivePaint('Sky')).toBe(false)
    expect(useGame.getState().setActivePaint('Orange')).toBe(false)
    expect(useGame.getState().setActivePaint('bluish-green')).toBe(false)
    expect(useGame.getState().setActivePaint('not-a-paint')).toBe(false)
    expect(useGame.getState().setActivePaint(null)).toBe(false)
    expect(useGame.getState().activePaint).toBeNull()

    // Unlock Sky only; other paints remain locked and rejected
    useGame.getState().recordItem('SC.5.P.8.1', 'item-1', true, '2026-11-05')
    expect(useGame.getState().paints).toEqual(['Sky'])
    expect(useGame.getState().setActivePaint('Sky')).toBe(true)
    expect(useGame.getState().activePaint).toBe('Sky')

    expect(useGame.getState().setActivePaint('Orange')).toBe(false)
    expect(useGame.getState().setActivePaint('Bluish green')).toBe(false)
    expect(useGame.getState().activePaint).toBe('Sky')
  })

  it('accepts any unlocked paint and updates shellMat color with default fallback', () => {
    const shellMat = createDroneShellMaterial()
    expect(`#${shellMat.color.getHexString()}`).toBe(DEFAULT_DRONE_SHELL_COLOR)
    expect(DEFAULT_DRONE_SHELL_COLOR).toBe('#738193')

    // Unlock first three paints via mastery stage-ups across benchmarks
    useGame.getState().recordItem('SC.5.P.8.1', 'item-1', true, '2026-11-05')
    useGame.getState().recordItem('SC.5.P.8.3', 'item-2', true, '2026-11-05')
    useGame.getState().recordItem('SC.5.E.7.1', 'item-3', true, '2026-11-05')

    const unlocked = useGame.getState().paints
    expect(unlocked).toEqual(['Sky', 'Orange', 'Bluish green'])
    expect(unlockedDronePaintOptions(unlocked).map((o) => o.id)).toEqual(['sky', 'orange', 'bluish-green'])

    for (const paintName of unlocked) {
      expect(useGame.getState().setActivePaint(paintName)).toBe(true)
      const st = useGame.getState()
      expect(st.activePaint).toBe(paintName)
      const applied = applyDroneShellPaint(shellMat, st.activePaint, st.paints)
      const expectedHex = DRONE_PAINT_COLORS[paintName as keyof typeof DRONE_PAINT_COLORS]
      expect(applied).toBe(expectedHex)
      expect(`#${shellMat.color.getHexString()}`).toBe(expectedHex)
    }

    // Also accepts slug id for an unlocked paint
    expect(useGame.getState().setActivePaint(dronePaintId('Bluish green'))).toBe(true)
    expect(useGame.getState().activePaint).toBe('Bluish green')

    // Locked paint passed directly to material helper falls back to default color
    expect(applyDroneShellPaint(shellMat, 'Vermillion', unlocked)).toBe(DEFAULT_DRONE_PAINT_COLOR)
    expect(`#${shellMat.color.getHexString()}`).toBe(DEFAULT_DRONE_PAINT_COLOR)

    // Verify all catalog paints map to their defined colors when unlocked
    const allLabels = DRONE_PAINT_OPTIONS.map((o) => o.label)
    for (const opt of DRONE_PAINT_OPTIONS) {
      expect(dronePaintColor(opt.label, allLabels)).toBe(opt.color)
      applyDroneShellPaint(shellMat, opt.label, allLabels)
      expect(`#${shellMat.color.getHexString()}`).toBe(opt.color)
    }

    shellMat.dispose()
  })

  it('persists activePaint across reload and sanitizes locked persisted values', async () => {
    useGame.getState().createProfile(14, 'DEMO')
    useGame.getState().recordItem('SC.5.P.8.1', 'item-1', true, '2026-11-05')
    useGame.getState().recordItem('SC.5.P.8.3', 'item-2', true, '2026-11-05')
    const chosen = useGame.getState().paints[1]
    expect(useGame.getState().setActivePaint(chosen)).toBe(true)

    const saved = localStorage.getItem(STORAGE_KEY) ?? '{}'
    const raw = JSON.parse(saved)
    expect(raw.state.activePaint).toBe(chosen)
    expect(loadAgentSlot(14, 'DEMO')?.activePaint).toBe(chosen)

    // Simulate reload by clearing in-memory activePaint while keeping saved storage intact
    useGame.setState({ activePaint: null })
    localStorage.setItem(STORAGE_KEY, saved)
    expect(useGame.getState().activePaint).toBeNull()
    await (useGame as any).persist.rehydrate()
    expect(useGame.getState().activePaint).toBe(chosen)

    // Tamper persisted storage with a locked paint and confirm rehydrate rejects it
    raw.state.activePaint = 'Cyan glow'
    localStorage.setItem(STORAGE_KEY, JSON.stringify(raw))
    await (useGame as any).persist.rehydrate()
    expect(useGame.getState().activePaint).toBeNull()
  })

  it('isolates activePaint per agent slot across switches and clearProfile', () => {
    const shellMat = createDroneShellMaterial()

    // Agent 14 unlocks two paints and selects the second one
    useGame.getState().createProfile(14, 'DEMO')
    useGame.getState().recordItem('SC.5.P.8.1', 'item-1', true, '2026-11-05')
    useGame.getState().recordItem('SC.5.P.8.3', 'item-2', true, '2026-11-05')
    const agent14Paint = useGame.getState().paints[1]
    expect(useGame.getState().setActivePaint(agent14Paint)).toBe(true)
    applyDroneShellPaint(shellMat, useGame.getState().activePaint, useGame.getState().paints)
    expect(`#${shellMat.color.getHexString()}`).toBe(dronePaintColor(agent14Paint))

    // Switch to fresh Agent 20: no paints unlocked, activePaint is null, shell resets to default
    switchToAgent(20, 'DEMO')
    expect(useGame.getState().paints).toEqual([])
    expect(useGame.getState().activePaint).toBeNull()
    applyDroneShellPaint(shellMat, useGame.getState().activePaint, useGame.getState().paints)
    expect(`#${shellMat.color.getHexString()}`).toBe(DEFAULT_DRONE_SHELL_COLOR)

    // Agent 20 unlocks one paint and selects it
    useGame.getState().recordItem('SC.5.E.7.1', 'item-3', true, '2026-11-05')
    const agent20Paint = useGame.getState().paints[0]
    expect(useGame.getState().setActivePaint(agent20Paint)).toBe(true)
    expect(useGame.getState().activePaint).toBe(agent20Paint)

    // Switch back to Agent 14: Agent 14's activePaint is restored
    switchToAgent(14, 'DEMO')
    expect(useGame.getState().activePaint).toBe(agent14Paint)
    applyDroneShellPaint(shellMat, useGame.getState().activePaint, useGame.getState().paints)
    expect(`#${shellMat.color.getHexString()}`).toBe(dronePaintColor(agent14Paint))

    // Switch back to Agent 20: Agent 20's activePaint is restored
    switchToAgent(20, 'DEMO')
    expect(useGame.getState().activePaint).toBe(agent20Paint)

    // clearProfile snapshots Agent 20 and resets activePaint in live state
    useGame.getState().clearProfile()
    expect(useGame.getState().activePaint).toBeNull()
    expect(loadAgentSlot(20, 'DEMO')?.activePaint).toBe(agent20Paint)

    shellMat.dispose()
  })
})
