import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { clampAgentNumber, generateCodename, sanitizeClassCode } from '../lib/codename'
import {
  applyResult,
  emptyRecord,
  MASTERY_STAGES,
  paintForPoints,
  toISODate,
  totalPoints,
  type BenchmarkRecord,
  type MasteryStage,
} from './mastery'
import { defaultSettings, GAME_STORAGE_KEY, type Settings } from './settings'

export { MASTERY_STAGES }
export type { MasteryStage }

export const STORAGE_KEY = GAME_STORAGE_KEY

export const MASTERY_LABEL: Record<MasteryStage, string> = {
  unseen: 'Unseen',
  rookie: 'Rookie',
  'field-ready': 'Field-Ready',
  expert: 'Expert',
  ace: 'Ace',
}

export interface Profile {
  classCode: string
  agentNumber: number
  codename: string
}

/** Benchmarks shown on the hub before real content lands (S2). Ids only, no item text. */
export const HUB_BENCHMARKS: readonly { id: string; label: string }[] = [
  { id: 'SC.5.L.14.1', label: 'Human organs and functions' },
  { id: 'SC.5.L.14.2', label: 'Plant and animal structures' },
  { id: 'SC.3.L.15.1', label: 'Classifying animals' },
  { id: 'SC.5.N.1.1', label: 'Scientific investigations' },
]

export interface ItemHistoryEntry {
  itemId: string
  correct: boolean
  date: string
}

export interface CaseStatus {
  closed: boolean
  date: string
  score: number
  total: number
}

const HISTORY_CAP = 300

export interface RecordOutcome {
  stageUp: boolean
  stage: MasteryStage
  /** Paint unlocked by this result, if any. */
  paint: string | null
}

export interface GameState {
  settings: Settings
  profile: Profile | null
  /** Benchmark id to mastery stage. Missing means unseen. Mirrors progress for the hub. */
  mastery: Record<string, MasteryStage>
  /** Per benchmark attempts, correct, lastSeen, stage and review schedule. */
  progress: Record<string, BenchmarkRecord>
  itemHistory: ItemHistoryEntry[]
  /** Unlocked codex entry ids. */
  codex: string[]
  intel: number
  paints: string[]
  cases: Record<string, CaseStatus>
  recordItem: (benchmark: string, itemId: string, correct: boolean, date?: string) => RecordOutcome
  unlockCodex: (ids: string[]) => string[]
  addIntel: (n: number) => void
  setCaseStatus: (id: string, status: CaseStatus) => void
  setSettings: (patch: Partial<Settings>) => void
  createProfile: (agentNumber: number, classCode: string) => Profile
  clearProfile: () => void
}

export function makeProfile(agentNumber: number, classCode: string): Profile {
  const n = clampAgentNumber(agentNumber)
  const code = sanitizeClassCode(classCode)
  return { classCode: code, agentNumber: n, codename: generateCodename(n, code) }
}

export function rankFor(mastery: Record<string, MasteryStage>): string {
  const points = Object.values(mastery).reduce((sum, s) => sum + MASTERY_STAGES.indexOf(s), 0)
  if (points >= 12) return 'Commander'
  if (points >= 7) return 'Specialist'
  if (points >= 3) return 'Field Agent'
  if (points >= 1) return 'Cadet'
  return 'Recruit'
}

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      settings: defaultSettings(),
      profile: null,
      mastery: {},
      progress: {},
      itemHistory: [],
      codex: [],
      intel: 0,
      paints: [],
      cases: {},
      recordItem: (benchmark, itemId, correct, date = toISODate()) => {
        const st = get()
        const { record, stageUp } = applyResult(st.progress[benchmark] ?? emptyRecord(), correct, date)
        const progress = { ...st.progress, [benchmark]: record }
        const mastery = { ...st.mastery, [benchmark]: record.stage }
        const itemHistory = [...st.itemHistory, { itemId, correct, date }].slice(-HISTORY_CAP)
        let paints = st.paints
        let paint: string | null = null
        if (stageUp) {
          paint = paintForPoints(totalPoints(progress))
          if (paint && !paints.includes(paint)) paints = [...paints, paint]
          else paint = null
        }
        set({ progress, mastery, itemHistory, paints })
        return { stageUp, stage: record.stage, paint }
      },
      unlockCodex: (ids) => {
        const have = new Set(get().codex)
        const added = ids.filter((id) => !have.has(id))
        if (added.length) set({ codex: [...get().codex, ...added] })
        return added
      },
      addIntel: (n) => set((s) => ({ intel: s.intel + n })),
      setCaseStatus: (id, status) => set((s) => ({ cases: { ...s.cases, [id]: status } })),
      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      createProfile: (agentNumber, classCode) => {
        const profile = makeProfile(agentNumber, classCode)
        set({ profile })
        return profile
      },
      clearProfile: () => set({ profile: null }),
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        settings: s.settings,
        profile: s.profile,
        mastery: s.mastery,
        progress: s.progress,
        itemHistory: s.itemHistory,
        codex: s.codex,
        intel: s.intel,
        paints: s.paints,
        cases: s.cases,
      }),
      // Fill any setting added in a later version with its default.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<GameState>
        return { ...current, ...p, settings: { ...current.settings, ...(p.settings ?? {}) } }
      },
    },
  ),
)
