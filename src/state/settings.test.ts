import { afterEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings, LINE_HEIGHT, TEXT_SCALE } from './settings'

describe('settings defaults', () => {
  it('has the documented defaults', () => {
    const s = defaultSettings(false)
    expect(s).toEqual({
      textSize: 0,
      lineSpacing: 0,
      reducedMotion: false,
      quality: 'auto',
      readAloudRate: 1,
      sound: false,
      showFps: false,
    })
  })

  it('defaults reduced motion from the OS preference', () => {
    expect(defaultSettings(true).reducedMotion).toBe(true)
  })

  it('sound is off by default', () => {
    expect(defaultSettings(false).sound).toBe(false)
  })

  it('has three text sizes and three line spacings, increasing', () => {
    expect(Object.keys(TEXT_SCALE)).toHaveLength(3)
    expect(TEXT_SCALE[0]).toBeLessThan(TEXT_SCALE[1])
    expect(TEXT_SCALE[1]).toBeLessThan(TEXT_SCALE[2])
    expect(LINE_HEIGHT[0]).toBeLessThan(LINE_HEIGHT[2])
  })
})

describe('store', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  function fakeStorage() {
    const data = new Map<string, string>()
    return {
      data,
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    }
  }

  it('persists under the anomaly.v1 key', async () => {
    const storage = fakeStorage()
    vi.stubGlobal('localStorage', storage)
    const { useGame, STORAGE_KEY } = await import('./store')
    expect(STORAGE_KEY).toBe('anomaly.v1')
    useGame.getState().setSettings({ textSize: 2 })
    const saved = JSON.parse(storage.data.get('anomaly.v1')!)
    expect(saved.state.settings.textSize).toBe(2)
    expect(saved.version).toBe(1)
  })

  it('creates a profile with a codename and no free text', async () => {
    vi.stubGlobal('localStorage', fakeStorage())
    const { useGame } = await import('./store')
    const p = useGame.getState().createProfile(14, 'demo!')
    expect(p.classCode).toBe('DEMO')
    expect(p.agentNumber).toBe(14)
    expect(p.codename).toMatch(/^AGENT [A-Z]+-14$/)
  })

  it('ranks rise with mastery', async () => {
    vi.stubGlobal('localStorage', fakeStorage())
    const { rankFor } = await import('./store')
    expect(rankFor({})).toBe('Recruit')
    expect(rankFor({ a: 'rookie' })).toBe('Cadet')
    expect(rankFor({ a: 'ace', b: 'expert' })).toBe('Specialist')
  })
})
