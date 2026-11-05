// Pure helpers for the hub side panel: case status words and the grouped benchmark mastery list.
import { CATEGORIES, CATEGORY_LABEL, categoryOfBenchmark, type CaseDef, type Category } from '../content/schema'

export interface CaseRecord {
  closed: boolean
  /** ISO date (YYYY-MM-DD) of the last debrief. */
  date: string
}

export type CaseStatusWord = 'New' | 'Open' | 'Closed'

/** Put the science topic first on hub cards while keeping the unit number in the details. */
export function unitTopic(label: string): string {
  return label.replace(/^Unit\s+\d+:\s*/, '') || label
}

/** New (never played), Open (played, not closed) or Closed with the date it closed. */
export function caseStatus(rec: CaseRecord | undefined): { word: CaseStatusWord; date: string | null; text: string } {
  if (!rec) return { word: 'New', date: null, text: 'New' }
  if (!rec.closed) return { word: 'Open', date: null, text: 'Open' }
  const date = shortDate(rec.date)
  return { word: 'Closed', date, text: date ? `Closed ${date}` : 'Closed' }
}

/** "2026-10-24" reads "Oct 24". Anything else gives null. */
export function shortDate(iso: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '')
  if (!m) return null
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return d.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })
}

export interface HubBenchmark {
  id: string
  label: string
}

export interface HubGroup {
  category: Category
  label: string
  benchmarks: HubBenchmark[]
}

/**
 * Every benchmark a case teaches (case order, then benchmark order), plus any benchmark in progress that no case
 * lists, grouped under the four reporting categories in SSA order. Empty categories are left out.
 */
export function hubBenchmarkGroups(cases: readonly CaseDef[], inProgress: readonly string[], labelOf: (id: string) => string): HubGroup[] {
  const ids: string[] = []
  for (const c of cases) for (const b of c.benchmarks) if (!ids.includes(b)) ids.push(b)
  for (const b of inProgress) if (!ids.includes(b)) ids.push(b)
  return CATEGORIES.map((category) => ({
    category,
    label: CATEGORY_LABEL[category],
    benchmarks: ids.filter((id) => categoryOfBenchmark(id) === category).map((id) => ({ id, label: labelOf(id) })),
  })).filter((g) => g.benchmarks.length > 0)
}
