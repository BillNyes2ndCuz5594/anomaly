/** Codex entries unlocked since the codex was last opened carry a NEW tag. The seen ids live in their own key. */
export const CODEX_SEEN_KEY = 'anomaly.codex-seen'

type Store = Pick<Storage, 'getItem' | 'setItem'>

function safeStorage(): Store | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function loadSeen(store: Store | null = safeStorage()): Set<string> {
  try {
    const raw = store?.getItem(CODEX_SEEN_KEY)
    const v: unknown = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 2000) : [])
  } catch {
    return new Set()
  }
}

/** Unlocked ids the agent has not seen, in unlock order. */
export function diffNew(unlocked: readonly string[], seen: ReadonlySet<string>): string[] {
  return unlocked.filter((id) => !seen.has(id))
}

/** Marks every unlocked id as seen. Returns the new seen set. */
export function markAllSeen(unlocked: readonly string[], seen: ReadonlySet<string>, store: Store | null = safeStorage()): Set<string> {
  const next = new Set([...seen, ...unlocked])
  try {
    store?.setItem(CODEX_SEEN_KEY, JSON.stringify([...next]))
  } catch {
    // Storage blocked: tags may show again next visit. Harmless.
  }
  return next
}
