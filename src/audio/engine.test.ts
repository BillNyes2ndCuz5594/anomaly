import { describe, expect, it } from 'vitest'
import { createEngine, type AudioEngine } from './engine'
import type { OneShotId } from './policy'

class Param {
  value = 0
  setValueAtTime(v: number): void {
    this.value = v
  }
  linearRampToValueAtTime(v: number): void {
    this.value = v
  }
  exponentialRampToValueAtTime(v: number): void {
    this.value = v
  }
  cancelScheduledValues(): void {}
}

class Node {
  connect(): this {
    return this
  }
  disconnect(): void {}
}

class Gain extends Node {
  gain = new Param()
}

class Osc extends Node {
  type = 'sine'
  frequency = new Param()
  started = 0
  stopped = 0
  start(): void {
    this.started += 1
  }
  stop(): void {
    this.stopped += 1
  }
}

class Filter extends Node {
  type = 'lowpass'
  frequency = new Param()
  Q = new Param()
  gain = new Param()
}

class Comp extends Node {
  threshold = new Param()
  knee = new Param()
  ratio = new Param()
  attack = new Param()
  release = new Param()
}

class Buf {
  length: number
  sampleRate: number
  numberOfChannels = 1
  duration: number
  private data: Float32Array
  constructor(length: number, sampleRate: number) {
    this.length = length
    this.sampleRate = sampleRate
    this.duration = length / sampleRate
    this.data = new Float32Array(length)
  }
  getChannelData(): Float32Array {
    return this.data
  }
}

class Src extends Node {
  buffer: Buf | null = null
  loop = false
  start(): void {}
  stop(): void {}
}

class FakeCtx {
  sampleRate = 8000
  currentTime = 0
  state = 'suspended'
  destination = new Node()
  oscs: Osc[] = []
  resumes = 0
  suspends = 0
  createGain(): Gain {
    return new Gain()
  }
  createOscillator(): Osc {
    const osc = new Osc()
    this.oscs.push(osc)
    return osc
  }
  createBiquadFilter(): Filter {
    return new Filter()
  }
  createDynamicsCompressor(): Comp {
    return new Comp()
  }
  createBuffer(_ch: number, length: number, sampleRate: number): Buf {
    return new Buf(length, sampleRate)
  }
  createBufferSource(): Src {
    return new Src()
  }
  resume(): Promise<void> {
    this.resumes += 1
    this.state = 'running'
    return Promise.resolve()
  }
  suspend(): Promise<void> {
    this.suspends += 1
    this.state = 'suspended'
    return Promise.resolve()
  }
}

function harness(patch?: { teacher?: boolean }) {
  const env = { search: '', hidden: false, now: 0 }
  const ctxs: FakeCtx[] = []
  const engine: AudioEngine = createEngine({
    teacher: patch?.teacher,
    search: () => env.search,
    hidden: () => env.hidden,
    now: () => env.now,
    createContext: () => {
      const ctx = new FakeCtx()
      ctxs.push(ctx)
      return ctx as unknown as AudioContext
    },
  })
  return { env, ctxs, engine }
}

const ONE_SHOTS: OneShotId[] = ['hover', 'press', 'toggle', 'wrong', 'correct', 'scan', 'pickup', 'whoosh', 'solved']

describe('audio engine gates', () => {
  it('does not construct a context before the first gesture', () => {
    const { engine, ctxs } = harness()
    engine.setPrefs(true, 0.55, { silent: true })
    engine.setAmbient(true)
    engine.play('press')
    engine.play('solved')
    expect(ctxs).toHaveLength(0)
  })

  it('does not construct a context for ?still=1 or ?mute=1, even after a gesture', () => {
    const still = harness()
    still.env.search = '?tier=high&still=1'
    still.engine.setPrefs(true, 1, { silent: true })
    still.engine.gesture()
    still.engine.setAmbient(true)
    still.engine.play('press')
    still.engine.play('toggle', { bypassSound: true, up: false })
    expect(still.ctxs).toHaveLength(0)

    const mute = harness()
    mute.env.search = '?mute=1'
    mute.engine.setPrefs(true, 1, { silent: true })
    mute.engine.gesture()
    mute.engine.play('whoosh')
    mute.engine.play('correct')
    expect(mute.ctxs).toHaveLength(0)
  })

  it('does not construct a context while sound is off', () => {
    const { engine, ctxs } = harness()
    engine.setPrefs(false, 0.55, { silent: true })
    engine.gesture()
    engine.setAmbient(true)
    engine.play('press')
    engine.play('hover')
    expect(ctxs).toHaveLength(0)
  })

  it('constructs one context on the first allowed gesture and reuses it', () => {
    const { engine, ctxs } = harness()
    engine.setPrefs(true, 0.55, { silent: true })
    engine.gesture()
    expect(ctxs).toHaveLength(1)
    engine.play('press')
    engine.play('whoosh')
    expect(engine.contextCount()).toBe(1)
    expect(ctxs[0].oscs.length).toBeGreaterThan(0)
    expect(ctxs[0].state).toBe('running')
  })

  it('starts the ambient bed only after a gesture, and not while muted', () => {
    const { engine, ctxs } = harness()
    engine.setPrefs(true, 0.55, { silent: true })
    engine.setAmbient(true)
    expect(ctxs).toHaveLength(0)
    engine.gesture()
    expect(ctxs).toHaveLength(1)
    const bed = ctxs[0].oscs.length
    expect(bed).toBe(3)
    engine.play('hover')
    expect(ctxs[0].oscs.length).toBeGreaterThan(bed)
  })

  it('suspends the context when the tab is hidden and does not schedule cues there', () => {
    const { engine, ctxs, env } = harness()
    engine.setPrefs(true, 0.55, { silent: true })
    engine.gesture()
    engine.play('press')
    const before = ctxs[0].oscs.length
    env.hidden = true
    engine.onVisibility()
    expect(ctxs[0].suspends).toBe(1)
    expect(ctxs[0].state).toBe('suspended')
    engine.play('correct')
    expect(ctxs[0].oscs.length).toBe(before)
  })

  it('plays nothing for teacher cues except button presses', () => {
    const { engine, ctxs } = harness({ teacher: true })
    engine.setPrefs(true, 0.55, { silent: true })
    engine.gesture()
    engine.setAmbient(true)
    engine.play('correct')
    engine.play('whoosh')
    engine.play('scan')
    engine.play('solved')
    expect(ctxs[0].oscs).toHaveLength(0)
    engine.play('press')
    expect(ctxs[0].oscs.length).toBeGreaterThan(0)
  })

  it('schedules every one-shot without throwing', () => {
    for (const cue of ONE_SHOTS) {
      const { engine, ctxs } = harness()
      engine.setPrefs(true, 0.55, { silent: true })
      engine.gesture()
      engine.play(cue, { up: false })
      expect(ctxs[0].oscs.length).toBeGreaterThan(0)
    }
  })

  it('drops a second copy of the same cue in the same instant', () => {
    const { engine, ctxs } = harness()
    engine.setPrefs(true, 0.55, { silent: true })
    engine.gesture()
    engine.play('press')
    const n = ctxs[0].oscs.length
    engine.play('press')
    expect(ctxs[0].oscs.length).toBe(n)
  })
})
