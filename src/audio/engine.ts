import { audioBlock, type AudioBlock, type CueId, type OneShotId } from './policy'
import { AMBIENT_BUS_GAIN, scheduleCue } from './sfx'
import { clampSoundVolume, DEFAULT_SOUND_VOLUME } from '../state/settings'

/** Full volume on a full-scale bus. 10^(-12/20). The compressor sits after this. */
const MASTER_AT_FULL = 0.2512

/** Hover ticks pile up if every button the pointer crosses speaks. */
export const HOVER_GAP_MS = 120
/** How long the bed fades before a hidden tab suspends the context. */
export const HIDE_FADE_S = 0.16
export const HIDE_SUSPEND_MS = 180

const AMBIENT_HZ = [55, 82.4, 164.8] as const
const AMBIENT_MIX = [0.55, 0.28, 0.08] as const

export interface PlayOpts {
  /** Toggle direction. True rises, false falls. */
  up?: boolean
  /** Ignore the sound-off flag. Still, mute, hidden, and no-gesture still block. */
  bypassSound?: boolean
}

export interface EngineOptions {
  createContext?: () => AudioContext
  search?: () => string
  hidden?: () => boolean
  now?: () => number
  teacher?: boolean
}

export interface AudioEngine {
  gesture(): void
  play(cue: OneShotId, opts?: PlayOpts): void
  setPrefs(sound: boolean, volume: number, opts?: { silent?: boolean }): void
  setAmbient(on: boolean): void
  onVisibility(): void
  /** Test hook: AudioContext instances constructed. */
  contextCount(): number
}

interface AmbientVoice {
  oscs: OscillatorNode[]
  gain: GainNode
}

function defaultCreate(): AudioContext {
  if (typeof window === 'undefined') throw new Error('no-window')
  const w = window as Window & { webkitAudioContext?: typeof AudioContext }
  const AC = window.AudioContext ?? w.webkitAudioContext
  if (!AC) throw new Error('no-audio')
  try {
    return new AC({ latencyHint: 'interactive' })
  } catch {
    return new AC()
  }
}

/**
 * One lazily created context, a shared lowpass, a master gain, and a limiter.
 * The context is constructed only when a cue is allowed to play.
 * Muted, still, and pre-gesture calls allocate nothing.
 */
export function createEngine(opts: EngineOptions = {}): AudioEngine {
  const search = opts.search ?? (() => (typeof location !== 'undefined' ? location.search : ''))
  const hidden = opts.hidden ?? (() => typeof document !== 'undefined' && document.hidden)
  const now = opts.now ?? (() => (typeof performance !== 'undefined' ? performance.now() : 0))
  const createContext = opts.createContext ?? defaultCreate
  const teacher = opts.teacher === true

  let ctx: AudioContext | null = null
  let cueBus: GainNode | null = null
  let master: GainNode | null = null
  let contexts = 0
  let sound = true
  let volume = DEFAULT_SOUND_VOLUME
  let gestured = false
  let ambientWanted = false
  let ambient: AmbientVoice | null = null
  let muteTimer: ReturnType<typeof setTimeout> | 0 = 0
  let hideTimer: ReturnType<typeof setTimeout> | 0 = 0
  const lastAt = new Map<string, number>()

  function block(cue: CueId, bypassSound = false): AudioBlock | null {
    return audioBlock({
      sound,
      search: search(),
      hidden: hidden(),
      gestured,
      teacher,
      cue,
      bypassSound,
    })
  }

  /** Context may exist and run. Teacher presses count. Ambient does not. */
  function transportOpen(): boolean {
    return (
      audioBlock({
        sound,
        search: search(),
        hidden: hidden(),
        gestured,
        teacher: false,
        cue: 'press',
      }) === null
    )
  }

  function pushMaster(): void {
    if (!master || !ctx) return
    const t = ctx.currentTime
    const next = MASTER_AT_FULL * volume
    master.gain.cancelScheduledValues(t)
    master.gain.setValueAtTime(master.gain.value, t)
    master.gain.linearRampToValueAtTime(next, t + 0.03)
  }

  function ensureCtx(): AudioContext | null {
    if (ctx) return ctx
    try {
      ctx = createContext()
      contexts += 1
      const low = ctx.createBiquadFilter()
      low.type = 'lowpass'
      low.frequency.value = 2400
      low.Q.value = 0.5
      const comp = ctx.createDynamicsCompressor()
      comp.threshold.value = -12
      comp.knee.value = 6
      comp.ratio.value = 20
      comp.attack.value = 0.003
      comp.release.value = 0.12
      master = ctx.createGain()
      master.gain.value = MASTER_AT_FULL * volume
      cueBus = ctx.createGain()
      cueBus.gain.value = 1
      cueBus.connect(low)
      low.connect(master)
      master.connect(comp)
      comp.connect(ctx.destination)
      return ctx
    } catch {
      ctx = null
      cueBus = null
      master = null
      return null
    }
  }

  function resume(): void {
    if (!ctx || ctx.state === 'running') return
    void ctx.resume().catch(() => {})
  }

  function suspend(): void {
    if (!ctx || ctx.state !== 'running') return
    void ctx.suspend().catch(() => {})
  }

  function clearMuteTimer(): void {
    if (muteTimer) {
      clearTimeout(muteTimer)
      muteTimer = 0
    }
  }

  function clearHideTimer(): void {
    if (hideTimer) {
      clearTimeout(hideTimer)
      hideTimer = 0
    }
  }

  /** Ease the bed to `target`. Values stay above the exponential-ramp floor. */
  function fadeAmbientTo(target: number, seconds: number): void {
    if (!ambient || !ctx) return
    const t = ctx.currentTime
    const g = ambient.gain.gain
    const from = Math.max(g.value, 0.0001)
    const to = Math.max(target, 0.0001)
    g.cancelScheduledValues(t)
    g.setValueAtTime(from, t)
    g.exponentialRampToValueAtTime(to, t + Math.max(0.02, seconds))
  }

  function stopAmbient(immediate: boolean): void {
    if (!ambient || !ctx) {
      ambient = null
      return
    }
    const { oscs, gain } = ambient
    ambient = null
    const t = ctx.currentTime
    try {
      gain.gain.cancelScheduledValues(t)
      if (immediate) {
        gain.gain.value = 0.0001
        for (const o of oscs) o.stop()
      } else {
        gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), t)
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.55)
        for (const o of oscs) o.stop(t + 0.6)
      }
    } catch {
      /* already stopped */
    }
  }

  function ensureAmbient(): void {
    if (!ambientWanted || ambient || teacher || !transportOpen()) return
    const audio = ensureCtx()
    if (!audio || !cueBus) return
    resume()
    const filter = audio.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 240
    filter.Q.value = 0.4
    const gain = audio.createGain()
    const t = audio.currentTime
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(AMBIENT_BUS_GAIN, t + 0.9)
    const oscs = AMBIENT_HZ.map((freq, i) => {
      const osc = audio.createOscillator()
      const mix = audio.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      mix.gain.value = AMBIENT_MIX[i]
      osc.connect(mix)
      mix.connect(filter)
      osc.start()
      return osc
    })
    filter.connect(gain)
    gain.connect(cueBus)
    ambient = { oscs, gain }
  }

  function haltNow(): void {
    clearMuteTimer()
    clearHideTimer()
    stopAmbient(true)
    suspend()
  }

  function armHalt(ms: number): void {
    clearMuteTimer()
    const id = setTimeout(() => {
      muteTimer = 0
      stopAmbient(true)
      suspend()
    }, ms)
    if (typeof id === 'object' && id && 'unref' in id) id.unref()
    muteTimer = id
  }

  function tooSoon(cue: string, gap: number): boolean {
    const t = now()
    const prev = lastAt.get(cue) ?? -1e9
    if (t - prev < gap) return true
    lastAt.set(cue, t)
    return false
  }

  return {
    contextCount: () => contexts,
    gesture() {
      gestured = true
      if (!transportOpen()) return
      ensureCtx()
      resume()
      if (ambientWanted) ensureAmbient()
    },
    play(cue, playOpts) {
      const bypass = playOpts?.bypassSound === true
      if (block(cue, bypass)) return
      const gap = cue === 'hover' ? HOVER_GAP_MS : cue === 'solved' ? 700 : cue === 'pickup' ? 80 : 40
      if (tooSoon(cue, gap)) return
      try {
        const audio = ensureCtx()
        if (!audio || !cueBus) return
        resume()
        scheduleCue(audio, cueBus, cue, playOpts?.up !== false)
      } catch {
        /* sound is optional */
      }
    },
    setPrefs(nextSound, nextVolume, prefOpts) {
      const was = sound
      sound = nextSound
      volume = clampSoundVolume(nextVolume)
      pushMaster()
      const turned = was !== sound
      if (turned && !prefOpts?.silent && gestured) this.play('toggle', { up: sound, bypassSound: true })
      if (!transportOpen()) {
        if (turned && !prefOpts?.silent && gestured && ctx) armHalt(180)
        else haltNow()
        return
      }
      clearMuteTimer()
      if (gestured) {
        ensureCtx()
        resume()
        if (ambientWanted) ensureAmbient()
      }
    },
    setAmbient(on) {
      if (teacher) return
      ambientWanted = on
      if (!on) stopAmbient(false)
      else ensureAmbient()
    },
    onVisibility() {
      if (hidden()) {
        // Let the hum fall away, then suspend. A hard suspend clicks the bed off.
        if (ambient && ctx && ctx.state === 'running') {
          fadeAmbientTo(0.0001, HIDE_FADE_S)
          clearHideTimer()
          const id = setTimeout(() => {
            hideTimer = 0
            if (hidden()) suspend()
          }, HIDE_SUSPEND_MS)
          if (typeof id === 'object' && id && 'unref' in id) id.unref()
          hideTimer = id
          return
        }
        clearHideTimer()
        suspend()
        return
      }
      clearHideTimer()
      if (!transportOpen()) {
        haltNow()
        return
      }
      resume()
      if (ambientWanted) {
        if (ambient) fadeAmbientTo(AMBIENT_BUS_GAIN, 0.45)
        else ensureAmbient()
      }
    },
  }
}
