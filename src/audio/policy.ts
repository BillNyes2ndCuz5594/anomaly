/** Short cues. Ambient is a bed, not a one-shot. Lengths live in sfx.ts. */
export const CUE_IDS = ['hover', 'press', 'toggle', 'wrong', 'correct', 'scan', 'pickup', 'whoosh', 'solved', 'ambient'] as const

export type CueId = (typeof CUE_IDS)[number]

export type OneShotId = Exclude<CueId, 'ambient'>

export type AudioBlock = 'still' | 'mute' | 'sound-off' | 'hidden' | 'no-gesture' | 'teacher'

export interface AudioGate {
  sound: boolean
  /** `location.search`, with or without the leading `?`. */
  search: string
  hidden: boolean
  gestured: boolean
  /** Teacher HQ plays button presses only. */
  teacher: boolean
  cue: CueId
  /** Play the sound-toggle tick while the saved flag is still the old value. */
  bypassSound?: boolean
  /**
   * Accepted so callers can show that reduced motion does not silence cues.
   * The field is not read.
   */
  reducedMotion?: boolean
}

/** `?still=1` wins over `?mute=1`. Both mean no audio at all. */
export function urlAudioBlock(search: string): 'still' | 'mute' | null {
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  if (q.get('still') === '1') return 'still'
  if (q.get('mute') === '1') return 'mute'
  return null
}

/** Why a cue must not start, or null when it may. */
export function audioBlock(g: AudioGate): AudioBlock | null {
  const url = urlAudioBlock(g.search)
  if (url) return url
  if (!g.sound && !g.bypassSound) return 'sound-off'
  if (g.hidden) return 'hidden'
  if (!g.gestured) return 'no-gesture'
  if (g.teacher && g.cue !== 'press') return 'teacher'
  return null
}
