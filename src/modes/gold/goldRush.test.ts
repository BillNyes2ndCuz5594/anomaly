import { describe, expect, it } from 'vitest'
import bedrock from '../../content/packs/02-2.json'
import type { Item } from '../../content/schema'
import { parseHash } from '../../lib/router'
import { buildQuickPool } from '../quick/quickPool'
import { createQuickAnswer } from '../quick/quickAnswer'
import { answerGold, applyCrate, cratesFor, nextGold, pickCrate, standings, startGold } from './goldRush'

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
  it('applies additions, doubling and glitch rounding', () => {
    const s = { ...answerGold(startGold('rules'), true), intel: 21 }
    expect(applyCrate(s, 10).intel).toBe(31)
    expect(applyCrate(s, 20).intel).toBe(41)
    expect(applyCrate(s, 40).intel).toBe(61)
    expect(applyCrate(s, 'double').intel).toBe(42)
    expect(applyCrate(s, 'glitch').intel).toBe(16)
    expect(applyCrate({ ...s, intel: 0 }, 'glitch').intel).toBe(0)
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
})
