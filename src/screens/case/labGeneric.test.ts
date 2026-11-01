import { describe, expect, it } from 'vitest'
import fixture from '../../content/__fixtures__/pack-test.json'
import labsFixture from '../../content/__fixtures__/labs-test.json'
import type { MatchLab, OrderLab, SortLab } from '../../content/schema'
import {
  answerFor,
  codexFor,
  initLab,
  isComplete,
  labCards,
  labReduce,
  labTargets,
  nextSlot,
  pedestalFor,
  pedestalIds,
  placedCount,
  shuffleSteps,
  stepInSlot,
  targetOpen,
  visibleTargets,
  type GenericLab,
  type LabState,
} from './labGeneric'

const sortLab = fixture.case.lab as SortLab
const matchLab = labsFixture.match as MatchLab
const orderLab = labsFixture.order as OrderLab

/** Plays a lab to the end: one wrong try per question where a wrong target exists, then the right one. */
function playThrough(lab: GenericLab, seed = 's') {
  let s: LabState = initLab(lab, seed)
  let guard = 0
  while (!isComplete(lab, s) && guard++ < 50) {
    const right = answerFor(lab, s)
    expect(right).not.toBeNull()
    const wrong = labTargets(lab).find((t) => t.id !== right && targetOpen(lab, s, t.id))
    if (wrong) {
      const before = s
      s = labReduce(lab, s, { type: 'place', target: wrong.id })
      expect(s.feedback?.ok).toBe(false)
      expect(s.feedback?.word).toBe('Not quite.')
      expect(placedCount(s)).toBe(placedCount(before))
      expect(s.current).toBe(before.current)
    }
    s = labReduce(lab, s, { type: 'place', target: right as string })
    expect(s.feedback?.ok).toBe(true)
    expect(s.feedback?.word).toBe('Correct')
  }
  return s
}

describe('generic lab: sort', () => {
  it('plays the fixture pack through with a gentle miss on every card', () => {
    const s = playThrough(sortLab)
    expect(isComplete(sortLab, s)).toBe(true)
    expect(placedCount(s)).toBe(sortLab.cards.length)
    for (const c of sortLab.cards) expect(s.placed[c.id]).toBe(c.bin)
    expect(s.misses).toBe(sortLab.cards.length)
    expect(s.current).toBeNull()
  })

  it('shows the chosen bin hint on a miss and the card why on a hit', () => {
    let s = initLab(sortLab)
    expect(s.current).toBe('ice')
    s = labReduce(sortLab, s, { type: 'place', target: 'gas' })
    expect(s.feedback).toMatchObject({ ok: false, text: sortLab.bins.find((b) => b.id === 'gas')!.hint, card: 'ice', target: 'gas' })
    s = labReduce(sortLab, s, { type: 'place', target: 'solid' })
    expect(s.feedback).toMatchObject({ ok: true, text: sortLab.cards[0].why })
    expect(s.current).toBe('juice')
    expect(pedestalFor(sortLab, s, 'ice')).toBe('solid')
  })

  it('lets the player pick any open card and skips placed ones', () => {
    let s = initLab(sortLab)
    s = labReduce(sortLab, s, { type: 'select', id: 'milk' })
    expect(s.current).toBe('milk')
    s = labReduce(sortLab, s, { type: 'place', target: 'liquid' })
    expect(s.current).toBe('steam')
    expect(labReduce(sortLab, s, { type: 'select', id: 'milk' })).toBe(s)
    expect(labReduce(sortLab, s, { type: 'select', id: 'nope' })).toBe(s)
    // Wrapping: after the last card the first open one comes back.
    s = labReduce(sortLab, s, { type: 'place', target: 'gas' })
    expect(s.current).toBe('ice')
  })

  it('ignores unknown bins and actions after the end', () => {
    const s = initLab(sortLab)
    expect(labReduce(sortLab, s, { type: 'place', target: 'plasma' })).toBe(s)
    const done = playThrough(sortLab)
    expect(labReduce(sortLab, done, { type: 'place', target: 'solid' })).toBe(done)
  })
})

describe('generic lab: match', () => {
  it('plays through and pairs every left card with its right card', () => {
    const s = playThrough(matchLab)
    expect(isComplete(matchLab, s)).toBe(true)
    for (const p of matchLab.pairs) expect(s.placed[p.left]).toBe(p.right)
    expect(labTargets(matchLab).every((t) => !targetOpen(matchLab, s, t.id))).toBe(true)
  })

  it('names both cards on a miss and will not reuse a matched right card', () => {
    let s = initLab(matchLab)
    s = labReduce(matchLab, s, { type: 'place', target: 'to-gas' })
    expect(s.feedback?.ok).toBe(false)
    expect(s.feedback?.text).toContain('Melting')
    s = labReduce(matchLab, s, { type: 'place', target: 'to-liquid' })
    expect(s.feedback?.ok).toBe(true)
    expect(s.current).toBe('freezing')
    expect(labReduce(matchLab, s, { type: 'place', target: 'to-liquid' })).toBe(s)
  })
})

describe('generic lab: order', () => {
  it('shuffles steps, never in the right order, the same way for a seed', () => {
    const ids = orderLab.steps.map((x) => x.id)
    for (const seed of ['a', 'b', 'c', 'agent 14', '']) {
      const out = shuffleSteps(ids, seed)
      expect([...out].sort()).toEqual([...ids].sort())
      expect(out).not.toEqual(ids)
      expect(shuffleSteps(ids, seed)).toEqual(out)
    }
    expect(shuffleSteps(['only'], 'x')).toEqual(['only'])
  })

  it('fills slots in order and explains the order at the end', () => {
    let s = initLab(orderLab, 'x')
    expect(s.current).toBeNull()
    expect(nextSlot(orderLab, s)).toBe(1)
    s = labReduce(orderLab, s, { type: 'place', target: 'rain' })
    expect(s.feedback).toMatchObject({ ok: false, word: 'Not quite.' })
    expect(nextSlot(orderLab, s)).toBe(1)
    s = playThrough(orderLab, 'x')
    expect(isComplete(orderLab, s)).toBe(true)
    expect(nextSlot(orderLab, s)).toBeNull()
    orderLab.steps.forEach((step, i) => {
      expect(stepInSlot(s, i + 1)).toBe(step.id)
      expect(pedestalFor(orderLab, s, step.id)).toBe(`slot-${i + 1}`)
    })
    expect(s.feedback?.text).toBe(orderLab.why)
    expect(labReduce(orderLab, s, { type: 'select', id: 'heat' })).toBe(s)
  })

  it('lists the step buttons shuffled, never in answer order', () => {
    for (const seed of ['x', 'y', 'agent 7']) {
      const s = initLab(orderLab, seed)
      const shown = visibleTargets(orderLab, s).map((t) => t.id)
      expect(shown).toEqual(s.cards)
      expect(shown).not.toEqual(orderLab.steps.map((x) => x.id))
    }
    expect(visibleTargets(sortLab, initLab(sortLab)).map((t) => t.id)).toEqual(['solid', 'liquid', 'gas'])
  })

  it('gives one pedestal per slot', () => {
    expect(pedestalIds(orderLab)).toEqual(['slot-1', 'slot-2', 'slot-3', 'slot-4'])
    expect(pedestalIds(sortLab)).toEqual(['solid', 'liquid', 'gas'])
    expect(pedestalIds(matchLab)).toEqual(['to-gas', 'to-liquid', 'to-solid'])
  })
})

describe('generic lab helpers', () => {
  it('lists cards with their lines', () => {
    expect(labCards(sortLab)[0]).toEqual({ id: 'ice', name: 'Ice cube', lines: sortLab.cards[0].card })
    expect(labCards(matchLab)[0].lines).toEqual(['Ice on a warm plate.'])
    expect(labCards(orderLab)[0].lines).toEqual([])
  })

  it('unlocks a codex entry only when the pack lists it', () => {
    const known = new Set(fixture.codex.map((e) => e.id))
    expect(codexFor('90-1', 'ice', known)).toEqual(['lab:90-1:ice'])
    expect(codexFor('90-1', 'rock', known)).toEqual([])
  })
})
