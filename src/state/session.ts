import { createTapGuard } from '../ui/tapGuard'
import { create } from 'zustand'
import type { CaseDef, Item } from '../content/schema'
import { caseById, content, vitalsCase } from '../content'
import { QA_ITEMS } from '../lib/flags'
import { pickEvidence } from '../lib/rkea'
import { pickReview } from '../lib/scheduler'
import { toISODate } from './mastery'
import { useGame } from './store'

export type CaseStep = 'briefing' | 'lab-a' | 'lab-b' | 'lab-c' | 'lab' | 'items' | 'debrief' | 'results'

export const CASE_STEPS: readonly { id: CaseStep; label: string }[] = [
  { id: 'briefing', label: 'Briefing' },
  { id: 'lab-a', label: 'Lab A' },
  { id: 'lab-b', label: 'Lab B' },
  { id: 'lab-c', label: 'Lab C' },
  { id: 'items', label: 'Evidence' },
  { id: 'debrief', label: 'Debrief' },
  { id: 'results', label: 'Results' },
]

/** Any case other than VITALS: one generic Field Lab (sort, match or order) from the case's `lab`. */
export const LAB_STEPS: readonly { id: CaseStep; label: string }[] = [
  { id: 'briefing', label: 'Briefing' },
  { id: 'lab', label: 'Field Lab' },
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

/** Steps for a case kind. VITALS (or no case yet) keeps its three labs; every other case gets the generic Field Lab. */
export function stepsFor(kind: CaseKind, caseDef?: CaseDef | null) {
  if (kind === 'cold') return COLD_STEPS
  return caseDef && caseDef.lab.kind !== 'vitals' ? LAB_STEPS : CASE_STEPS
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
  /** The case being played (null for the cold case and before start). */
  caseDef: CaseDef | null
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
  caseDef: null,
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
    const caseDef = kind === 'case' ? caseById(caseId) ?? vitalsCase : null
    const qa = kind === 'case' ? QA_ITEMS.map((id) => content.items.find((it) => it.id === id)) : []
    const items =
      qa.length > 0 && qa.every(Boolean)
        ? (qa as Item[])
        : kind === 'cold'
        ? pickReview(content.items, st.progress, st.itemHistory, toISODate(), newSeed())
        : pickEvidence(content.items, st.itemHistory, newSeed(), (caseDef ?? vitalsCase).evidencePlan)
    const benchmarks = kind === 'cold' ? [...new Set(items.map((i) => i.benchmark))] : (caseDef ?? vitalsCase).benchmarks
    const before: Record<string, string> = {}
    for (const b of benchmarks) before[b] = st.progress[b]?.stage ?? 'unseen'
    set({ caseId, caseDef, kind, step: 'briefing', items, benchmarks, answers: [], stagesBefore: before, stageUps: 0, paint: null })
  },
  go: (step) => set({ step }),
  next: () => {
    const steps = stepsFor(get().kind, get().caseDef)
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
  /** Generic Field Lab: the card on the dais (null for an order lab or when every card is placed). */
  card: string | null
  setHover: (id: string | null) => void
  flashPart: (id: string, ok: boolean) => void
  setLit: (ids: string[]) => void
  setPick: (fn: ((id: string) => void) | null) => void
  setBridges: (b: [string, string][]) => void
  setSpecimen: (id: string | null) => void
  setCard: (id: string | null) => void
}

const admitFlash = createTapGuard()

export const useFx = create<FxState>((set) => ({
  hover: null,
  flash: null,
  lit: [],
  pick: null,
  bridges: [],
  specimen: null,
  card: null,
  setHover: (hover) => set({ hover }),
  flashPart: (id, ok) => {
    if (admitFlash(`${id}:${ok}`, 450)) set((s) => ({ flash: { id, ok, n: (s.flash?.n ?? 0) + 1 } }))
  },
  setLit: (lit) => set({ lit }),
  setPick: (pick) => set({ pick }),
  setBridges: (bridges) => set({ bridges }),
  setSpecimen: (specimen) => set({ specimen }),
  setCard: (card) => set({ card }),
}))
