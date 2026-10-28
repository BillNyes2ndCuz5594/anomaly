import type { QualitySetting } from './quality'

export type TextSize = 0 | 1 | 2
export type LineSpacing = 0 | 1 | 2

export interface Settings {
  textSize: TextSize
  lineSpacing: LineSpacing
  reducedMotion: boolean
  quality: QualitySetting
  /** Speech synthesis rate, 0.6 to 1.4. */
  readAloudRate: number
  /** Lab cues and the hub hum. On until the agent turns it off. */
  sound: boolean
  /** Master level, 0 to 1. 0.55 is the modest classroom default. */
  soundVolume: number
  showFps: boolean
}

export const TEXT_SCALE: Record<TextSize, number> = { 0: 1, 1: 1.15, 2: 1.3 }
export const LINE_HEIGHT: Record<LineSpacing, number> = { 0: 1.5, 1: 1.75, 2: 2 }
export const TEXT_SIZE_LABELS: Record<TextSize, string> = { 0: 'Normal', 1: 'Large', 2: 'Extra large' }
export const LINE_SPACING_LABELS: Record<LineSpacing, string> = { 0: 'Normal', 1: 'Relaxed', 2: 'Loose' }

/** Modest default. Full scale is still capped near -12 dBFS in the audio engine. */
export const DEFAULT_SOUND_VOLUME = 0.55

/** localStorage key for the persisted game blob. Shared with the teacher page. */
export const GAME_STORAGE_KEY = 'anomaly.v1'

export function clampSoundVolume(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_SOUND_VOLUME
  return Math.min(1, Math.max(0, n))
}

/**
 * Sound prefs from the persisted game blob. Missing data uses the defaults.
 * Teacher HQ reads this without loading the game store.
 */
export function readStoredSound(raw: string | null): { sound: boolean; volume: number } {
  const fallback = { sound: true, volume: DEFAULT_SOUND_VOLUME }
  if (!raw) return fallback
  try {
    const settings = JSON.parse(raw)?.state?.settings
    if (!settings || typeof settings !== 'object') return fallback
    return {
      sound: typeof settings.sound === 'boolean' ? settings.sound : fallback.sound,
      volume: clampSoundVolume(typeof settings.soundVolume === 'number' ? settings.soundVolume : fallback.volume),
    }
  } catch {
    return fallback
  }
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false
}

export function defaultSettings(prefersReduced: boolean = prefersReducedMotion()): Settings {
  return {
    textSize: 0,
    lineSpacing: 0,
    reducedMotion: prefersReduced,
    quality: 'auto',
    readAloudRate: 1,
    sound: true,
    soundVolume: DEFAULT_SOUND_VOLUME,
    showFps: false,
  }
}
