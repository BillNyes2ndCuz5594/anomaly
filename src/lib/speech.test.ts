import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { caseById } from '../content'
import type { MatchLab } from '../content/schema'
import { advanceLab, labSpeechText } from '../screens/case/LabGeneric'
import { initLab } from '../screens/case/labGenericData'
import { preferredEnglishVoice, speak } from './speech'

const lab = caseById('04-1')!.lab as MatchLab

type SpeechEvent = { type: 'cancel' | 'speak'; text?: string; voice?: string; local?: boolean }
let events: SpeechEvent[] = []

function voice(name: string, lang: string, localService: boolean): SpeechSynthesisVoice {
  return { name, lang, localService } as SpeechSynthesisVoice
}

describe('lab read aloud', () => {
  beforeEach(() => {
    events = []
    const voices = [voice('Remote English', 'en-US', false), voice('Local English', 'en-GB', true)]
    const synth = {
      speaking: false,
      pending: false,
      cancel() { events.push({ type: 'cancel' }); this.speaking = false },
      getVoices: () => voices,
      // oxlint-disable-next-line typescript/no-explicit-any -- browser speech mock
      speak(u: any) {
        events.push({ type: 'speak', text: u.text, voice: u.voice?.name, local: u.voice?.localService })
        this.speaking = true
        u.onstart?.({})
      },
    }
    vi.stubGlobal('window', { speechSynthesis: synth, setTimeout: () => 0 })
    vi.stubGlobal('SpeechSynthesisUtterance', class {
      text: string
      rate = 1
      voice: SpeechSynthesisVoice | null = null
      onstart: ((event: unknown) => void) | null = null
      onboundary: ((event: unknown) => void) | null = null
      onend: (() => void) | null = null
      onerror: (() => void) | null = null
      constructor(text: string) { this.text = text }
    })
  })

  afterEach(() => vi.unstubAllGlobals())

  it('speaks the current mixture, every current tool, descriptions, and hint', () => {
    const st = initLab(lab)
    const text = labSpeechText(lab, st, '04-1')
    expect(text).toContain(lab.intro)
    expect(text).toContain('Choose a tool for the mixture shown. Tap a tool name below.')
    expect(text).toContain('A correct match moves to the next mixture on its own.')
    expect(text).toContain(lab.left[0].name)
    expect(text).toContain(lab.left[0].card)
    for (const tool of lab.right) {
      expect(text).toContain(tool.name)
      expect(text).toContain(tool.card)
    }
    expect(text).toContain('Which card does this one go with?')
  })

  it('keeps mixture directions out of the CURRENT energy lab', () => {
    const energy = caseById('05-1')!.lab as MatchLab
    const text = labSpeechText(energy, initLab(energy), '05-1')
    expect(text).toContain(energy.intro)
    expect(text).not.toContain('Choose a tool for the mixture shown.')
    expect(text).not.toContain('next mixture')
  })

  it('cancels an old utterance immediately when the card advances', () => {
    const first = initLab(lab)
    const firstText = labSpeechText(lab, first, '04-1')
    expect(speak(firstText)).toBe(true)
    expect(events.find((event) => event.type === 'speak')).toMatchObject({ text: firstText, voice: 'Local English', local: true })
    events = []

    const advanced = advanceLab(lab, first, { type: 'place', target: 'magnet' })
    expect(events).toEqual([{ type: 'cancel' }])
    expect(advanced.current).toBe('gravel-sand')

    const nextText = labSpeechText(lab, advanced, '04-1')
    expect(nextText).toContain('Gravel and sand')
    expect(nextText).toContain(lab.pairs[0].why)
    expect(nextText).not.toContain('Hold a magnet over it.')
    speak(nextText)
    expect(events.at(-1)).toMatchObject({ type: 'speak', text: nextText })
  })
})

describe('voice preference', () => {
  it('uses a local English voice first, then any English voice', () => {
    const remote = voice('Remote English', 'en-US', false)
    const local = voice('Local English', 'en-GB', true)
    const localOtherLanguage = voice('Local Other', 'fr-FR', true)
    expect(preferredEnglishVoice([localOtherLanguage, remote, local])).toBe(local)
    expect(preferredEnglishVoice([remote, voice('Another English', 'en-AU', false)])).toBe(remote)
    expect(preferredEnglishVoice([localOtherLanguage])).toBeUndefined()
  })
})
