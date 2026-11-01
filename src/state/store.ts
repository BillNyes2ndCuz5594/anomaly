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

/** Rank floor: an agent who knows fewer benchmarks than this is measured as if they knew this many. */
export const RANK_MIN_KNOWN = 4

/** Share of full mastery each rank needs, in order (Cadet, Field Agent, Specialist, Commander). */
export const RANK_STEPS: readonly [number, string][] = [
  [12 / 16, 'Commander'],
  [7 / 16, 'Specialist'],
  [3 / 16, 'Field Agent'],
  [1 / 16, 'Cadet'],
]

/**
 * Rank from the fraction of full mastery over the benchmarks the agent knows (has met, so not Unseen), with a floor
 * of four so one lucky benchmark is not a Commander. The old rule counted raw points, which a full year of cases
 * would make trivial; this one depends only on the agent's own record, so adding cases (new, unseen benchmarks)
 * never demotes anyone. With four or fewer known benchmarks it gives exactly the old ranks (1, 3, 7, 12 points).
 */
export function rankFor(mastery: Record<string, MasteryStage>): string {
  const stages = Object.values(mastery).map((s) => MASTERY_STAGES.indexOf(s)).filter((n) => n > 0)
  const points = stages.reduce((sum, n) => sum + n, 0)
  const top = (MASTERY_STAGES.length - 1) * Math.max(RANK_MIN_KNOWN, stages.length)
  const share = points / top
  for (const [need, name] of RANK_STEPS) if (share >= need - 1e-9) return name
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
