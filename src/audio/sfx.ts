import type { OneShotId } from './policy'

/**
 * Authored lengths in seconds. The bus is kept near full scale on the loudest
 * cue, then the engine master trims full volume to about -12 dBFS.
 */
export const CUE_LENGTH_S: Record<OneShotId, number> = {
  hover: 0.034,
  press: 0.09,
  toggle: 0.15,
  wrong: 0.46,
  correct: 0.42,
  scan: 0.68,
  pickup: 0.2,
  whoosh: 0.42,
  solved: 1.5,
}

/** Bed level into the cue bus. Quiet under UI cues. */
export const AMBIENT_BUS_GAIN = 0.32

const FLOOR = 0.0001

interface ToneOpts {
  t: number
  freq: number
  freq2?: number
  dur: number
  peak: number
  attack: number
  type: OscillatorType
}

function tone(ctx: AudioContext, dest: AudioNode, o: ToneOpts): void {
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  const attack = Math.min(Math.max(o.attack, 0.004), o.dur * 0.45)
  const end = o.t + o.dur
  osc.type = o.type
  osc.frequency.setValueAtTime(Math.max(o.freq, 1), o.t)
  if (o.freq2 !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(o.freq2, 1), end)
  g.gain.setValueAtTime(FLOOR, o.t)
  g.gain.exponentialRampToValueAtTime(Math.max(o.peak, FLOOR * 2), o.t + attack)
  g.gain.exponentialRampToValueAtTime(FLOOR, end)
  osc.connect(g)
  g.connect(dest)
  osc.start(o.t)
  osc.stop(end + 0.02)
}

let noiseBuf: AudioBuffer | null = null

/** One reused noise buffer. Deterministic, softened once, never rebuilt per cue. */
function noiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noiseBuf && noiseBuf.sampleRate === ctx.sampleRate) return noiseBuf
  const n = Math.max(1, Math.floor(ctx.sampleRate * 0.6))
  const buf = ctx.createBuffer(1, n, ctx.sampleRate)
  const d = buf.getChannelData(0)
  let s = 123456789
  for (let i = 0; i < n; i++) {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0
    d[i] = s / 4294967296 * 2 - 1
  }
  let prev = 0
  for (let i = 0; i < n; i++) {
    prev = prev * 0.82 + d[i] * 0.18
    d[i] = prev * 1.8
  }
  noiseBuf = buf
  return buf
}

function noiseSweep(ctx: AudioContext, dest: AudioNode, t: number, dur: number, f0: number, f1: number, peak: number): void {
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer(ctx)
  src.loop = true
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.Q.value = 0.65
  bp.frequency.setValueAtTime(Math.max(f0, 1), t)
  bp.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur)
  const g = ctx.createGain()
  g.gain.setValueAtTime(FLOOR, t)
  g.gain.exponentialRampToValueAtTime(Math.max(peak, FLOOR * 2), t + Math.min(0.04, dur * 0.3))
  g.gain.exponentialRampToValueAtTime(FLOOR, t + dur)
  src.connect(bp)
  bp.connect(g)
  g.connect(dest)
  src.start(t)
  src.stop(t + dur + 0.02)
}

/** Schedule one cue on `dest`. Nodes are one-shot. The noise buffer is reused. */
export function scheduleCue(ctx: AudioContext, dest: AudioNode, cue: OneShotId, up = true): void {
  const t = ctx.currentTime
  switch (cue) {
    case 'hover':
      tone(ctx, dest, { t, freq: 740, freq2: 620, dur: CUE_LENGTH_S.hover, peak: 0.14, attack: 0.006, type: 'sine' })
      return
    case 'press':
      tone(ctx, dest, { t, freq: 220, freq2: 160, dur: CUE_LENGTH_S.press, peak: 0.28, attack: 0.006, type: 'sine' })
      tone(ctx, dest, { t, freq: 330, freq2: 240, dur: CUE_LENGTH_S.press, peak: 0.12, attack: 0.006, type: 'sine' })
      return
    case 'toggle':
      if (up) {
        tone(ctx, dest, { t, freq: 392, freq2: 587, dur: CUE_LENGTH_S.toggle, peak: 0.26, attack: 0.01, type: 'sine' })
        tone(ctx, dest, { t: t + 0.04, freq: 784, dur: 0.11, peak: 0.08, attack: 0.008, type: 'sine' })
      } else {
        tone(ctx, dest, { t, freq: 494, freq2: 294, dur: CUE_LENGTH_S.toggle, peak: 0.22, attack: 0.008, type: 'sine' })
      }
      return
    case 'wrong':
      tone(ctx, dest, { t, freq: 196, freq2: 146, dur: 0.28, peak: 0.2, attack: 0.01, type: 'triangle' })
      tone(ctx, dest, { t: t + 0.1, freq: 146, freq2: 110, dur: 0.32, peak: 0.16, attack: 0.01, type: 'sine' })
      tone(ctx, dest, { t: t + 0.2, freq: 98, dur: 0.26, peak: 0.12, attack: 0.012, type: 'sine' })
      return
    case 'correct':
      tone(ctx, dest, { t, freq: 523.25, dur: 0.28, peak: 0.32, attack: 0.008, type: 'sine' })
      tone(ctx, dest, { t: t + 0.07, freq: 659.25, dur: 0.3, peak: 0.28, attack: 0.008, type: 'sine' })
      tone(ctx, dest, { t: t + 0.14, freq: 783.99, dur: 0.28, peak: 0.18, attack: 0.008, type: 'triangle' })
      return
    case 'scan':
      tone(ctx, dest, { t, freq: 180, freq2: 860, dur: CUE_LENGTH_S.scan, peak: 0.22, attack: 0.02, type: 'sine' })
      tone(ctx, dest, { t, freq: 360, freq2: 720, dur: CUE_LENGTH_S.scan, peak: 0.06, attack: 0.04, type: 'sine' })
      noiseSweep(ctx, dest, t, 0.5, 300, 1100, 0.1)
      return
    case 'pickup':
      tone(ctx, dest, { t, freq: 880, freq2: 740, dur: CUE_LENGTH_S.pickup, peak: 0.26, attack: 0.005, type: 'sine' })
      tone(ctx, dest, { t, freq: 1320, freq2: 990, dur: 0.14, peak: 0.08, attack: 0.004, type: 'sine' })
      return
    case 'whoosh':
      noiseSweep(ctx, dest, t, CUE_LENGTH_S.whoosh, 220, 980, 0.32)
      tone(ctx, dest, { t, freq: 140, freq2: 70, dur: CUE_LENGTH_S.whoosh, peak: 0.1, attack: 0.02, type: 'sine' })
      return
    case 'solved':
      tone(ctx, dest, { t, freq: 110, dur: 1.5, peak: 0.4, attack: 0.08, type: 'sine' })
      tone(ctx, dest, { t: t + 0.12, freq: 220, dur: 1.2, peak: 0.2, attack: 0.04, type: 'sine' })
      tone(ctx, dest, { t: t + 0.28, freq: 277.18, dur: 1.05, peak: 0.16, attack: 0.03, type: 'sine' })
      tone(ctx, dest, { t: t + 0.42, freq: 329.63, dur: 0.95, peak: 0.16, attack: 0.03, type: 'sine' })
      tone(ctx, dest, { t: t + 0.62, freq: 440, dur: 0.88, peak: 0.18, attack: 0.02, type: 'sine' })
      noiseSweep(ctx, dest, t, 0.36, 240, 900, 0.08)
      return
  }
}
