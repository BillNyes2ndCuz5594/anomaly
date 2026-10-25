// Pure glue between game progress and report codes. No store here, so it is easy to test.
import { CATALOG_BENCHMARKS, CATALOG_ITEMS } from '../lib/catalog.generated'
import { classHash, dayNumber, dayToISO, MAX_RECENT, type ReportData } from '../lib/reportCode'
import { addSchoolDays, emptyRecord, stageIndex, type BenchmarkRecord, type MasteryStage } from './mastery'

export interface ProgressSlice {
  progress: Record<string, BenchmarkRecord>
  itemHistory: { itemId: string; correct: boolean; date: string }[]
}

export function buildReportData(
  profile: { classCode: string; agentNumber: number },
  slice: ProgressSlice,
  today: string,
): Omit<ReportData, 'version'> {
  const known = new Set(CATALOG_BENCHMARKS.map((b) => b.id))
  const itemIds = new Set(CATALOG_ITEMS.map((i) => i.id))
  return {
    classHash: classHash(profile.classCode),
    agent: profile.agentNumber,
    day: dayNumber(today),
    benchmarks: Object.entries(slice.progress)
      .filter(([id, r]) => known.has(id) && r.attempts > 0)
      .map(([id, r]) => ({ id, attempts: r.attempts, correct: r.correct, stage: r.stage })),
    recent: slice.itemHistory.filter((h) => itemIds.has(h.itemId)).slice(-MAX_RECENT).map((h) => ({ itemId: h.itemId, correct: h.correct })),
  }
}

export interface MergeResult extends ProgressSlice {
  mastery: Record<string, MasteryStage>
  /** Benchmarks whose record changed. */
  changed: string[]
}

/**
 * Merges a decoded report into local progress. Never lowers anything:
 * the record with more attempts wins its counts, the higher stage wins, the later date wins.
 */
export function mergeReport(slice: ProgressSlice, report: ReportData): MergeResult {
  const date = dayToISO(report.day)
  const progress = { ...slice.progress }
  const changed: string[] = []
  for (const b of report.benchmarks) {
    const have = progress[b.id]
    const base = have ?? emptyRecord()
    const useCode = !have || b.attempts > have.attempts
    const stage = stageIndex(b.stage) > stageIndex(base.stage) ? b.stage : base.stage
    const next: BenchmarkRecord = {
      ...base,
      attempts: useCode ? b.attempts : base.attempts,
      correct: useCode ? b.correct : base.correct,
      stage,
      lastSeen: !base.lastSeen || base.lastSeen < date ? date : base.lastSeen,
      correctDays: Math.max(base.correctDays, stageIndex(stage)),
      nextDue: base.nextDue ?? addSchoolDays(date, 1),
    }
    if (JSON.stringify(next) !== JSON.stringify(have)) {
      progress[b.id] = next
      changed.push(b.id)
    }
  }
  const seen = new Set(slice.itemHistory.map((h) => `${h.itemId}|${h.correct}|${h.date}`))
  const restored = report.recent
    .map((r) => ({ itemId: r.itemId, correct: r.correct, date }))
    .filter((h) => !seen.has(`${h.itemId}|${h.correct}|${h.date}`))
  const mastery: Record<string, MasteryStage> = {}
  for (const [id, r] of Object.entries(progress)) mastery[id] = r.stage
  return { progress, mastery, itemHistory: [...restored, ...slice.itemHistory], changed }
}
