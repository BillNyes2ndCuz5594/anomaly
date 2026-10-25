import { describe, expect, it } from 'vitest'
import {
  addSchoolDays,
  applyResult,
  dueBenchmarks,
  emptyRecord,
  isDue,
  isSchoolDay,
  paintForPoints,
  schoolDaysBetween,
  targetStage,
  toISODate,
  type BenchmarkRecord,
} from './mastery'

// 2026-10-23 is a Friday.
describe('school day math', () => {
  it('knows weekends', () => {
    expect(isSchoolDay('2026-10-23')).toBe(true)
    expect(isSchoolDay('2026-10-24')).toBe(false)
    expect(isSchoolDay('2026-10-25')).toBe(false)
    expect(isSchoolDay('2026-10-26')).toBe(true)
  })

  it('adds school days and skips Saturday and Sunday', () => {
    expect(addSchoolDays('2026-10-22', 1)).toBe('2026-10-23')
    expect(addSchoolDays('2026-10-23', 1)).toBe('2026-10-26')
    expect(addSchoolDays('2026-10-24', 1)).toBe('2026-10-26')
    expect(addSchoolDays('2026-10-23', 3)).toBe('2026-10-28')
    expect(addSchoolDays('2026-10-23', 7)).toBe('2026-11-03')
    expect(addSchoolDays('2026-10-23', 14)).toBe('2026-11-12')
    expect(addSchoolDays('2026-10-23', 0)).toBe('2026-10-23')
  })

  it('counts school days between dates', () => {
    expect(schoolDaysBetween('2026-10-23', '2026-10-26')).toBe(1)
    expect(schoolDaysBetween('2026-10-23', '2026-10-30')).toBe(5)
    expect(schoolDaysBetween('2026-10-26', '2026-10-26')).toBe(0)
    expect(schoolDaysBetween('2026-10-26', '2026-10-23')).toBe(-1)
  })

  it('formats local dates', () => {
    expect(toISODate(new Date(2026, 9, 5))).toBe('2026-10-05')
  })
})

describe('stage rules', () => {
  const day = (n: number) => addSchoolDays('2026-10-05', n)

  it('goes Unseen to Rookie on the first correct answer', () => {
    const r = applyResult(emptyRecord(), true, day(0))
    expect(r.stageUp).toBe(true)
    expect(r.record.stage).toBe('rookie')
    expect(r.record.attempts).toBe(1)
    expect(r.record.lastSeen).toBe(day(0))
  })

  it('stays Unseen after a miss', () => {
    const r = applyResult(emptyRecord(), false, day(0))
    expect(r.stageUp).toBe(false)
    expect(r.record.stage).toBe('unseen')
    expect(r.record.attempts).toBe(1)
    expect(r.record.correct).toBe(0)
  })

  it('allows only one stage-up per day however many answers are correct', () => {
    let rec = emptyRecord()
    let ups = 0
    for (let i = 0; i < 6; i++) {
      const r = applyResult(rec, true, day(0))
      rec = r.record
      if (r.stageUp) ups++
    }
    expect(ups).toBe(1)
    expect(rec.stage).toBe('rookie')
    expect(rec.correctDays).toBe(1)
  })

  it('needs correct answers on separate days to keep climbing', () => {
    let rec = emptyRecord()
    const stages: string[] = []
    for (let d = 0; d < 5; d++) {
      rec = applyResult(rec, true, day(d)).record
      rec = applyResult(rec, true, day(d)).record
      stages.push(rec.stage)
    }
    expect(stages).toEqual(['rookie', 'field-ready', 'expert', 'ace', 'ace'])
  })

  it('does not stage up on a day with only misses', () => {
    let rec = applyResult(emptyRecord(), true, day(0)).record
    const r = applyResult(rec, false, day(1))
    rec = r.record
    expect(r.stageUp).toBe(false)
    expect(rec.stage).toBe('rookie')
  })

  it('gates Expert on accuracy', () => {
    const base: BenchmarkRecord = { ...emptyRecord(), attempts: 20, correct: 8, correctDays: 3, stage: 'field-ready' }
    expect(targetStage(base)).toBe('field-ready')
    expect(targetStage({ ...base, correct: 16 })).toBe('expert')
  })

  it('never demotes a stage on a miss', () => {
    let rec = emptyRecord()
    rec = applyResult(rec, true, day(0)).record
    rec = applyResult(rec, true, day(1)).record
    rec = applyResult(rec, false, day(2)).record
    expect(rec.stage).toBe('field-ready')
  })
})

describe('review schedule', () => {
  it('schedules the first review one school day out', () => {
    const { record } = applyResult(emptyRecord(), true, '2026-10-23')
    expect(record.nextDue).toBe('2026-10-26')
    expect(record.reviewIdx).toBe(0)
  })

  it('walks 1, 3, 7, 14 as reviews come due and are answered correctly', () => {
    let rec = applyResult(emptyRecord(), true, '2026-10-05').record
    expect(rec.nextDue).toBe('2026-10-06')
    rec = applyResult(rec, true, '2026-10-06').record
    expect(rec.reviewIdx).toBe(1)
    expect(rec.nextDue).toBe('2026-10-09')
    rec = applyResult(rec, true, '2026-10-09').record
    expect(rec.reviewIdx).toBe(2)
    expect(rec.nextDue).toBe('2026-10-20')
    rec = applyResult(rec, true, '2026-10-20').record
    expect(rec.reviewIdx).toBe(3)
    expect(rec.nextDue).toBe('2026-11-09')
    rec = applyResult(rec, true, '2026-11-09').record
    expect(rec.reviewIdx).toBe(3)
  })

  it('does not advance the gap for extra practice before the review is due', () => {
    let rec = applyResult(emptyRecord(), true, '2026-10-05').record
    rec = applyResult(rec, true, '2026-10-05').record
    expect(rec.reviewIdx).toBe(0)
    expect(rec.nextDue).toBe('2026-10-06')
  })

  it('resets to the 1 day gap on a miss', () => {
    let rec = applyResult(emptyRecord(), true, '2026-10-05').record
    rec = applyResult(rec, true, '2026-10-06').record
    rec = applyResult(rec, true, '2026-10-09').record
    expect(rec.reviewIdx).toBe(2)
    rec = applyResult(rec, false, '2026-10-12').record
    expect(rec.reviewIdx).toBe(0)
    expect(rec.nextDue).toBe('2026-10-13')
  })

  it('reports due benchmarks, most overdue first', () => {
    const a = { ...emptyRecord(), nextDue: '2026-10-05' }
    const b = { ...emptyRecord(), nextDue: '2026-10-02' }
    const c = { ...emptyRecord(), nextDue: '2026-10-20' }
    expect(isDue(a, '2026-10-05')).toBe(true)
    expect(isDue(c, '2026-10-05')).toBe(false)
    expect(isDue(undefined, '2026-10-05')).toBe(false)
    expect(dueBenchmarks({ A: a, B: b, C: c }, '2026-10-05')).toEqual(['B', 'A'])
  })
})

describe('paints', () => {
  it('unlocks nothing at zero points and a paint after that', () => {
    expect(paintForPoints(0)).toBeNull()
    expect(paintForPoints(1)).toBe('Sky')
    expect(paintForPoints(2)).toBe('Orange')
  })
})
