import { create } from 'zustand'
import type { Item } from '../content/schema'
import { content } from '../content/schema'
import { pickEvidence } from '../lib/rkea'
import { pickReview } from '../lib/scheduler'
import { toISODate } from './mastery'
import { useGame } from './store'

export type CaseStep = 'briefing' | 'lab-a' | 'lab-b' | 'lab-c' | 'items' | 'debrief' | 'results'

export const CASE_STEPS: readonly { id: CaseStep; label: string }[] = [
  { id: 'briefing', label: 'Briefing' },
  { id: 'lab-a', label: 'Lab A' },
  { id: 'lab-b', label: 'Lab B' },
  { id: 'lab-c', label: 'Lab C' },
  { id: 'items', label: 'Evidence' },
  { id: 'debrief', label: 'Debrief' },
  { id: 'results', label: 'Results' },
]

export type CaseKind = 'case' | 'cold'

/** Cold cases skip the labs: an evidence scan intro (step "briefing"), the items, debrief, results. */
export const COLD_STEPS: readonly { id: CaseStep; label: string }[] = [
  { id: 'briefing', label: 'Scan' },
  { id: 'items', label: 'Evidence' },
  { id: 'debrief', label: 'Debrief' },
  { id: 'results', label: 'Results' },
]

export function stepsFor(kind: CaseKind) {
  return kind === 'cold' ? COLD_STEPS : CASE_STEPS
}

export interface AnswerRecord {
  itemId: string
  picked: number
  correct: boolean
  keyTagged: number
  eliminated: number
  hintsUsed: number
  intel: number
}

export interface ResultsSummary {
  /** Per benchmark: stage before and after this case. */
  stages: Record<string, { before: string; after: string; attempts: number; correct: number }>
  intel: number
  paint: string | null
  closed: boolean
}

interface SessionState {
  caseId: string | null
  kind: CaseKind
  step: CaseStep
  items: Item[]
  /** Benchmarks this case covers, for the results bars. */
  benchmarks: string[]
  answers: AnswerRecord[]
  /** Stage per benchmark when the case started, for the results bars. */
  stagesBefore: Record<string, string>
  stageUps: number
  paint: string | null
  start: (caseId: string, kind?: CaseKind) => void
  go: (step: CaseStep) => void
  next: () => void
  addAnswer: (a: AnswerRecord, stageUp: boolean, paint: string | null) => void
}

export function newSeed(): string {
  const p = useGame.getState().profile
  return `${p?.classCode ?? ''}${p?.agentNumber ?? 0}|${new Date().toDateString()}`
}

export const useSession = create<SessionState>((set, get) => ({
  caseId: null,
  kind: 'case',
  step: 'briefing',
  items: [],
  benchmarks: [],
  answers: [],
  stagesBefore: {},
  stageUps: 0,
  paint: null,
  start: (caseId, kind = 'case') => {
    const st = useGame.getState()
    const items =
      kind === 'cold'
        ? pickReview(content.items, st.progress, st.itemHistory, toISODate(), newSeed())
        : pickEvidence(content.items, st.itemHistory, newSeed())
    const benchmarks = kind === 'cold' ? [...new Set(items.map((i) => i.benchmark))] : content.case.benchmarks
    const before: Record<string, string> = {}
    for (const b of benchmarks) before[b] = st.progress[b]?.stage ?? 'unseen'
    set({ caseId, kind, step: 'briefing', items, benchmarks, answers: [], stagesBefore: before, stageUps: 0, paint: null })
  },
  go: (step) => set({ step }),
  next: () => {
    const steps = stepsFor(get().kind)
    const i = steps.findIndex((s) => s.id === get().step)
    const n = steps[Math.min(i + 1, steps.length - 1)]
    set({ step: n.id })
  },
  addAnswer: (a, stageUp, paint) =>
    set((s) => ({
      answers: [...s.answers, a],
      stageUps: s.stageUps + (stageUp ? 1 : 0),
      paint: paint ?? s.paint,
    })),
}))

/** Transient 3D and HUD coupling for the labs. Not persisted. */
interface FxState {
  hover: string | null
  /** Last result flash: which part, ok or not, and a counter so repeats retrigger. */
  flash: { id: string; ok: boolean; n: number } | null
  /** Parts that should stay lit (completed or armed). */
  lit: string[]
  /** Called by the 3D layer when a part is clicked. The active lab registers it. */
  pick: ((id: string) => void) | null
  /** Lab B matched pairs: [animalPartId, plantPartId] */
  bridges: [string, string][]
  /** Lab C specimen on the turntable. */
  specimen: string | null
  setHover: (id: string | null) => void
  flashPart: (id: string, ok: boolean) => void
  setLit: (ids: string[]) => void
  setPick: (fn: ((id: string) => void) | null) => void
  setBridges: (b: [string, string][]) => void
  setSpecimen: (id: string | null) => void
}

export const useFx = create<FxState>((set) => ({
  hover: null,
  flash: null,
  lit: [],
  pick: null,
  bridges: [],
  specimen: null,
  setHover: (hover) => set({ hover }),
  flashPart: (id, ok) => set((s) => ({ flash: { id, ok, n: (s.flash?.n ?? 0) + 1 } })),
  setLit: (lit) => set({ lit }),
  setPick: (pick) => set({ pick }),
  setBridges: (bridges) => set({ bridges }),
  setSpecimen: (specimen) => set({ specimen }),
}))
