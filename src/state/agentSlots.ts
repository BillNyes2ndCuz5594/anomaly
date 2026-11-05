import { clampAgentNumber, sanitizeClassCode } from '../lib/codename'
import type { BenchmarkRecord, MasteryStage } from './mastery'
import { makeProfile, useGame, type CaseStatus, type GameState, type ItemHistoryEntry, type Profile } from './store'

export interface AgentSlotSnapshot {
  v: 1
  agentNumber: number
  classCode: string
  profile: Profile
  mastery: Record<string, MasteryStage>
  progress: Record<string, BenchmarkRecord>
  itemHistory: ItemHistoryEntry[]
  codex: string[]
  intel: number
  paints: string[]
  cases: Record<string, CaseStatus>
  lastCaseId: string | null
}

export function agentSlotKey(agentNumber: number, classCode: string): string {
  const code = sanitizeClassCode(classCode)
  const n = clampAgentNumber(agentNumber)
  return `anomaly.slot.${code}.${n}`
}

export function snapshotFromGameState(state: GameState): AgentSlotSnapshot | null {
  if (!state.profile) return null
  return {
    v: 1,
    agentNumber: state.profile.agentNumber,
    classCode: state.profile.classCode,
    profile: state.profile,
    mastery: { ...state.mastery },
    progress: { ...state.progress },
    itemHistory: [...state.itemHistory],
    codex: [...state.codex],
    intel: state.intel,
    paints: [...state.paints],
    cases: { ...state.cases },
    lastCaseId: state.lastCaseId,
  }
}

export type StorageLike = Storage | { getItem(k: string): string | null; setItem(k: string, v: string): void }

export function loadAgentSlot(
  agentNumber: number,
  classCode: string,
  storage?: StorageLike | { getItem(k: string): string | null } | null,
): AgentSlotSnapshot | null {
  const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null)
  if (!store) return null
  const n = clampAgentNumber(agentNumber)
  const code = sanitizeClassCode(classCode)
  const key = agentSlotKey(n, code)
  try {
    const raw = store.getItem(key)
    if (!raw) return null
    const s = JSON.parse(raw)
    if (!s || typeof s !== 'object' || Array.isArray(s)) return null
    if (s.v !== 1) return null
    if (typeof s.agentNumber !== 'number' || typeof s.classCode !== 'string') return null
    if (s.agentNumber !== n || s.classCode !== code) return null
    return s as AgentSlotSnapshot
  } catch {
    return null
  }
}

export function saveAgentSlot(
  agentNumber: number,
  classCode: string,
  snapshot: AgentSlotSnapshot,
  storage?: StorageLike | { setItem(k: string, v: string): void } | null,
): void {
  const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null)
  if (!store) return
  const key = agentSlotKey(agentNumber, classCode)
  try {
    store.setItem(key, JSON.stringify(snapshot))
  } catch {
    // Ignore storage quota or disabled errors
  }
}

export function hasAgentSlot(
  agentNumber: number,
  classCode: string,
  storage?: StorageLike | { getItem(k: string): string | null } | null,
): boolean {
  return loadAgentSlot(agentNumber, classCode, storage) !== null
}

export function saveCurrentAgent(storage?: StorageLike | { setItem(k: string, v: string): void } | null): void {
  const st = useGame.getState()
  if (!st.profile) return
  const snap = snapshotFromGameState(st)
  if (snap) {
    saveAgentSlot(snap.agentNumber, snap.classCode, snap, storage)
  }
}

/**
 * sessionStorage key prefixes that hold one agent's in-flight work: case checkpoints and the practice
 * mode sessions (Gold Rush, Containment, Reactor). All of them are cleared when the agent changes.
 * Deploy recovery keys such as `anomaly.chunkReloadAt` must not match any of these.
 */
export const AGENT_SESSION_PREFIXES: readonly string[] = [
  'anomaly.case.',
  'anomaly.checkpoint.',
  'anomaly:gold:',
  'anomaly:containment:',
  'anomaly:reactor:',
]

export function clearOpenCheckpoints(
  sessionStore?: { removeItem(k: string): void; length?: number; key?(i: number): string | null } | null,
): void {
  const store = sessionStore ?? (typeof sessionStorage !== 'undefined' ? sessionStorage : null)
  if (!store) return
  try {
    if (typeof store.key === 'function' && typeof store.length === 'number') {
      const toRemove: string[] = []
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i)
        if (k && AGENT_SESSION_PREFIXES.some((prefix) => k.startsWith(prefix))) {
          toRemove.push(k)
        }
      }
      for (const k of toRemove) store.removeItem(k)
    }
  } catch {
    // Ignore storage errors
  }
}

export function migrateActiveAgentSlot(
  stateOrStorage?: GameState | StorageLike | null,
  storage?: StorageLike | null,
): void {
  let st: GameState | null = null
  let store: StorageLike | null = null

  if (stateOrStorage && 'profile' in stateOrStorage) {
    st = stateOrStorage as GameState
    store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null)
  } else {
    st = typeof useGame !== 'undefined' ? useGame.getState() : null
    store = (stateOrStorage as StorageLike | null) ?? storage ?? (typeof localStorage !== 'undefined' ? localStorage : null)
  }

  if (!st || !st.profile) return
  if (!store) return
  const key = agentSlotKey(st.profile.agentNumber, st.profile.classCode)
  if (!store.getItem(key)) {
    const snap = snapshotFromGameState(st)
    if (snap) {
      try {
        store.setItem(key, JSON.stringify(snap))
      } catch {}
    }
  }
}

export function switchToAgent(
  agentNumber: number,
  classCode: string,
  storage?: StorageLike | null,
  sessionStore?: { removeItem(k: string): void; length?: number; key?(i: number): string | null } | null,
): Profile {
  const st = useGame.getState()
  const code = sanitizeClassCode(classCode)
  const n = clampAgentNumber(agentNumber)
  const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null)

  // If already active as this agent, preserve current state and keep slot in sync
  if (st.profile && st.profile.agentNumber === n && st.profile.classCode === code) {
    saveCurrentAgent(store)
    return st.profile
  }

  // 1. Snapshot the current agent before switching away
  if (st.profile) {
    saveCurrentAgent(store)
  }

  // 2. Clear any open in-flight checkpoints so they never leak to the new agent
  clearOpenCheckpoints(sessionStore)

  // 3. Check for existing slot for target agent
  const existing = loadAgentSlot(n, code, store)
  if (existing) {
    useGame.setState({
      profile: existing.profile ?? makeProfile(n, code),
      mastery: existing.mastery ?? {},
      progress: existing.progress ?? {},
      itemHistory: existing.itemHistory ?? [],
      codex: existing.codex ?? [],
      intel: existing.intel ?? 0,
      paints: existing.paints ?? [],
      cases: existing.cases ?? {},
      lastCaseId: existing.lastCaseId ?? null,
    })
    return existing.profile ?? makeProfile(n, code)
  }

  // 4. Fresh agent: start fresh without carrying anything over
  const profile = makeProfile(n, code)
  useGame.setState({
    profile,
    mastery: {},
    progress: {},
    itemHistory: [],
    codex: [],
    intel: 0,
    paints: [],
    cases: {},
    lastCaseId: null,
  })
  saveCurrentAgent(store)
  return profile
}
