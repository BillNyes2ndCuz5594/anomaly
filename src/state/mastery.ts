// Pure progression logic (SPEC section 8). No store, no clock: callers pass ISO dates (YYYY-MM-DD).

export type MasteryStage = 'unseen' | 'rookie' | 'field-ready' | 'expert' | 'ace'
export const MASTERY_STAGES: readonly MasteryStage[] = ['unseen', 'rookie', 'field-ready', 'expert', 'ace']

/** School day gaps for spaced review. A miss resets to the first gap. */
export const REVIEW_GAPS: readonly number[] = [1, 3, 7, 14]

/** Expert and Ace also need this overall accuracy, so guessing alone cannot carry a benchmark. */
export const ACCURACY_GATE = 0.7
export const ACCURACY_GATE_FROM: MasteryStage = 'expert'

export interface BenchmarkRecord {
  attempts: number
  correct: number
  /** ISO date of the most recent attempt, or null. */
  lastSeen: string | null
  stage: MasteryStage
  /** Number of separate days with at least one correct answer. */
  correctDays: number
  lastCorrectDay: string | null
  /** ISO date of the last stage-up. Limits stage-ups to one per day. */
  lastStageUp: string | null
  /** Index into REVIEW_GAPS. */
  reviewIdx: number
  /** ISO date the next review is due, or null when nothing is scheduled. */
  nextDue: string | null
}

export function emptyRecord(): BenchmarkRecord {
  return {
    attempts: 0,
    correct: 0,
    lastSeen: null,
    stage: 'unseen',
    correctDays: 0,
    lastCorrectDay: null,
    lastStageUp: null,
    reviewIdx: 0,
    nextDue: null,
  }
}

// ---------- dates ----------

const DAY_MS = 86_400_000

/** Local calendar date as YYYY-MM-DD. */
export function toISODate(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Parses YYYY-MM-DD as a UTC midnight timestamp so day math ignores time zones and DST. */
export function parseISO(iso: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) throw new Error(`Bad ISO date: ${iso}`)
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

function fromTime(t: number): string {
  const d = new Date(t)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

export function isSchoolDay(iso: string): boolean {
  const dow = new Date(parseISO(iso)).getUTCDay()
  return dow !== 0 && dow !== 6
}

/** The date `n` school days after `iso`. Saturday and Sunday are skipped. n of 0 returns iso. */
export function addSchoolDays(iso: string, n: number): string {
  let t = parseISO(iso)
  let left = n
  while (left > 0) {
    t += DAY_MS
    if (isSchoolDay(fromTime(t))) left--
  }
  return fromTime(t)
}

/** Whole school days from a to b (b after a is positive). Counts the days after a up to and including b. */
export function schoolDaysBetween(a: string, b: string): number {
  let t = parseISO(a)
  const end = parseISO(b)
  let n = 0
  if (end >= t) {
    while (t < end) {
      t += DAY_MS
      if (isSchoolDay(fromTime(t))) n++
    }
    return n
  }
  while (t > end) {
    if (isSchoolDay(fromTime(t))) n--
    t -= DAY_MS
  }
  return n
}

// ---------- stage rules ----------

export function stageIndex(s: MasteryStage): number {
  return MASTERY_STAGES.indexOf(s)
}

/** Highest stage the record qualifies for right now: one step per separate day with a correct answer. */
export function targetStage(rec: BenchmarkRecord): MasteryStage {
  let idx = Math.min(rec.correctDays, MASTERY_STAGES.length - 1)
  const accuracy = rec.attempts ? rec.correct / rec.attempts : 0
  const gateIdx = stageIndex(ACCURACY_GATE_FROM)
  if (idx >= gateIdx && accuracy < ACCURACY_GATE) idx = gateIdx - 1
  return MASTERY_STAGES[idx]
}

export interface ApplyOutcome {
  record: BenchmarkRecord
  stageUp: boolean
}

/**
 * Applies one answered item to a benchmark record.
 * Stage rises by at most one step, at most once per day, and only from a correct answer
 * on a day that has not already counted. A miss resets the review gap to the first gap.
 */
export function applyResult(rec: BenchmarkRecord, correct: boolean, today: string): ApplyOutcome {
  const next: BenchmarkRecord = { ...rec, attempts: rec.attempts + 1, correct: rec.correct + (correct ? 1 : 0), lastSeen: today }
  let stageUp = false

  if (correct) {
    if (rec.lastCorrectDay !== today) {
      next.correctDays = rec.correctDays + 1
      next.lastCorrectDay = today
    }
    if (rec.lastStageUp !== today) {
      const cur = stageIndex(next.stage)
      const target = stageIndex(targetStage(next))
      if (target > cur) {
        next.stage = MASTERY_STAGES[cur + 1]
        next.lastStageUp = today
        stageUp = true
      }
    }
    const due = next.nextDue === null || next.nextDue <= today
    if (next.nextDue === null) {
      next.reviewIdx = 0
      next.nextDue = addSchoolDays(today, REVIEW_GAPS[0])
    } else if (due) {
      next.reviewIdx = Math.min(rec.reviewIdx + 1, REVIEW_GAPS.length - 1)
      next.nextDue = addSchoolDays(today, REVIEW_GAPS[next.reviewIdx])
    }
  } else {
    next.reviewIdx = 0
    next.nextDue = addSchoolDays(today, REVIEW_GAPS[0])
  }
  return { record: next, stageUp }
}

/** True when a review is due on `today` (or earlier). Unscheduled benchmarks are not due. */
export function isDue(rec: BenchmarkRecord | undefined, today: string): boolean {
  return !!rec && rec.nextDue !== null && rec.nextDue <= today
}

/** Benchmarks with a review due, most overdue first. */
export function dueBenchmarks(progress: Record<string, BenchmarkRecord>, today: string): string[] {
  return Object.entries(progress)
    .filter(([, r]) => isDue(r, today))
    .sort((a, b) => (a[1].nextDue ?? '').localeCompare(b[1].nextDue ?? ''))
    .map(([id]) => id)
}

/** Fraction filled for a mastery bar, 0 to 1. */
export function stageFraction(stage: MasteryStage): number {
  return stageIndex(stage) / (MASTERY_STAGES.length - 1)
}

/** Drone paints, unlocked by mastery only. Okabe-Ito names. */
export const DRONE_PAINTS = ['Sky', 'Orange', 'Bluish green', 'Vermillion', 'Reddish purple', 'Yellow', 'Blue', 'Cyan glow'] as const

/** The paint a given total of mastery points unlocks. Points are the sum of stage indexes. */
export function paintForPoints(points: number): string | null {
  if (points < 1) return null
  return DRONE_PAINTS[(points - 1) % DRONE_PAINTS.length]
}

export function totalPoints(progress: Record<string, BenchmarkRecord>): number {
  return Object.values(progress).reduce((sum, r) => sum + stageIndex(r.stage), 0)
}
