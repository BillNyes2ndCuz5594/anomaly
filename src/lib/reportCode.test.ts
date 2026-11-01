import { describe, expect, it } from 'vitest'
import { CATALOG_BENCHMARKS, CATALOG_ITEMS } from './catalog.generated'
import { classHash, dayNumber, dayToISO, decodeAll, decodeReport, encodeReport, extractCodes, groupCode, MAX_BENCHMARKS, REPORT_VERSION, type ReportData } from './reportCode'

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
    // S6: codes are version 2 now (wider benchmark and item indexes); version 1 round trips below.
    expect(res.report).toEqual({ version: REPORT_VERSION, ...sample() })
    expect(REPORT_VERSION).toBe(2)
  })

  it('still writes and reads version 1 when asked', () => {
    const res = decodeReport(encodeReport({ ...sample(), version: 1 }))
    expect(res.ok && res.report).toEqual({ version: 1, ...sample() })
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
    // Version 2 caps a code at 31 benchmarks (22 bits each) and 20 results (10 bits each) over a 43-bit header:
    // 930 bits, 186 characters, plus the 2 checksum characters. A code never grows past that.
    expect(code.replace(/-/g, '').length).toBeLessThanOrEqual(188)
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
    // Version 2 is real since S6, so the unknown version here is 3 (and 0).
    const res = decodeReport(encodeReport({ ...sample(), version: 3 }))
    expect(!res.ok && res.error).toMatch(/version 3/)
    const zero = decodeReport(encodeReport({ ...sample(), version: 0 }))
    expect(!zero.ok && zero.error).toMatch(/version 0/)
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

// Codes written before S6 (version 1) and fixed version 2 codes. These strings must keep decoding forever.
const V1 = {
  demo: '2J1P-6GAG-C062-JB1G-83T3-Y1G2-H1SH-5',
  full: '2SAS-KGF1-G010-0110-910R-90RG-6RGA-4GA6-2G63-HH3J-0X21-4GS4-M9GM-B50B-62SM-3WG2-4996-50NJ-RBHH-68T3-EE1T-7MZ4-0GT4-CX',
  empty: '37E5-0000-004D',
}
const V2 = {
  demo: '4J1P-6GAG-C031-92RC-20F8-FR60-2483-J33',
  full: '4SAS-KGF1-G00G-0088-2843-141H-0DGG-A4G5-3181-GWC8-E83M-4291-H4M9-GA5J-G2SG-PD07-R808-G989-GA0A-RB0B-GC8C-GD0D-RE0E-GF8F-GG0G-RH03-Y',
  empty: '57E5-0000-004F',
  big: '5RES-30S0-BQ4J-3G08-28QS-T007-P',
}
/** The first three codes of the Teacher HQ sample class as it was made before S6 (version 1). */
const V1_SAMPLE = ['3VK7-00AH-G061-M13H-C118-D0RC-28GC-38A2-0J61-003G-G4J0-C4H4-C6GM-214B-1G9C-247G-C2J5-2CE0-A0SE-4CPG-2D', '3VK7-0GAD-8094-M13H-A12G-H0RG-4GM4-28E4-1481-GJ4H-002G-M6HC-801M-C3YH-8B84-T3R3-S92G-D16A-GZN', '3VK7-10A5-8040-J140-J12R-N0R8-00GC-48C3-0J71-G941-84JG-M4HC-415W-G046-GX1R-F0ME-H38G-A2E6-1P28-6D']

const STAGES = ['unseen', 'rookie', 'field-ready', 'expert', 'ace'] as const
const fullData = () => ({
  classHash: classHash('ROOM12'),
  agent: 40,
  day: 120,
  benchmarks: CATALOG_BENCHMARKS.slice(0, 12).map((x, i) => ({ id: x.id, attempts: i + 1, correct: i, stage: STAGES[i % 5] })),
  recent: CATALOG_ITEMS.slice(0, 35)
    .slice(-20)
    .map((x, i) => ({ itemId: x.id, correct: i % 3 === 0 })),
})

describe('report code versions (S6)', () => {
  it('decodes the version 1 vectors', () => {
    const demo = decodeReport(V1.demo)
    expect(demo.ok && demo.report).toEqual({ version: 1, ...sample() })
    const full = decodeReport(V1.full)
    expect(full.ok && full.report).toEqual({ version: 1, ...fullData() })
    const empty = decodeReport(V1.empty)
    expect(empty.ok && empty.report).toEqual({ version: 1, classHash: classHash(''), agent: 1, day: 0, benchmarks: [], recent: [] })
  })

  it('writes the version 1 vectors exactly when asked for version 1', () => {
    expect(encodeReport({ ...sample(), version: 1 })).toBe(V1.demo)
    expect(encodeReport({ ...fullData(), version: 1 })).toBe(V1.full)
  })

  it('writes and decodes the version 2 vectors', () => {
    expect(encodeReport(sample())).toBe(V2.demo)
    expect(encodeReport(fullData())).toBe(V2.full)
    expect(encodeReport({ classHash: classHash(''), agent: 1, day: 0, benchmarks: [], recent: [] })).toBe(V2.empty)
    const demo = decodeReport(V2.demo)
    expect(demo.ok && demo.report).toEqual({ version: 2, ...sample() })
    const full = decodeReport(V2.full)
    expect(full.ok && full.report).toEqual({ version: 2, ...fullData() })
    // Version 2 is a few characters longer than version 1.
    const len = (c: string) => c.replace(/-/g, '').length
    expect(len(V2.full) - len(V1.full)).toBeGreaterThan(0)
    expect(len(V2.full) - len(V1.full)).toBeLessThan(16)
  })

  it('round trips 120 benchmarks and 500 items in version 2', () => {
    const big = {
      benchmarks: Array.from({ length: 120 }, (_, i) => ({ id: `B${i}` })),
      items: Array.from({ length: 500 }, (_, i) => ({ id: `I${i}` })),
    }
    const fixed = decodeReport(V2.big, big)
    expect(fixed.ok && fixed.report).toEqual({
      version: 2,
      classHash: classHash('BIG'),
      agent: 7,
      day: 200,
      benchmarks: [
        { id: 'B119', attempts: 9, correct: 8, stage: 'expert' },
        { id: 'B64', attempts: 2, correct: 1, stage: 'rookie' },
      ],
      recent: [
        { itemId: 'I499', correct: true },
        { itemId: 'I128', correct: false },
      ],
    })
    // Every benchmark index and every item index, in codes of up to 31 benchmarks and 20 results.
    for (let start = 0; start < 120; start += MAX_BENCHMARKS) {
      for (let item0 = 0; item0 < 500; item0 += 20) {
        const data = {
          classHash: classHash(`C${start}`),
          agent: 1 + ((start + item0) % 40),
          day: (item0 * 7) % 4096,
          benchmarks: big.benchmarks.slice(start, start + MAX_BENCHMARKS).map((b, i) => ({ id: b.id, attempts: (i * 5) % 64, correct: Math.min((i * 5) % 64, i), stage: STAGES[i % 5] })),
          recent: big.items.slice(item0, item0 + 20).map((it, i) => ({ itemId: it.id, correct: (i + item0) % 2 === 0 })),
        }
        const res = decodeReport(encodeReport(data, big), big)
        expect(res.ok && res.report, `${start} ${item0}`).toEqual({ version: 2, ...data })
      }
    }
  })

  it('keeps at most 31 benchmarks in one code', () => {
    const big = { benchmarks: Array.from({ length: 40 }, (_, i) => ({ id: `B${i}` })), items: [] }
    const data = { ...sample(), recent: [], benchmarks: big.benchmarks.map((b) => ({ id: b.id, attempts: 1, correct: 1, stage: 'rookie' as const })) }
    const res = decodeReport(encodeReport(data, big), big)
    expect(res.ok && res.report.benchmarks.length).toBe(MAX_BENCHMARKS)
  })

  it('version 1 leaves out indexes that do not fit its widths', () => {
    const big = { benchmarks: Array.from({ length: 70 }, (_, i) => ({ id: `B${i}` })), items: Array.from({ length: 200 }, (_, i) => ({ id: `I${i}` })) }
    const data = { ...sample(), benchmarks: [{ id: 'B69', attempts: 1, correct: 1, stage: 'rookie' as const }, { id: 'B3', attempts: 1, correct: 0, stage: 'unseen' as const }], recent: [{ itemId: 'I150', correct: true }, { itemId: 'I5', correct: true }] }
    const res = decodeReport(encodeReport({ ...data, version: 1 }, big), big)
    expect(res.ok && res.report.benchmarks.map((b) => b.id)).toEqual(['B3'])
    expect(res.ok && res.report.recent.map((r) => r.itemId)).toEqual(['I5'])
  })

  it('Teacher HQ still decodes a class of version 1 codes, mixed with version 2', () => {
    const out = decodeAll([...V1_SAMPLE, V2.demo].join('\n'))
    expect(out.rejected).toEqual([])
    expect(out.reports.length).toBe(V1_SAMPLE.length + 1)
    expect(out.reports.filter((r) => r.version === 1).length).toBe(V1_SAMPLE.length)
    for (const r of out.reports) expect(r.benchmarks.length).toBeGreaterThan(0)
  })
})
