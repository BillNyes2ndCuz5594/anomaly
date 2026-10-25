import { describe, expect, it } from 'vitest'
import { content } from '../content/schema'
import { findKeyPhrases, normalizeWord, pickEvidence, tokenizeStem } from './rkea'

describe('key phrases', () => {
  it('normalizes edge punctuation and case', () => {
    expect(normalizeWord('Bile,')).toBe('bile')
    expect(normalizeWord('"Fats."')).toBe('fats')
  })

  it('finds every key phrase of every item on token boundaries', () => {
    for (const it of content.items) {
      const found = findKeyPhrases(it.stem, it.keyWords)
      expect(found.length, `${it.id} matched ${found.length} of ${it.keyWords.length}`).toBe(it.keyWords.length)
      for (const f of found) expect(f.tokens.every((t) => t < tokenizeStem(it.stem).length)).toBe(true)
    }
  })

  it('matches multi word phrases case-insensitively', () => {
    const r = findKeyPhrases('Which organ makes bile, a juice?', ['Makes Bile'])
    expect(r[0].tokens).toEqual([2, 3])
  })
})

describe('pickEvidence', () => {
  const pick = (history: { itemId: string; correct: boolean; date: string }[] = [], seed = 'a') =>
    pickEvidence(content.items, history, seed)

  it('returns 2 + 2 + 1 from the right benchmarks in plan order', () => {
    const p = pick()
    expect(p.map((i) => i.benchmark)).toEqual([
      'SC.5.L.14.1',
      'SC.5.L.14.1',
      'SC.5.L.14.2',
      'SC.5.L.14.2',
      'SC.3.L.15.1',
    ])
    expect(new Set(p.map((i) => i.id)).size).toBe(5)
    expect(p.every((i) => i.pool === 'case')).toBe(true)
  })

  it('is deterministic for a seed and history', () => {
    expect(pick([], 'x').map((i) => i.id)).toEqual(pick([], 'x').map((i) => i.id))
  })

  it('prefers unseen items over seen ones', () => {
    const first = pick()
    const second = pick(first.map((i) => ({ itemId: i.id, correct: true, date: '2026-10-05' })))
    const firstIds = new Set(first.map((i) => i.id))
    expect(second.every((i) => !firstIds.has(i.id))).toBe(true)
  })

  it('brings missed items back before items answered correctly', () => {
    const all = content.items.filter((i) => i.pool === 'case' && i.benchmark === 'SC.3.L.15.1')
    const history = all.map((i, n) => ({ itemId: i.id, correct: n !== 3, date: '2026-10-05' }))
    const p = pickEvidence(content.items, history, 's')
    expect(p[4].id).toBe(all[3].id)
  })
})
