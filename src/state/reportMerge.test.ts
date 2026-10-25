import { describe, expect, it } from 'vitest'
import { CATALOG_BENCHMARKS, CATALOG_ITEMS } from '../lib/catalog.generated'
import { classHash, decodeReport, encodeReport } from '../lib/reportCode'
import { content } from '../content/schema'
import { applyResult, emptyRecord, type BenchmarkRecord } from './mastery'
import { buildReportData, mergeReport } from './reportMerge'

const profile = { classCode: 'DEMO', agentNumber: 14 }

function played(): { progress: Record<string, BenchmarkRecord>; itemHistory: { itemId: string; correct: boolean; date: string }[] } {
  let r = emptyRecord()
  for (const ok of [true, true, false, true]) r = applyResult(r, ok, '2026-10-20').record
  return {
    progress: { 'SC.5.L.14.1': r },
    itemHistory: [
      { itemId: 'L14-01', correct: true, date: '2026-10-20' },
      { itemId: 'L14-02', correct: false, date: '2026-10-20' },
    ],
  }
}

describe('catalog', () => {
  it('lists every content benchmark and item, with unique entries', () => {
    const b = new Set(CATALOG_BENCHMARKS.map((x) => x.id))
    expect(b.size).toBe(CATALOG_BENCHMARKS.length)
    for (const it of content.items) {
      expect(b.has(it.benchmark), it.benchmark).toBe(true)
      expect(CATALOG_ITEMS.find((c) => c.id === it.id)?.benchmark, it.id).toBe(it.benchmark)
    }
    expect(new Set(CATALOG_ITEMS.map((x) => x.id)).size).toBe(CATALOG_ITEMS.length)
  })

  it('fits the code field widths and has no dashes in labels or stems', () => {
    expect(CATALOG_BENCHMARKS.length).toBeLessThanOrEqual(31)
    expect(CATALOG_ITEMS.length).toBeLessThanOrEqual(128)
    for (const s of [...CATALOG_BENCHMARKS.map((b) => b.label), ...CATALOG_ITEMS.map((i) => i.stem)]) {
      expect(s).not.toMatch(/[\u2013\u2014]/)
    }
  })

  it('keeps the first benchmarks in their frozen order', () => {
    expect(CATALOG_BENCHMARKS.slice(0, 3).map((b) => b.id)).toEqual(['SC.5.L.14.1', 'SC.5.L.14.2', 'SC.3.L.15.1'])
  })
})

describe('report from game state', () => {
  it('encodes progress and restores it on an empty device', () => {
    const slice = played()
    const code = encodeReport(buildReportData(profile, slice, '2026-10-24'))
    const res = decodeReport(code)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.report.classHash).toBe(classHash('DEMO'))
    expect(res.report.agent).toBe(14)
    const merged = mergeReport({ progress: {}, itemHistory: [] }, res.report)
    const rec = merged.progress['SC.5.L.14.1']
    expect(rec).toMatchObject({ attempts: 4, correct: 3, stage: slice.progress['SC.5.L.14.1'].stage })
    expect(rec.nextDue).toBeTruthy()
    expect(merged.itemHistory.map((h) => h.itemId)).toEqual(['L14-01', 'L14-02'])
    expect(merged.mastery['SC.5.L.14.1']).toBe(rec.stage)
  })

  it('merge never lowers local progress', () => {
    const local = played()
    local.progress['SC.5.L.14.1'] = { ...local.progress['SC.5.L.14.1'], attempts: 20, correct: 18, stage: 'expert', nextDue: '2026-11-02', lastSeen: '2026-10-25', correctDays: 3 }
    const old = decodeReport(encodeReport({ ...buildReportData(profile, played(), '2026-10-24') }))
    if (!old.ok) throw new Error('decode')
    const merged = mergeReport(local, old.report)
    expect(merged.progress['SC.5.L.14.1']).toMatchObject({ attempts: 20, correct: 18, stage: 'expert', nextDue: '2026-11-02' })
    expect(merged.changed).toEqual([])
  })

  it('merge lifts stage and counts when the code is ahead, keeps other benchmarks', () => {
    const local = played()
    local.progress['SC.3.L.15.1'] = { ...emptyRecord(), attempts: 2, correct: 2, stage: 'rookie' }
    const ahead = buildReportData(profile, played(), '2026-10-24')
    ahead.benchmarks[0] = { id: 'SC.5.L.14.1', attempts: 30, correct: 25, stage: 'ace' }
    const dec = decodeReport(encodeReport(ahead))
    if (!dec.ok) throw new Error('decode')
    const merged = mergeReport(local, dec.report)
    expect(merged.progress['SC.5.L.14.1']).toMatchObject({ attempts: 30, correct: 25, stage: 'ace' })
    expect(merged.progress['SC.3.L.15.1'].stage).toBe('rookie')
  })

  it('does not duplicate history when merging a code from the same day', () => {
    const slice = { progress: played().progress, itemHistory: played().itemHistory.map((h) => ({ ...h, date: '2026-10-24' })) }
    const dec = decodeReport(encodeReport(buildReportData(profile, slice, '2026-10-24')))
    if (!dec.ok) throw new Error('decode')
    expect(mergeReport(slice, dec.report).itemHistory).toHaveLength(2)
  })
})
