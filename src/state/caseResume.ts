import { clampAgentNumber, sanitizeClassCode } from '../lib/codename'
import type { AnswerRecord, CaseKind, CaseStep } from './session'
import type { Item } from '../content/schema'
import { initLab, labReduce, type GenericLab, type LabState } from '../screens/case/labGenericData'
import { useGame } from './store'

export interface CaseResume {
  v: 1
  /** Which agent wrote this checkpoint (see caseResumeOwner). Checkpoints without a matching owner are ignored. */
  owner: string
  day: string
  kind: CaseKind
  caseId: string
  step: CaseStep
  itemIds: string[]
  itemIndex: number
  answers: AnswerRecord[]
  benchmarks: string[]
  stagesBefore: Record<string, string>
  stageUps: number
  paint: string | null
  lab?: { step: 'lab'; placed: Record<string, string>; current: string | null } | null
  pendingFeedback?: { itemId: string; picked: number } | null
}

export function caseResumeKey(kind: string, caseId: string): string {
  return `anomaly.case.${kind}.${caseId}`
}

/** Owner stamp from the sanitized class code and agent number. Defaults to the profile in the game store. */
export function caseResumeOwner(
  profile: { classCode: string; agentNumber: number } | null = useGame.getState().profile,
): string {
  if (!profile) return 'none'
  return `${sanitizeClassCode(profile.classCode)}|${clampAgentNumber(profile.agentNumber)}`
}

function isAnswerRecord(a: unknown): a is AnswerRecord {
  if (!a || typeof a !== 'object') return false
  const r = a as Record<string, unknown>
  return (
    typeof r.itemId === 'string' && typeof r.picked === 'number' && typeof r.correct === 'boolean' &&
    typeof r.keyTagged === 'number' && typeof r.eliminated === 'number' && typeof r.hintsUsed === 'number' && typeof r.intel === 'number'
  )
}

export function loadCaseResume(
  storage: { getItem(k: string): string | null },
  kind: CaseKind,
  caseId: string,
  owner: string = caseResumeOwner(),
): CaseResume | null {
  try {
    const raw = storage.getItem(caseResumeKey(kind, caseId))
    if (!raw) return null
    const s = JSON.parse(raw)
    if (!s || typeof s !== 'object' || Array.isArray(s)) return null
    if (s.v !== 1 || s.day !== new Date().toDateString() || s.kind !== kind || s.caseId !== caseId) return null
    if (typeof s.owner !== 'string' || s.owner !== owner) return null
    if (typeof s.step !== 'string' || typeof s.stageUps !== 'number' || (s.paint !== null && typeof s.paint !== 'string')) return null
    if (typeof s.itemIndex !== 'number' || !Number.isInteger(s.itemIndex) || s.itemIndex < 0) return null
    if (!Array.isArray(s.itemIds) || !s.itemIds.every((id: unknown) => typeof id === 'string')) return null
    if (!Array.isArray(s.answers) || !s.answers.every(isAnswerRecord)) return null
    if (!Array.isArray(s.benchmarks) || !s.benchmarks.every((b: unknown) => typeof b === 'string')) return null
    if (!s.stagesBefore || typeof s.stagesBefore !== 'object' || Array.isArray(s.stagesBefore)) return null
    if (!Object.values(s.stagesBefore).every((v: unknown) => typeof v === 'string')) return null
    return s as CaseResume
  } catch {
    return null
  }
}

export function saveCaseResume(storage: { setItem(k: string, v: string): void }, s: CaseResume): void {
  try {
    storage.setItem(caseResumeKey(s.kind, s.caseId), JSON.stringify(s))
  } catch {
    // Ignore storage quota or disabled errors
  }
}

export function clearCaseResume(storage: { removeItem(k: string): void }, kind: CaseKind | string, caseId: string): void {
  try {
    storage.removeItem(caseResumeKey(kind, caseId))
  } catch {
    // Ignore errors
  }
}

/** Tab recovery only. Reuse the lab rules so changed data cannot restore invalid pairs. */
export function restoreLab(lab: GenericLab, saved: unknown, seed: string): LabState {
  const fresh = initLab(lab, seed)
  if (!saved || typeof saved !== 'object') return fresh
  const s = saved as NonNullable<CaseResume['lab']>
  if (s.step !== 'lab' || !s.placed || typeof s.placed !== 'object' || Array.isArray(s.placed)) return fresh
  let state = fresh
  for (const [card, target] of Object.entries(s.placed)) {
    if (typeof target !== 'string' || !fresh.cards.includes(card)) return fresh
    state = labReduce(lab, state, { type: 'select', id: card })
    state = labReduce(lab, state, { type: 'place', target: lab.kind === 'order' ? card : target })
    if (!state.feedback?.ok || state.placed[card] !== target) return fresh
  }
  if (s.current !== null && (typeof s.current !== 'string' || !fresh.cards.includes(s.current) || s.current in state.placed)) return fresh
  if (lab.kind === 'order' ? s.current !== null : s.current === null && Object.keys(state.placed).length < fresh.cards.length) return fresh
  return { ...state, current: s.current, feedback: null, tries: 0, misses: 0 }
}

/** Return the existing submission, never grade or score during recovery. */
export function resumeFeedback(saved: CaseResume, items: Item[]): AnswerRecord | null {
  const marker = saved.pendingFeedback
  if (saved.step !== 'items' || !marker || typeof marker !== 'object') return null
  const item = items[saved.itemIndex]
  if (!item || marker.itemId !== item.id || !Number.isInteger(marker.picked) || marker.picked < 0 || marker.picked >= item.options.length) return null
  return saved.answers.find((a) => a.itemId === marker.itemId && a.picked === marker.picked) ?? null
}

export const clearCaseCheckpoint = clearCaseResume
