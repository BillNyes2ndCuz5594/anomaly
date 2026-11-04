import type { AnswerRecord, CaseKind, CaseStep } from './session'

export interface CaseResume {
  v: 1
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
}

export function caseResumeKey(kind: string, caseId: string): string {
  return `anomaly.case.${kind}.${caseId}`
}

function isAnswerRecord(a: unknown): a is AnswerRecord {
  if (!a || typeof a !== 'object') return false
  const r = a as Record<string, unknown>
  return (
    typeof r.itemId === 'string' && typeof r.picked === 'number' && typeof r.correct === 'boolean' &&
    typeof r.keyTagged === 'number' && typeof r.eliminated === 'number' && typeof r.hintsUsed === 'number' && typeof r.intel === 'number'
  )
}

export function loadCaseResume(storage: { getItem(k: string): string | null }, kind: CaseKind, caseId: string): CaseResume | null {
  try {
    const raw = storage.getItem(caseResumeKey(kind, caseId))
    if (!raw) return null
    const s = JSON.parse(raw)
    if (!s || typeof s !== 'object' || Array.isArray(s)) return null
    if (s.v !== 1 || s.day !== new Date().toDateString() || s.kind !== kind || s.caseId !== caseId) return null
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
