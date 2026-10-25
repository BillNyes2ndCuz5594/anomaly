import { describe, expect, it } from 'vitest'
import { CATALOG_BENCHMARKS, CATALOG_ITEMS } from './catalog.generated'
import { classHash, dayNumber, dayToISO, decodeAll, decodeReport, encodeReport, extractCodes, groupCode, type ReportData } from './reportCode'

const sample = (): Omit<ReportData, 'version'> => ({
  classHash: classHash('DEMO'),
  agent: 14,
  day: 84,
  benchmarks: [
    { id: 'SC.5.L.14.1', attempts: 6, correct: 5, stage: 'rookie' },
    { id: 'SC.5.E.7.1', attempts: 3, correct: 1, stage: 'unseen' },
    { id: 'SC.5.N.2.1', attempts: 40, correct: 31, stage: 'ace' },
  ],
  recent: [
    { itemId: 'L14-01', correct: true },
    { itemId: 'E71-03', correct: false },
    { itemId: 'N21-02', correct: true },
  ],
})

describe('report code', () => {
  it('round trips every field', () => {
    const code = encodeReport(sample())
    const res = decodeReport(code)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.report).toEqual({ version: 1, ...sample() })
  })

  it('is grouped in fours with dashes and uses Crockford characters only', () => {
    const code = encodeReport(sample())
    expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4})*(-[0-9A-HJKMNP-TV-Z]{1,4})?$/)
  })

  it('stays short for a typical agent and bounded for a full one', () => {
    expect(encodeReport(sample()).replace(/-/g, '').length).toBeLessThan(60)
    const full = {
      ...sample(),
      benchmarks: CATALOG_BENCHMARKS.map((b) => ({ id: b.id, attempts: 9, correct: 4, stage: 'expert' as const })),
      recent: Array.from({ length: 25 }, (_, i) => ({ itemId: CATALOG_ITEMS[i].id, correct: i % 2 === 0 })),
    }
    const code = encodeReport(full)
    expect(code.replace(/-/g, '').length).toBeLessThan(110)
    const res = decodeReport(code)
    expect(res.ok && res.report.recent.length).toBe(20)
  })

  it('keeps only the 20 most recent results', () => {
    const recent = Array.from({ length: 30 }, (_, i) => ({ itemId: CATALOG_ITEMS[i].id, correct: true }))
    const res = decodeReport(encodeReport({ ...sample(), recent }))
    expect(res.ok && res.report.recent.map((r) => r.itemId)).toEqual(recent.slice(10).map((r) => r.itemId))
  })

  it('caps attempts at 63 and keeps the ratio', () => {
    const res = decodeReport(encodeReport({ ...sample(), benchmarks: [{ id: 'SC.5.L.14.1', attempts: 200, correct: 100, stage: 'ace' }] }))
    expect(res.ok && res.report.benchmarks[0]).toMatchObject({ attempts: 63, correct: 32 })
  })

  it('accepts lowercase, spaces and look-alike letters', () => {
    const code = encodeReport(sample())
    expect(decodeReport(code.toLowerCase().replace(/-/g, ' ')).ok).toBe(true)
    // O reads as 0 and I or L as 1 under Crockford rules.
    const swapped = code.replace(/0/g, 'o').replace(/1/g, 'l')
    expect(decodeReport(swapped).ok).toBe(true)
  })

  it('rejects a bad checksum with a clear message', () => {
    const code = encodeReport(sample())
    const chars = code.replace(/-/g, '')
    const bad = groupCode(chars.slice(0, -1) + (chars.endsWith('0') ? '1' : '0'))
    const res = decodeReport(bad)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/checksum/i)
  })

  it('catches every single character typo and every neighbour swap', () => {
    const chars = encodeReport(sample()).replace(/-/g, '')
    const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
    for (let i = 0; i < chars.length; i++) {
      for (const a of alphabet) {
        if (a === chars[i]) continue
        const res = decodeReport(chars.slice(0, i) + a + chars.slice(i + 1))
        // O/I/L alias only matters for the characters 0 and 1, which are never typed as a changed char here.
        expect(res.ok, `typo at ${i} to ${a}`).toBe(false)
      }
      if (i + 1 < chars.length && chars[i] !== chars[i + 1]) {
        const swapped = chars.slice(0, i) + chars[i + 1] + chars[i] + chars.slice(i + 2)
        expect(decodeReport(swapped).ok, `swap at ${i}`).toBe(false)
      }
    }
  })

  it('names the bad character, a short code, and an empty paste', () => {
    const code = encodeReport(sample())
    const u = decodeReport('U' + code.slice(1))
    expect(!u.ok && u.error).toMatch(/"U"/)
    const short = decodeReport(code.slice(0, 9))
    expect(!short.ok && short.error).toMatch(/too short/i)
    const none = decodeReport('   ')
    expect(!none.ok && none.error).toMatch(/paste/i)
  })

  it('rejects a code from another version', () => {
    const res = decodeReport(encodeReport({ ...sample(), version: 2 }))
    expect(!res.ok && res.error).toMatch(/version 2/)
  })

  it('maps days from 2026-08-01', () => {
    expect(dayNumber('2026-08-01')).toBe(0)
    expect(dayNumber('2026-10-24')).toBe(84)
    expect(dayToISO(84)).toBe('2026-10-24')
    expect(dayNumber('2020-01-01')).toBe(0)
  })

  it('class hash ignores case and punctuation', () => {
    expect(classHash('demo')).toBe(classHash('DEMO'))
    expect(classHash('DE-MO')).toBe(classHash('DEMO'))
    expect(classHash('A')).not.toBe(classHash('B'))
  })

  it('finds codes inside CSV and prose and dedupes them', () => {
    const a = encodeReport(sample())
    const b = encodeReport({ ...sample(), agent: 3 })
    const text = `Student,Submission\n"Agent A",${a}\nmy code is ${b}.\nthis-is-not-a-code and well-known-thing\n${a}\n`
    expect(extractCodes(text)).toEqual([a, b])
  })

  it('decodeAll keeps the newest code per agent and lists rejects', () => {
    const old = encodeReport({ ...sample(), day: 80 })
    const fresh = encodeReport({ ...sample(), day: 84 })
    const other = encodeReport({ ...sample(), agent: 5 })
    const typo = fresh.slice(0, 5) + (fresh[5] === 'A' ? 'B' : 'A') + fresh.slice(6)
    const out = decodeAll([old, fresh, other, typo].join('\n'))
    expect(out.reports.map((r) => [r.agent, r.day]).sort((a, b) => a[0] - b[0])).toEqual([[5, 84], [14, 84]])
    expect(out.rejected.length).toBe(1)
  })
})
