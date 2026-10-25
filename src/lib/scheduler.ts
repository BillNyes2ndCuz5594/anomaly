// Spaced review scheduler for cold cases (SPEC section 8). Pure: callers pass progress, history and today.
import type { Item } from '../content/schema'
import { isDue, type BenchmarkRecord } from '../state/mastery'
import { seeded, type HistoryEntry } from './rkea'

export const COLD_ITEM_COUNT = 4

export type ReviewTier = 'due' | 'unseen' | 'seen'

export interface ReviewProgress {
  [benchmark: string]: BenchmarkRecord
}

/** Benchmarks (from the cold pool) whose scheduled review is due today or earlier. */
export function dueColdBenchmarks(items: Item[], progress: ReviewProgress, today: string): string[] {
  const ids = new Set(items.filter((i) => i.pool === 'cold').map((i) => i.benchmark))
  return [...ids].filter((b) => isDue(progress[b], today))
}

/** True when any cold pool benchmark has a review due. Drives the hub marker glow. */
export function anyReviewDue(items: Item[], progress: ReviewProgress, today: string): boolean {
  return dueColdBenchmarks(items, progress, today).length > 0
}

/**
 * Picks the items for a cold case. Order of preference:
 *  1. items whose benchmark review is due (most overdue first),
 *  2. items never answered,
 *  3. everything else, items last missed before items last answered right, then least recently seen.
 * Inside a tier the pick spreads across reporting categories, then across benchmarks, so four
 * items rarely come from one category. A seed breaks remaining ties the same way every time.
 */
export function pickReview(
  items: Item[],
  progress: ReviewProgress,
  history: HistoryEntry[],
  today: string,
  seed: string,
  count: number = COLD_ITEM_COUNT,
): Item[] {
  const last = new Map<string, HistoryEntry>()
  for (const h of history) {
    const prev = last.get(h.itemId)
    if (!prev || prev.date <= h.date) last.set(h.itemId, h)
  }
  const tierOf = (it: Item): ReviewTier => {
    if (isDue(progress[it.benchmark], today)) return 'due'
    return last.has(it.id) ? 'seen' : 'unseen'
  }
  const TIER_RANK: Record<ReviewTier, number> = { due: 0, unseen: 1, seen: 2 }
  // Within the due tier, an item never seen or missed beats one answered right.
  const itemRank = (it: Item): number => {
    const h = last.get(it.id)
    return !h ? 0 : h.correct ? 2 : 1
  }

  const pool = items.filter((i) => i.pool === 'cold')
  const chosen: Item[] = []
  const catCount = new Map<string, number>()
  const benchCount = new Map<string, number>()

  while (chosen.length < count && chosen.length < pool.length) {
    const left = pool.filter((i) => !chosen.includes(i))
    // Tier is the first key, so due items always come before unseen ones.
    const bestTier = Math.min(...left.map((i) => TIER_RANK[tierOf(i)]))
    const cands = left.filter((i) => TIER_RANK[tierOf(i)] === bestTier)
    cands.sort((a, b) => {
      const ca = catCount.get(a.category) ?? 0
      const cb = catCount.get(b.category) ?? 0
      if (ca !== cb) return ca - cb
      const ba = benchCount.get(a.benchmark) ?? 0
      const bb = benchCount.get(b.benchmark) ?? 0
      if (ba !== bb) return ba - bb
      const ia = itemRank(a)
      const ib = itemRank(b)
      if (ia !== ib) return ia - ib
      const oa = progress[a.benchmark]?.nextDue ?? ''
      const ob = progress[b.benchmark]?.nextDue ?? ''
      if (oa !== ob) return oa.localeCompare(ob)
      const da = last.get(a.id)?.date ?? ''
      const db = last.get(b.id)?.date ?? ''
      if (da !== db) return da.localeCompare(db)
      return seeded(seed, a.id) - seeded(seed, b.id)
    })
    const pick = cands[0]
    chosen.push(pick)
    catCount.set(pick.category, (catCount.get(pick.category) ?? 0) + 1)
    benchCount.set(pick.benchmark, (benchCount.get(pick.benchmark) ?? 0) + 1)
  }
  return chosen
}
