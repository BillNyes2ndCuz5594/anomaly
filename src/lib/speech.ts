// Web Speech wrapper. Never throws: headless browsers and locked down laptops may have no voices.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useGame } from '../state/store'

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'
}

export function cancelSpeech(): void {
  try {
    if (speechSupported()) window.speechSynthesis.cancel()
  } catch {
    /* nothing to cancel */
  }
}

export interface SpeakOptions {
  rate?: number
  onBoundary?: (charIndex: number) => void
  /** `heard` is false when speech never actually started (no voices). */
  onEnd?: (heard: boolean) => void
}

/** Speaks text. Returns false when speech is not possible. Calls onEnd once, also on error. */
export function speak(text: string, opts: SpeakOptions = {}): boolean {
  try {
    if (!speechSupported() || !text.trim()) return false
    const synth = window.speechSynthesis
    synth.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.rate = Math.max(0.5, Math.min(1.6, opts.rate ?? 1))
    const voices = synth.getVoices?.() ?? []
    const en = voices.find((v) => v.lang?.toLowerCase().startsWith('en'))
    if (en) u.voice = en
    let ended = false
    let heard = false
    const finish = () => {
      if (ended) return
      ended = true
      opts.onEnd?.(heard)
    }
    u.onstart = () => {
      heard = true
    }
    u.onboundary = (e) => {
      heard = true
      if (e.name === 'word' || e.name === undefined) opts.onBoundary?.(e.charIndex)
    }
    u.onend = finish
    u.onerror = finish
    synth.speak(u)
    // Some browsers accept speak() and then stay silent forever when they have no voices.
    window.setTimeout(() => {
      if (!ended && !heard && !synth.speaking && !synth.pending) finish()
    }, 1500)
    return true
  } catch {
    return false
  }
}

/** Index of the word that contains charIndex, given word start offsets. */
export function wordAt(starts: number[], charIndex: number): number {
  let idx = -1
  for (let i = 0; i < starts.length; i++) {
    if (starts[i] <= charIndex) idx = i
    else break
  }
  return idx
}

export interface ReadAloud {
  supported: boolean
  speaking: boolean
  unavailable: boolean
  /** Character offset of the word currently spoken, or -1. */
  charIndex: number
  start: () => void
  stop: () => void
}

/** Hook: speaks `text` on start(). Tracks the current character from boundary events when available. */
export function useReadAloud(text: string, onStart?: () => void): ReadAloud {
  const rate = useGame((s) => s.settings.readAloudRate)
  const [speaking, setSpeaking] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const [charIndex, setCharIndex] = useState(-1)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      cancelSpeech()
    }
  }, [])

  // New text means the old utterance is stale.
  useEffect(() => {
    cancelSpeech()
    setSpeaking(false)
    setCharIndex(-1)
  }, [text])

  const stop = useCallback(() => {
    cancelSpeech()
    setSpeaking(false)
    setCharIndex(-1)
  }, [])

  const start = useCallback(() => {
    onStart?.()
    const ok = speak(text, {
      rate,
      onBoundary: (i) => alive.current && setCharIndex(i),
      onEnd: (heard) => {
        if (!alive.current) return
        setSpeaking(false)
        setCharIndex(-1)
        if (!heard) setUnavailable(true)
      },
    })
    if (ok) {
      setUnavailable(false)
      setSpeaking(true)
    } else {
      setUnavailable(true)
    }
  }, [text, rate, onStart])

  return { supported: speechSupported(), speaking, unavailable, charIndex, start, stop }
}
