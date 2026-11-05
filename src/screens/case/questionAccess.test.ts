import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import type { Item } from '../../content/schema'
import { findKeyPhrases } from '../../lib/rkea'
import { speak } from '../../lib/speech'
import { buildQuestionSpeech, formatVisualDescription } from './questionAccess'

const itemPlayerTsx = readFileSync(new URL('./ItemPlayer.tsx', import.meta.url), 'utf8')
const indexCss = readFileSync(new URL('../../index.css', import.meta.url), 'utf8')
const pack001 = JSON.parse(readFileSync(new URL('../../content/packs/00-1.json', import.meta.url), 'utf8'))
const tempItem: Item = pack001.items.find((it: Item) => it.id === 'N1.1-02')

describe('questionAccess speech builder', () => {
  it('formats visual description and includes all four table temperatures', () => {
    expect(tempItem).toBeDefined()
    const desc = formatVisualDescription(tempItem)
    expect(desc).toContain('34°C (93°F)')
    expect(desc).toContain('29°C (84°F)')
    expect(desc).toContain('22°C (72°F)')
    expect(desc).toContain('4°C (39°F)')
  })

  it('pairs every table cell with its column heading', () => {
    const v = tempItem.visual
    if (v.kind !== 'table') throw new Error('expected a table item')
    const desc = formatVisualDescription(tempItem)
    for (const row of v.rows) {
      row.forEach((cell, j) => expect(desc).toContain(`${v.columns[j]}: ${cell}`))
    }
  })

  it('buildQuestionSpeech includes stem, all four temperatures, and choices without leaking correct key', () => {
    const spoken = buildQuestionSpeech(tempItem)
    expect(spoken.text).toContain(tempItem.stem)
    expect(spoken.text).toContain('34°C (93°F)')
    expect(spoken.text).toContain('29°C (84°F)')
    expect(spoken.text).toContain('22°C (72°F)')
    expect(spoken.text).toContain('4°C (39°F)')
    expect(spoken.text).toContain('A. Ice cubes melt faster in the shade than in the sun.')
    expect(spoken.text).toContain('B. Ice cubes melt faster where the air is warmer.')
    expect(spoken.text).toContain('C. All of the ice cubes melted in about the same time.')
    expect(spoken.text).toContain('D. Larger ice cubes take longer to melt than smaller ones.')
    // Does not leak the correct answer
    expect(spoken.text).not.toContain('Correct answer')
    expect(spoken.text).not.toContain('The best match was')
  })

  it('intercepts speechSynthesis.speak and verifies speech utterance contains all four values', () => {
    const spoken = buildQuestionSpeech(tempItem)
    const mockSpeak = vi.fn()
    const mockCancel = vi.fn()
    const originalWindow = globalThis.window

    // Setup speech mock
    const fakeWindow = {
      speechSynthesis: {
        speak: mockSpeak,
        cancel: mockCancel,
        getVoices: () => [{ lang: 'en-US' }],
        speaking: false,
        pending: false,
      },
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
    } as unknown as Window & typeof globalThis

    // Stub window and SpeechSynthesisUtterance
    class FakeUtterance {
      text: string
      rate = 1
      onstart: (() => void) | null = null
      onboundary: (() => void) | null = null
      onend: (() => void) | null = null
      onerror: (() => void) | null = null
      constructor(text: string) {
        this.text = text
      }
    }

    ;(globalThis as Record<string, unknown>).window = fakeWindow
    ;(globalThis as Record<string, unknown>).SpeechSynthesisUtterance = FakeUtterance

    try {
      const ok = speak(spoken.text)
      expect(ok).toBe(true)
      expect(mockSpeak).toHaveBeenCalledOnce()
      const utterance = mockSpeak.mock.calls[0][0] as FakeUtterance
      expect(utterance.text).toContain('34°C (93°F)')
      expect(utterance.text).toContain('29°C (84°F)')
      expect(utterance.text).toContain('22°C (72°F)')
      expect(utterance.text).toContain('4°C (39°F)')
    } finally {
      globalThis.window = originalWindow
      // @ts-ignore cleanup
      delete (globalThis as Record<string, unknown>).SpeechSynthesisUtterance
    }
  })
})

describe('rkea-key-words indicator lighting logic', () => {
  it('a non-key word leaves rkea-key-words at data-lit="no", while an earned key phrase lights it', () => {
    const phrases = findKeyPhrases(tempItem.stem, tempItem.keyWords)
    expect(phrases.length).toBeGreaterThan(0)

    // Simulate tagging a non-key word (token 0: 'Rosa')
    const nonKeyTagged = new Set([0])
    const earnedWithNonKey = new Set(
      phrases.map((p, idx) => (p.tokens.every((t) => nonKeyTagged.has(t)) ? idx : -1)).filter((idx) => idx >= 0),
    )
    const isLitNonKey = earnedWithNonKey.size > 0
    expect(isLitNonKey).toBe(false)
    const litAttrNonKey = isLitNonKey ? 'yes' : 'no'
    expect(litAttrNonKey).toBe('no')

    // Simulate tagging all tokens of the first key phrase
    const keyTagged = new Set(phrases[0].tokens)
    const earnedWithKey = new Set(
      phrases.map((p, idx) => (p.tokens.every((t) => keyTagged.has(t)) ? idx : -1)).filter((idx) => idx >= 0),
    )
    const isLitKey = earnedWithKey.size > 0
    expect(isLitKey).toBe(true)
    const litAttrKey = isLitKey ? 'yes' : 'no'
    expect(litAttrKey).toBe('yes')
  })

  it('ItemPlayer.tsx sets rkea-key-words on state based on earnedPhrases.size > 0, not tagged.size', () => {
    expect(itemPlayerTsx).toContain("k: 'K', label: 'Key words', on: earnedPhrases.size > 0")
    expect(itemPlayerTsx).not.toContain("k: 'K', label: 'Key words', on: anyTagged")
  })
})

describe('ItemPlayer structural and copy requirements (PR 2)', () => {
  it('renders first-question-guide with required copy when index === 0', () => {
    expect(itemPlayerTsx).toContain('data-testid="first-question-guide"')
    expect(itemPlayerTsx).toContain('Read the question. Tap clue words if they help. Choose an answer, then Lock in.')
    expect(itemPlayerTsx).toContain('Intel is bonus points for finding evidence.')
    expect(itemPlayerTsx).toContain('Keyboard: Tab to an answer and press Enter. On a clue word, Space or Enter marks it.')
  })

  it('renames elimination toggle to Cross out an answer with crossout-toggle and crossout-status', () => {
    expect(itemPlayerTsx).toContain('data-testid="crossout-toggle"')
    expect(itemPlayerTsx).toContain("elim ? 'Done crossing out' : 'Cross out an answer'")
    expect(itemPlayerTsx).toContain('data-testid="crossout-status"')
    expect(itemPlayerTsx).toContain('Tap an answer to cross it out.')
  })

  it('makes crossed-out answers distinguishable without color alone', () => {
    expect(itemPlayerTsx).toContain('Crossed out')
    expect(indexCss).toContain('.opt.struck')
    expect(indexCss).toContain('text-decoration: line-through')
    expect(indexCss).toContain('border-style: dashed')
  })

  it('renders RKEA chips as noninteractive indicators', () => {
    expect(indexCss).toContain('.chip-r')
    expect(indexCss).toContain('cursor: default')
    expect(indexCss).toContain('pointer-events: none')
  })

  it('contains no em dashes or en dashes in new/edited files', () => {
    const questionAccessTs = readFileSync(new URL('./questionAccess.ts', import.meta.url), 'utf8')
    expect(questionAccessTs).not.toMatch(/[\u2013\u2014]/)
    expect(itemPlayerTsx).not.toMatch(/[\u2013\u2014]/)
    expect(indexCss).not.toMatch(/[\u2013\u2014]/)
  })
})
