// Teacher HQ analysis. Pure functions over decoded report codes. No three, no game state.
import { CATALOG_BENCHMARKS, CATALOG_ITEMS } from '../lib/catalog.generated'
import { dayToISO, type ReportData, type StageName } from '../lib/reportCode'

export const CATEGORIES = ['Nature of Science', 'Earth and Space', 'Physical', 'Life'] as const
export type Category = (typeof CATEGORIES)[number]

/** Reporting category from the benchmark id: SC.5.N.* Nature of Science, E Earth and Space, P Physical, L Life. */
export function categoryOf(benchmarkId: string): Category {
  switch (benchmarkId.split('.')[2]) {
    case 'N':
      return 'Nature of Science'
    case 'E':
      return 'Earth and Space'
    case 'P':
      return 'Physical'
    default:
      return 'Life'
  }
}

export const benchmarkLabel = (id: string): string => CATALOG_BENCHMARKS.find((b) => b.id === id)?.label ?? id

export interface Cell {
  attempts: number
  correct: number
  stage: StageName
}

export interface AgentColumn {
  key: string
  agent: number
  classHash: number
  /** Short class tag from the class hash, since the class code itself is never in a code. */
  classTag: string
  day: number
  cells: Map<string, Cell>
}

export interface Pct {
  attempts: number
  correct: number
  /** Whole percent, or null when there is no attempt. */
  pct: number | null
}

export interface Analysis {
  agents: AgentColumn[]
  /** Benchmarks with at least one attempt, in catalog order. */
  benchmarks: { id: string; label: string; category: Category }[]
  byBenchmark: Map<string, Pct & { agents: number }>
  categories: (Pct & { name: Category; agents: number })[]
  weakest: { id: string; label: string; attempts: number; correct: number; pct: number; agents: number }[]
  missed: { id: string; stem: string; benchmark: string; missed: number; total: number }[]
  classTags: string[]
}

const pctOf = (correct: number, attempts: number): number | null => (attempts > 0 ? Math.round((correct / attempts) * 100) : null)

export const classTag = (hash: number): string => hash.toString(16).toUpperCase().padStart(4, '0')

export function analyze(reports: ReportData[]): Analysis {
  const agents: AgentColumn[] = reports
    .map((r) => ({
      key: `${r.classHash}:${r.agent}`,
      agent: r.agent,
      classHash: r.classHash,
      classTag: classTag(r.classHash),
      day: r.day,
      cells: new Map(r.benchmarks.filter((b) => b.attempts > 0).map((b) => [b.id, { attempts: b.attempts, correct: b.correct, stage: b.stage }])),
    }))
    .sort((a, b) => a.classHash - b.classHash || a.agent - b.agent)

  const byBenchmark = new Map<string, Pct & { agents: number }>()
  for (const a of agents) {
    for (const [id, c] of a.cells) {
      const cur = byBenchmark.get(id) ?? { attempts: 0, correct: 0, pct: null, agents: 0 }
      cur.attempts += c.attempts
      cur.correct += c.correct
      cur.agents += 1
      byBenchmark.set(id, cur)
    }
  }
  for (const v of byBenchmark.values()) v.pct = pctOf(v.correct, v.attempts)

  const benchmarks = CATALOG_BENCHMARKS.filter((b) => byBenchmark.has(b.id)).map((b) => ({ id: b.id, label: b.label, category: categoryOf(b.id) }))

  const categories = CATEGORIES.map((name) => {
    let attempts = 0
    let correct = 0
    const who = new Set<string>()
    for (const a of agents) {
      for (const [id, c] of a.cells) {
        if (categoryOf(id) !== name) continue
        attempts += c.attempts
        correct += c.correct
        who.add(a.key)
      }
    }
    return { name, attempts, correct, pct: pctOf(correct, attempts), agents: who.size }
  })

  const weakest = benchmarks
    .map((b) => ({ id: b.id, label: b.label, ...byBenchmark.get(b.id)! }))
    .map((b) => ({ id: b.id, label: b.label, attempts: b.attempts, correct: b.correct, pct: b.pct ?? 0, agents: b.agents }))
    .sort((a, b) => a.pct - b.pct || b.attempts - a.attempts)
    .slice(0, 5)

  const item = new Map<string, { missed: number; total: number }>()
  for (const r of reports) {
    for (const x of r.recent) {
      const cur = item.get(x.itemId) ?? { missed: 0, total: 0 }
      cur.total += 1
      if (!x.correct) cur.missed += 1
      item.set(x.itemId, cur)
    }
  }
  const missed = [...item.entries()]
    .filter(([, v]) => v.missed > 0)
    .map(([id, v]) => {
      const c = CATALOG_ITEMS.find((i) => i.id === id)
      return { id, stem: c?.stem ?? '', benchmark: c?.benchmark ?? '', ...v }
    })
    .sort((a, b) => b.missed - a.missed || b.missed / b.total - a.missed / a.total || a.id.localeCompare(b.id))
    .slice(0, 8)

  return { agents, benchmarks, byBenchmark, categories, weakest, missed, classTags: [...new Set(agents.map((a) => a.classTag))] }
}

// ---------- color scale ----------

/** Viridis-like sequential ramp: dark purple (0) to a soft mint (100). Calmer than full yellow, still safe for the common color vision types. */
const RAMP: readonly [number, number, number][] = [
  [68, 1, 84],
  [59, 82, 139],
  [33, 144, 141],
  [74, 182, 124],
  [172, 223, 156],
]

export function scaleColor(pct: number): { bg: string; fg: string } {
  const t = Math.max(0, Math.min(1, pct / 100)) * (RAMP.length - 1)
  const i = Math.min(RAMP.length - 2, Math.floor(t))
  const f = t - i
  const c = RAMP[i].map((v, k) => Math.round(v + (RAMP[i + 1][k] - v) * f))
  // Text is whichever of white and navy has the higher WCAG contrast on this cell.
  const lin = (v: number) => {
    const x = v / 255
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)
  }
  const lum = 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2])
  // Near black, not the panel navy: navy and white leave a gap around mid luminance where neither reaches 4.5:1.
  const NAVY_LUM = 0.0015 // #02050a
  const onWhite = 1.05 / (lum + 0.05)
  const onNavy = (lum + 0.05) / (NAVY_LUM + 0.05)
  return { bg: `rgb(${c[0]}, ${c[1]}, ${c[2]})`, fg: onNavy >= onWhite ? '#02050a' : '#ffffff' }
}

// ---------- CSV ----------

export function toCsv(a: Analysis): string {
  const rows = ['class,agent,benchmark,category,attempts,correct,percent,stage,date']
  for (const col of a.agents) {
    for (const b of a.benchmarks) {
      const c = col.cells.get(b.id)
      if (!c) continue
      rows.push([col.classTag, col.agent, b.id, `"${b.category}"`, c.attempts, c.correct, pctOf(c.correct, c.attempts) ?? '', c.stage, dayToISO(col.day)].join(','))
    }
  }
  return rows.join('\n') + '\n'
}
