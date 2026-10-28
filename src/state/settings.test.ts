import { afterEach, describe, expect, it, vi } from 'vitest'
import { clampSoundVolume, DEFAULT_SOUND_VOLUME, defaultSettings, LINE_HEIGHT, readStoredSound, TEXT_SCALE } from './settings'

describe('settings defaults', () => {
  it('has the documented defaults', () => {
    const s = defaultSettings(false)
    expect(s).toEqual({
      textSize: 0,
      lineSpacing: 0,
      reducedMotion: false,
      quality: 'auto',
      readAloudRate: 1,
      sound: true,
      soundVolume: DEFAULT_SOUND_VOLUME,
      showFps: false,
    })
  })

  it('defaults reduced motion from the OS preference', () => {
    expect(defaultSettings(true).reducedMotion).toBe(true)
  })

  it('sound is on by default at a modest volume', () => {
    const s = defaultSettings(false)
    expect(s.sound).toBe(true)
    expect(s.soundVolume).toBe(DEFAULT_SOUND_VOLUME)
    expect(s.soundVolume).toBeGreaterThan(0.4)
    expect(s.soundVolume).toBeLessThan(0.7)
  })

  it('clamps volume into 0 to 1 and replaces junk with the default', () => {
    expect(clampSoundVolume(0)).toBe(0)
    expect(clampSoundVolume(1)).toBe(1)
    expect(clampSoundVolume(2)).toBe(1)
    expect(clampSoundVolume(-0.2)).toBe(0)
    expect(clampSoundVolume(Number.NaN)).toBe(DEFAULT_SOUND_VOLUME)
    expect(clampSoundVolume(Number.POSITIVE_INFINITY)).toBe(DEFAULT_SOUND_VOLUME)
  })

  it('reads stored sound and fills a missing volume', () => {
    expect(readStoredSound(null)).toEqual({ sound: true, volume: DEFAULT_SOUND_VOLUME })
    expect(readStoredSound('not json')).toEqual({ sound: true, volume: DEFAULT_SOUND_VOLUME })
    expect(readStoredSound(JSON.stringify({ state: { settings: { sound: false } } }))).toEqual({
      sound: false,
      volume: DEFAULT_SOUND_VOLUME,
    })
    expect(readStoredSound(JSON.stringify({ state: { settings: { sound: true, soundVolume: 0.2 } } }))).toEqual({
      sound: true,
      volume: 0.2,
    })
    expect(readStoredSound(JSON.stringify({ state: { settings: { soundVolume: 4 } } })).volume).toBe(1)
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

  it('persists the sound switch and volume', async () => {
    const storage = fakeStorage()
    vi.stubGlobal('localStorage', storage)
    const { useGame } = await import('./store')
    useGame.getState().setSettings({ sound: false, soundVolume: 0.3 })
    const saved = JSON.parse(storage.data.get('anomaly.v1')!)
    expect(saved.state.settings.sound).toBe(false)
    expect(saved.state.settings.soundVolume).toBe(0.3)
  })

  it('keeps a saved sound flag and fills a missing volume', async () => {
    const storage = fakeStorage()
    storage.setItem(
      'anomaly.v1',
      JSON.stringify({ version: 1, state: { settings: { sound: false, textSize: 2 } } }),
    )
    vi.stubGlobal('localStorage', storage)
    const { useGame } = await import('./store')
    await useGame.persist.rehydrate()
    expect(useGame.getState().settings.sound).toBe(false)
    expect(useGame.getState().settings.soundVolume).toBe(DEFAULT_SOUND_VOLUME)
    expect(useGame.getState().settings.textSize).toBe(2)
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
