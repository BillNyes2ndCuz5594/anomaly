import type { Route } from '../lib/router'

export const DEFAULT_CASE_ID = '04-1'

export function validCaseId(id: unknown, known: readonly string[]): string {
  if (typeof id === 'string' && known.includes(id)) {
    return id
  }
  if (known.includes(DEFAULT_CASE_ID)) {
    return DEFAULT_CASE_ID
  }
  return known[0] ?? DEFAULT_CASE_ID
}

export function caseIdFromRoute(route: Route): string | null {
  switch (route.name) {
    case 'case':
    case 'gold':
    case 'containment':
    case 'reactor':
      return route.id
    default:
      return null
  }
}

export function unitNumber(unitLabel: string): number {
  const match = /^Unit\s+(\d+)/i.exec(unitLabel.trim())
  if (!match) return 99
  const n = Number(match[1])
  return Number.isNaN(n) ? 99 : n
}

export function orderCasesForHub<T extends { id: string; unitLabel: string }>(
  cases: readonly T[],
  currentUnit = 4,
): T[] {
  const current: T[] = []
  const others: { item: T; unit: number; originalIndex: number }[] = []

  cases.forEach((c, idx) => {
    const u = unitNumber(c.unitLabel)
    if (u === currentUnit) {
      current.push(c)
    } else {
      others.push({ item: c, unit: u, originalIndex: idx })
    }
  })

  others.sort((a, b) => {
    if (a.unit !== b.unit) return a.unit - b.unit
    return a.originalIndex - b.originalIndex
  })

  return [...current, ...others.map((o) => o.item)]
}
