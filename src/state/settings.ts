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
  sound: boolean
  showFps: boolean
}

export const TEXT_SCALE: Record<TextSize, number> = { 0: 1, 1: 1.15, 2: 1.3 }
export const LINE_HEIGHT: Record<LineSpacing, number> = { 0: 1.5, 1: 1.75, 2: 2 }
export const TEXT_SIZE_LABELS: Record<TextSize, string> = { 0: 'Normal', 1: 'Large', 2: 'Extra large' }
export const LINE_SPACING_LABELS: Record<LineSpacing, string> = { 0: 'Normal', 1: 'Relaxed', 2: 'Loose' }

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
    sound: false,
    showFps: false,
  }
}
