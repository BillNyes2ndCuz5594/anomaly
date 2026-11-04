import { describe, expect, it } from 'vitest'
import raw from '../../content/packs/02-2.json'
import type { Item } from '../../content/schema'
import { gradeChoice } from '../../lib/rkea'
import { cleanFeedback, createQuickAnswer, keyToOptionIndex, toSentenceCase } from './quickAnswer'

describe('quick grading on real Unit 4 items', () => {
  it('grades every choice with the shared ItemPlayer logic and reports elapsed time', () => {
    for (const item of raw.items as Item[]) {
      for (let picked = 0; picked < 4; picked++) {
        let now = 100
        const submit = createQuickAnswer(item, () => now)
        now = 850
        expect(submit(picked)).toEqual({ itemId: item.id, correct: picked === item.key, ms: 750 })
        expect(gradeChoice(item, picked)).toBe(picked === item.key)
        expect(submit(item.key)).toBeNull()
        now = 5000
        expect(submit(item.key)).toBeNull()
      }
    }
  })
  it('ignores invalid choices and admits only one rapid tap across different choices', () => {
    const item = raw.items[0] as Item
    const submit = createQuickAnswer(item, () => 100)
    for (const picked of [-1, 4, NaN, 0.5]) expect(submit(picked)).toBeNull()
    expect(submit(item.key)?.correct).toBe(true)
    expect(submit((item.key + 1) % 4)).toBeNull()
    expect(createQuickAnswer(item, () => 100)(item.key)?.ms).toBe(0)
  })

  it('maps keyboard shortcuts 1-4 and A-D case-insensitively', () => {
    expect(keyToOptionIndex('1')).toBe(0)
    expect(keyToOptionIndex('2')).toBe(1)
    expect(keyToOptionIndex('3')).toBe(2)
    expect(keyToOptionIndex('4')).toBe(3)
    expect(keyToOptionIndex('a')).toBe(0)
    expect(keyToOptionIndex('B')).toBe(1)
    expect(keyToOptionIndex('c')).toBe(2)
    expect(keyToOptionIndex('D')).toBe(3)
    expect(keyToOptionIndex('0')).toBeNull()
    expect(keyToOptionIndex('5')).toBeNull()
    expect(keyToOptionIndex('e')).toBeNull()
    expect(keyToOptionIndex('Enter')).toBeNull()
  })

  it('formats strings to sentence case cleanly', () => {
    expect(toSentenceCase('igneous rock')).toBe('Igneous rock')
    expect(toSentenceCase('Already capitalized')).toBe('Already capitalized')
    expect(toSentenceCase('')).toBe('')
  })

  it('cleans feedback string to eliminate double periods and repeated Correct', () => {
    const rawCorrect = '✓ Correct. Correct answer: A. igneous rock.. Correct: igneous rock forms when melted rock cools.'
    expect(cleanFeedback(rawCorrect)).toBe('✓ Correct. Igneous rock forms when melted rock cools.')

    const rawIncorrect = '✗ Incorrect. Correct answer: B. sedimentary rock.. Correct: layers pressed together.'
    expect(cleanFeedback(rawIncorrect)).toBe('Not quite. Correct answer: B. Sedimentary rock. Layers pressed together.')

    const alreadyNotQuite = 'Not quite. Correct answer: C. metamorphic.. Correct: heat and pressure.'
    expect(cleanFeedback(alreadyNotQuite)).toBe('Not quite. Correct answer: C. Metamorphic. Heat and pressure.')
  })
})
