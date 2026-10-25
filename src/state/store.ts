import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { clampAgentNumber, generateCodename, sanitizeClassCode } from '../lib/codename'
import { defaultSettings, type Settings } from './settings'

export const STORAGE_KEY = 'anomaly.v1'

export type MasteryStage = 'unseen' | 'rookie' | 'field-ready' | 'expert' | 'ace'
export const MASTERY_STAGES: readonly MasteryStage[] = ['unseen', 'rookie', 'field-ready', 'expert', 'ace']
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

export interface GameState {
  settings: Settings
  profile: Profile | null
  /** Benchmark id to mastery stage. Missing means unseen. */
  mastery: Record<string, MasteryStage>
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
    (set) => ({
      settings: defaultSettings(),
      profile: null,
      mastery: {},
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
      partialize: (s) => ({ settings: s.settings, profile: s.profile, mastery: s.mastery }),
      // Fill any setting added in a later version with its default.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<GameState>
        return { ...current, ...p, settings: { ...current.settings, ...(p.settings ?? {}) } }
      },
    },
  ),
)
