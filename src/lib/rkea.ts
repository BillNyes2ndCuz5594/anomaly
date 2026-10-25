// RKEA helpers: stem tokens, key phrase matching, and evidence item selection.
import type { Item } from '../content/schema'

/** Stem split on whitespace. Each token is one tappable word button. */
export function tokenizeStem(stem: string): string[] {
  return stem.split(/\s+/).filter(Boolean)
}

export function normalizeWord(w: string): string {
  return w.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '')
}

export interface KeyPhrase {
  text: string
  /** Indexes into the token list. */
  tokens: number[]
}

/**
 * Finds each key word phrase in the stem (case-insensitive, ignoring punctuation at word edges)
 * and returns the tokens it covers. A phrase that cannot be matched on token boundaries is skipped.
 */
export function findKeyPhrases(stem: string, keyWords: string[]): KeyPhrase[] {
  const tokens = tokenizeStem(stem).map(normalizeWord)
  const out: KeyPhrase[] = []
  for (const kw of keyWords) {
    const words = tokenizeStem(kw).map(normalizeWord)
    if (words.length === 0) continue
    for (let i = 0; i + words.length <= tokens.length; i++) {
      if (words.every((w, j) => tokens[i + j] === w)) {
        out.push({ text: kw, tokens: words.map((_, j) => i + j) })
        break
      }
    }
  }
  return out
}

// ---------- evidence selection ----------

export const EVIDENCE_PLAN: readonly { benchmark: string; count: number }[] = [
  { benchmark: 'SC.5.L.14.1', count: 2 },
  { benchmark: 'SC.5.L.14.2', count: 2 },
  { benchmark: 'SC.3.L.15.1', count: 1 },
]

export interface HistoryEntry {
  itemId: string
  correct: boolean
  date: string
}

/** Small deterministic hash to string to 0..1, used to break ties reproducibly. */
export function seeded(seed: string, key: string): number {
  let h = 2166136261
  const s = `${seed}|${key}`
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  h ^= h >>> 15
  h = Math.imul(h, 2246822519)
  h ^= h >>> 13
  return (h >>> 0) / 4294967296
}

/**
 * Chooses the evidence check: per plan, items from the case pool. Unseen items come first,
 * then items last missed, then the least recently seen. Ties break by the seed, so a
 * given seed and history always give the same five items. Order follows the plan.
 */
export function pickEvidence(
  items: Item[],
  history: HistoryEntry[],
  seed: string,
  plan: readonly { benchmark: string; count: number }[] = EVIDENCE_PLAN,
): Item[] {
  const last = new Map<string, HistoryEntry>()
  for (const h of history) {
    const prev = last.get(h.itemId)
    if (!prev || prev.date <= h.date) last.set(h.itemId, h)
  }
  const rank = (it: Item): number => {
    const h = last.get(it.id)
    if (!h) return 0
    return h.correct ? 2 : 1
  }
  const chosen: Item[] = []
  for (const { benchmark, count } of plan) {
    const pool = items.filter((i) => i.pool === 'case' && i.benchmark === benchmark)
    pool.sort((a, b) => {
      const ra = rank(a)
      const rb = rank(b)
      if (ra !== rb) return ra - rb
      const da = last.get(a.id)?.date ?? ''
      const db = last.get(b.id)?.date ?? ''
      if (da !== db) return da.localeCompare(db)
      return seeded(seed, a.id) - seeded(seed, b.id)
    })
    chosen.push(...pool.slice(0, count))
  }
  return chosen
}
