import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const itemPlayerSrc = readFileSync(new URL('./ItemPlayer.tsx', import.meta.url), 'utf8')
const debriefSrc = readFileSync(new URL('./Debrief.tsx', import.meta.url), 'utf8')
const hubScreenSrc = readFileSync(new URL('../HubScreen.tsx', import.meta.url), 'utf8')
const resultsSrc = readFileSync(new URL('./Results.tsx', import.meta.url), 'utf8')

describe('Track 4 Fun Flow Vocabulary Copy', () => {
  it('FF-01: updates button and action copy while keeping test IDs and lead instruction', () => {
    // Lead instruction preserved for existing tests
    expect(itemPlayerSrc).toContain('Read the question. Tap clue words if they help. Choose an answer, then Lock in.')
    // Action copy updated
    expect(itemPlayerSrc).toContain('Lock in answer')
    expect(itemPlayerSrc).toContain("index + 1 >= total ? 'Review answers' : 'Next question'")
    // Preserves test IDs
    expect(itemPlayerSrc).toContain('data-testid="lock-in"')
    expect(itemPlayerSrc).toContain('data-testid="next-item"')
  })

  it('FF-02: updates supportive stuck-state messages in ItemPlayer', () => {
    expect(itemPlayerSrc).toContain(
      'Read aloud is not available on this device. You can still read the question and choose an answer.',
    )
    expect(itemPlayerSrc).toContain(
      'Extra help crossed out one wrong answer. This one adds no points. You can keep going.',
    )
    expect(itemPlayerSrc).toContain('data-testid="read-aloud-unavailable"')
    expect(itemPlayerSrc).toContain('data-testid="help-level-extra-note"')
  })

  it('FF-03: updates HubScreen cold review card label and due copy while preserving Review due substring', () => {
    expect(hubScreenSrc).toContain('code="COLD CASE REVIEW"')
    expect(hubScreenSrc).toContain('Review due')
    expect(hubScreenSrc).toContain('Review due</strong>: time to check clues from earlier missions')
    expect(hubScreenSrc).toContain('Revisit clues from earlier missions')
    expect(hubScreenSrc).toContain('to="/cold/cold-1"')
  })

  it('FF-04: updates Results screen with Intel explanation and skill progress helper', () => {
    expect(resultsSrc).toContain('Intel means mission points you collect as a science agent.')
    expect(resultsSrc).toContain('Your science skill progress')
    expect(resultsSrc).toContain('See how your science skills are growing.')
    expect(resultsSrc).toContain('data-testid="intel-earned"')
    expect(resultsSrc).toContain('data-testid="mastery-bars"')
  })

  it('FF-05: updates Debrief screen heading and celebratory intro line', () => {
    expect(debriefSrc).toContain('Mission clue check')
    expect(debriefSrc).toContain("Great clue work. Let's check your answers together before we finish this mission!")
    expect(debriefSrc).not.toContain('Shift result')
  })

  it('FF-06: splits and clarifies keyboard hint variants in ItemPlayer', () => {
    expect(itemPlayerSrc).toContain(
      'Keyboard: 1-4 or A-D chooses an answer. X crosses out an answer. Space reads aloud. Enter locks in your answer.',
    )
    expect(itemPlayerSrc).toContain(
      'Keyboard: 1-4 or A-D chooses an answer. Space reads aloud. Enter locks in your answer.',
    )
  })

  it('contains no em dashes or en dashes in changed files', () => {
    expect(itemPlayerSrc).not.toMatch(/[\u2013\u2014]/)
    expect(debriefSrc).not.toMatch(/[\u2013\u2014]/)
    expect(hubScreenSrc).not.toMatch(/[\u2013\u2014]/)
    expect(resultsSrc).not.toMatch(/[\u2013\u2014]/)
  })
})
