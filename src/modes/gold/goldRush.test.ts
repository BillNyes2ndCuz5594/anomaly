import { describe, expect, it } from 'vitest'
import bedrock from '../../content/packs/02-2.json'
import type { Item } from '../../content/schema'
import { parseHash, routeNeedsProfile } from '../../lib/router'
import { buildQuickPool } from '../quick/quickPool'
import { createQuickAnswer } from '../quick/quickAnswer'
import { answerGold, applyCrate, crateLabel, clearGoldSession, cratesFor, loadGoldSession, nextGold, pickCrate, rankOf, resolveGoldFocusTarget, saveGoldSession, standings, startGold } from './goldRush'

function play(seed: string) {
  let s = startGold(seed)
  for (let q = 0; q < 10; q++) {
    s = answerGold(s, q % 5 < 3)
    if (s.phase === 'crate') s = pickCrate(s, q % 3)
    s = nextGold(s)
  }
  return s
}
describe('Gold Rush', () => {
  it('routes URL-only games and defaults a missing case', () => {
    expect(parseHash('#/gold/02-2')).toEqual({ name: 'gold', id: '02-2' })
    expect(parseHash('#/gold')).toEqual({ name: 'gold', id: '02-2' })
  })
  it('is deterministic and ends after exactly ten questions', () => {
    expect(play('quartz')).toEqual(play('quartz'))
    expect(play('quartz')).not.toEqual(play('photon'))
    expect(play('quartz')).toMatchObject({ phase: 'done', question: 10 })
    const done = play('quartz')
    expect(answerGold(done, true)).toBe(done)
    expect(nextGold(done)).toBe(done)
  })
  it('never produces negative scores or invalid actions', () => {
    for (let seed = 0; seed < 100; seed++) {
      let s = startGold(String(seed))
      expect(pickCrate(s, 0)).toBe(s)
      for (let q = 0; q < 10; q++) {
        s = answerGold(s, true)
        expect(pickCrate(s, -1)).toBe(s)
        s = pickCrate(s, q % 3)
        expect(standings(s).every((r) => r.intel >= 0)).toBe(true)
        s = nextGold(s)
      }
    }
  })
  it('replaces zero-intel doubles with deterministic number crates', () => {
    let replacements = 0
    for (let seed = 0; seed < 100; seed++) {
      const s = answerGold(startGold(String(seed)), true)
      const positive = cratesFor({ ...s, intel: 1 })
      const empty = cratesFor(s)
      expect(empty).not.toContain('double')
      expect(empty).toEqual(cratesFor(s))
      positive.forEach((crate, i) => {
        if (crate === 'double') {
          expect([10, 20, 40]).toContain(empty[i])
          replacements++
        }
      })
    }
    expect(replacements).toBeGreaterThan(0)
  })
  it('applies additions, doubling and glitch rounding', () => {
    const s = { ...answerGold(startGold('rules'), true), intel: 21 }
    expect(applyCrate(s, 10).intel).toBe(31)
    expect(applyCrate(s, 20).intel).toBe(41)
    expect(applyCrate(s, 40).intel).toBe(61)
    expect(applyCrate(s, 'double').intel).toBe(42)
    expect(applyCrate(s, 'glitch').intel).toBe(16)
    expect([10, 20, 40]).toContain(applyCrate({ ...s, intel: 0 }, 'glitch').intel)
  })
  it('swaps only with a leading bot and steals ten percent from the leader', () => {
    const s = { ...answerGold(startGold('rules'), true), intel: 20,
      bots: [{ name: 'A', intel: 101 }, { name: 'B', intel: 50 }, { name: 'C', intel: 10 }] }
    expect(applyCrate(s, 'swap')).toMatchObject({ intel: 101, bots: [{ name: 'A', intel: 20 }, s.bots[1], s.bots[2]] })
    expect(applyCrate(s, 'steal')).toMatchObject({ intel: 30, bots: [{ name: 'A', intel: 91 }, s.bots[1], s.bots[2]] })
    const leading = { ...s, intel: 200 }
    expect(applyCrate(leading, 'swap').intel).toBe(200)
    expect(cratesFor(leading)).not.toContain('swap')
    expect(s.bots[0].intel).toBe(101)
  })
  it('builds and plays a full game using the real Unit 4 pack', () => {
    const pool = buildQuickPool(bedrock.items as Item[], { caseId: '02-2', count: 10, seed: 'bedrock' })
    expect(pool).toHaveLength(10)
    let s = startGold('bedrock')
    for (const item of pool) {
      expect(bedrock.items.some((real) => real.id === item.id)).toBe(true)
      s = answerGold(s, createQuickAnswer(item)(item.key)!.correct)
      s = nextGold(pickCrate(s, 0))
    }
    expect(s.phase).toBe('done')
  })
  it('keeps typical six-correct expeditions competitive', () => {
    const topTwo = Array.from({ length: 200 }, (_, i) => standings(play(String(i))).findIndex((r) => r.name === 'You') < 2)
    expect(topTwo.filter(Boolean).length).toBeGreaterThan(100)
  })
  it('requires profile for gold route like other play routes', () => {
    expect(routeNeedsProfile('gold', false)).toBe(true)
    expect(routeNeedsProfile('gold', true)).toBe(false)
    expect(routeNeedsProfile('hub', false)).toBe(true)
    expect(routeNeedsProfile('case', false)).toBe(true)
    expect(routeNeedsProfile('cold', false)).toBe(true)
    expect(routeNeedsProfile('title', false)).toBe(false)
    expect(routeNeedsProfile('settings', false)).toBe(false)
  })
  it('directs programmatic focus to crates, next button, and results', () => {
    const calls: string[] = []
    const refs = {
      firstCrate: { focus: () => calls.push('firstCrate') },
      nextBtn: { focus: () => calls.push('nextBtn') },
      results: { focus: () => calls.push('results') },
    }
    // after answer: if correct -> crate, if incorrect -> next
    expect(resolveGoldFocusTarget('crate', refs)).toBe('crate')
    expect(calls).toEqual(['firstCrate'])
    // after crate pick -> next
    expect(resolveGoldFocusTarget('next', refs)).toBe('next')
    expect(calls).toEqual(['firstCrate', 'nextBtn'])
    // at game done -> results
    expect(resolveGoldFocusTarget('done', refs)).toBe('done')
    expect(calls).toEqual(['firstCrate', 'nextBtn', 'results'])
    // question phase delegates to stem ref
    expect(resolveGoldFocusTarget('question', refs)).toBeNull()
  })
  it('makes steal always give at least 1 intel and never take bots below zero', () => {
    const s = { ...answerGold(startGold('steal-rules'), true), intel: 0,
      bots: [{ name: 'A', intel: 0 }, { name: 'B', intel: 5 }, { name: 'C', intel: 0 }] }
    // Victim B (5 intel) -> gives 1 intel (not 0), B drops to 4
    const resB = applyCrate(s, 'steal')
    expect(resB.intel).toBe(1)
    expect(resB.bots.find((b) => b.name === 'B')?.intel).toBe(4)
    expect(resB.outcome).toBe('Intel intercept! Collected 1 from B.')

    // All bots have 0 intel: gives at least 1 intel, bots remain at 0 (never negative)
    const zeroBots = { ...s, bots: [{ name: 'A', intel: 0 }, { name: 'B', intel: 0 }, { name: 'C', intel: 0 }] }
    const resZero = applyCrate(zeroBots, 'steal')
    expect(resZero.intel).toBe(1)
    expect(resZero.bots.every((b) => b.intel >= 0)).toBe(true)
  })
  it('prevents glitch when intel is zero both when offered and applied', () => {
    for (let seed = 0; seed < 50; seed++) {
      const s = answerGold(startGold(String(seed)), true)
      const zeroCrates = cratesFor(s)
      expect(zeroCrates).not.toContain('glitch')
      const res = applyCrate(s, 'glitch')
      expect([10, 20, 40]).toContain(res.intel)
      expect(res.outcome).toMatch(/Found (10|20|40) intel!/)
    }
  })
  it('calculates shared rank for standings ties', () => {
    const board = [
      { name: 'Quartz Scout', intel: 100 },
      { name: 'Photon Pilot', intel: 80 },
      { name: 'You', intel: 80 },
      { name: 'Fossil Finder', intel: 50 },
    ]
    expect(rankOf(board, 'Quartz Scout')).toBe(1)
    expect(rankOf(board, 'Photon Pilot')).toBe(2)
    expect(rankOf(board, 'You')).toBe(2)
    expect(rankOf(board, 'Fossil Finder')).toBe(4)

    // Tied for 1st
    const tiedFirst = [
      { name: 'You', intel: 100 },
      { name: 'Quartz Scout', intel: 100 },
      { name: 'Photon Pilot', intel: 20 },
      { name: 'Fossil Finder', intel: 10 },
    ]
    expect(rankOf(tiedFirst, 'You')).toBe(1)
    expect(rankOf(tiedFirst, 'Quartz Scout')).toBe(1)

    // Missing rival
    expect(rankOf(board, 'Unknown')).toBe(5)
  })
  it('persists in-progress session per caseId and guards parse errors', () => {
    const map = new Map<string, string>()
    const storage = {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => { map.set(k, v) },
      removeItem: (k: string) => { map.delete(k) },
    }
    const session = {
      game: startGold('seed-1'),
      reveal: { index: 0, contents: '20', delta: 20 },
    }
    expect(loadGoldSession(storage, '02-2')).toBeNull()

    saveGoldSession(storage, '02-2', session)
    expect(loadGoldSession(storage, '02-2')).toEqual(session)
    expect(loadGoldSession(storage, '02-3')).toBeNull()

    clearGoldSession(storage, '02-2')
    expect(loadGoldSession(storage, '02-2')).toBeNull()

    // Corrupted / invalid data handling
    map.set('anomaly:gold:02-2', '{invalid json')
    expect(loadGoldSession(storage, '02-2')).toBeNull()

    map.set('anomaly:gold:02-2', JSON.stringify({ game: 'not an object' }))
    expect(loadGoldSession(storage, '02-2')).toBeNull()
  })
  it('maps raw crate tokens to kid-friendly labels', () => {
    expect(crateLabel(20)).toBe('+20 intel!')
    expect(crateLabel(10)).toBe('+10 intel!')
    expect(crateLabel(40)).toBe('+40 intel!')
    expect(crateLabel('steal')).toBe('Steal! Took intel from a rival')
    expect(crateLabel('glitch')).toBe('Glitch! Lost some intel')
    expect(crateLabel('swap')).toBe('Swap! Traded scores with a rival')
    expect(crateLabel('double')).toBe('Double! Doubled your intel')
  })
})
