import { describe, expect, it } from 'vitest'
import { content, type Item } from '../content/schema'
import { applyResult, emptyRecord } from '../state/mastery'
import { anyReviewDue, dueColdBenchmarks, pickReview } from './scheduler'

const cold = content.items.filter((i) => i.pool === 'cold')
const TODAY = '2026-10-26'

describe('pickReview', () => {
  it('returns 4 distinct cold items for a brand new agent, spread across categories', () => {
    const picks = pickReview(content.items, {}, [], TODAY, 'seed')
    expect(picks).toHaveLength(4)
    expect(new Set(picks.map((p) => p.id)).size).toBe(4)
    expect(picks.every((p) => p.pool === 'cold')).toBe(true)
    // Two categories exist in the cold pool, so the first two picks must differ.
    expect(picks[0].category).not.toBe(picks[1].category)
    expect(new Set(picks.map((p) => p.category)).size).toBe(2)
    expect(new Set(picks.map((p) => p.benchmark)).size).toBe(4)
  })

  it('is deterministic for a seed and changes with it', () => {
    const a = pickReview(content.items, {}, [], TODAY, 's1').map((i) => i.id)
    expect(pickReview(content.items, {}, [], TODAY, 's1').map((i) => i.id)).toEqual(a)
    const others = ['s2', 's3', 's4', 's5'].map((s) => pickReview(content.items, {}, [], TODAY, s).map((i) => i.id).join())
    expect(others.some((o) => o !== a.join())).toBe(true)
  })

  it('puts due benchmarks first, even over unseen items', () => {
    const due = 'SC.5.E.7.1'
    const progress = { [due]: { ...emptyRecord(), attempts: 2, correct: 1, lastSeen: '2026-10-20', nextDue: '2026-10-23' } }
    const history = cold.filter((i) => i.benchmark === due).map((i) => ({ itemId: i.id, correct: false, date: '2026-10-20' }))
    const picks = pickReview(content.items, progress, history, TODAY, 'x')
    const dueItems = cold.filter((i) => i.benchmark === due)
    expect(picks.slice(0, dueItems.length).every((p) => p.benchmark === due)).toBe(true)
  })

  it('does not treat a benchmark scheduled for the future as due', () => {
    const progress = { 'SC.5.E.7.1': { ...emptyRecord(), attempts: 1, correct: 1, lastSeen: TODAY, nextDue: '2026-10-27' } }
    expect(dueColdBenchmarks(content.items, progress, TODAY)).toEqual([])
    expect(anyReviewDue(content.items, progress, TODAY)).toBe(false)
    expect(anyReviewDue(content.items, progress, '2026-10-27')).toBe(true)
  })

  it('after a first cold case, answered items come last and unseen ones lead', () => {
    const first = pickReview(content.items, {}, [], '2026-10-19', 'a')
    const progress: Record<string, ReturnType<typeof emptyRecord>> = {}
    for (const it of first) progress[it.benchmark] = applyResult(progress[it.benchmark] ?? emptyRecord(), true, '2026-10-19').record
    const history = first.map((i) => ({ itemId: i.id, correct: true, date: '2026-10-19' }))
    // Next day the reviews are due: those benchmarks come first.
    const next = pickReview(content.items, progress, history, '2026-10-20', 'a')
    expect(next).toHaveLength(4)
    // A week of unrelated days with no due reviews: unseen come before seen.
    const later = pickReview(content.items, {}, history, '2026-10-20', 'a')
    const firstIds = new Set(first.map((i) => i.id))
    const seenRank = later.map((i) => (firstIds.has(i.id) ? 1 : 0))
    expect(seenRank).toEqual([...seenRank].sort())
    expect(later.filter((i) => !firstIds.has(i.id)).length).toBe(Math.min(4, cold.length - first.length))
  })

  it('missed items come back before items answered right', () => {
    const [a, b] = [cold[0], cold[1]]
    const rest = cold.filter((i) => i !== a && i !== b)
    const history = [
      ...rest.map((i) => ({ itemId: i.id, correct: true, date: '2026-10-01' })),
      { itemId: a.id, correct: true, date: '2026-10-01' },
      { itemId: b.id, correct: false, date: '2026-10-01' },
    ]
    const picks = pickReview(content.items, {}, history, TODAY, 'k', cold.length)
    expect(picks.findIndex((p) => p.id === b.id)).toBeLessThan(picks.findIndex((p) => p.id === a.id))
  })

  it('handles a pool smaller than the count and ignores case pool items', () => {
    const few: Item[] = [...content.items.filter((i) => i.pool === 'case').slice(0, 3), ...cold.slice(0, 2)]
    expect(pickReview(few, {}, [], TODAY, 's')).toHaveLength(2)
    expect(pickReview([], {}, [], TODAY, 's')).toEqual([])
  })
})
