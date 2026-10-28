import { describe, expect, it } from 'vitest'
import { decodeAll } from '../lib/reportCode'
import {
  agentPct,
  analyze,
  categoryOf,
  contrast,
  LEVELS,
  masteryLevel,
  RETEACH_BELOW,
  scaleColor,
  sortAgents,
  sortBenchmarks,
  summarize,
  toCsv,
  toGradebook,
} from './analysis'
import { makeSampleCodes, SAMPLE_COUNT } from './sample'

describe('teacher analysis', () => {
  const codes = makeSampleCodes()
  const batch = decodeAll(codes.join('\n'))
  const a = analyze(batch.reports)

  it('sample class is 24 valid, distinct agents', () => {
    expect(codes).toHaveLength(SAMPLE_COUNT)
    expect(batch.rejected).toEqual([])
    expect(new Set(batch.reports.map((r) => r.agent)).size).toBe(24)
  })

  it('sample data is varied and deterministic', () => {
    expect(makeSampleCodes()).toEqual(codes)
    const pcts = [...a.byBenchmark.values()].map((v) => v.pct ?? 0)
    expect(Math.max(...pcts) - Math.min(...pcts)).toBeGreaterThan(12)
    expect(a.weakest).toHaveLength(5)
    expect(a.weakest.map((w) => w.pct)).toEqual([...a.weakest.map((w) => w.pct)].sort((x, y) => x - y))
    expect(a.missed.length).toBeGreaterThan(0)
    expect(a.missed[0].stem.length).toBeGreaterThan(10)
  })

  it('maps benchmarks to the four reporting categories', () => {
    expect(categoryOf('SC.5.N.1.1')).toBe('Nature of Science')
    expect(categoryOf('SC.5.E.7.1')).toBe('Earth and Space')
    expect(categoryOf('SC.5.P.8.1')).toBe('Physical')
    expect(categoryOf('SC.5.L.14.1')).toBe('Life')
    expect(a.categories.map((c) => c.name)).toEqual(['Nature of Science', 'Earth and Space', 'Physical', 'Life'])
    expect(a.categories.find((c) => c.name === 'Physical')?.pct).toBeNull()
    expect(a.categories.find((c) => c.name === 'Life')?.pct).not.toBeNull()
  })

  it('color scale runs dark to light and picks readable text', () => {
    expect(scaleColor(0).fg).toBe('#ffffff')
    expect(scaleColor(100).fg).toBe('#02050a')
    expect(scaleColor(0).bg).not.toBe(scaleColor(100).bg)
  })

  it('csv has a header and one row per agent and benchmark with data', () => {
    const lines = toCsv(a).trim().split('\n')
    const cells = a.agents.reduce((n, c) => n + c.cells.size, 0)
    expect(lines).toHaveLength(cells + 1)
    expect(lines[0]).toContain('benchmark')
  })

  it('handles an empty class', () => {
    const e = analyze([])
    expect(e.agents).toEqual([])
    expect(e.weakest).toEqual([])
    expect(toCsv(e).trim().split('\n')).toHaveLength(1)
  })

  it('mastery levels cover 0 to 100, mark each level, and meet AA contrast', () => {
    expect(masteryLevel(0).key).toBe('reteach')
    expect(masteryLevel(59).key).toBe('reteach')
    expect(masteryLevel(60).key).toBe('developing')
    expect(masteryLevel(79).key).toBe('developing')
    expect(masteryLevel(80).key).toBe('secure')
    expect(masteryLevel(100).key).toBe('secure')
    expect(new Set(LEVELS.map((l) => l.glyph)).size).toBe(LEVELS.length)
    for (const l of LEVELS) expect(contrast(l.bg, l.fg)).toBeGreaterThanOrEqual(4.5)
  })

  it('summary counts students, average, and benchmarks needing reteach', () => {
    const s = summarize(a)
    expect(s.students).toBe(24)
    expect(s.average).toBeGreaterThan(0)
    expect(s.reteach.length).toBeGreaterThan(0)
    for (const id of s.reteach) expect(a.byBenchmark.get(id)!.pct!).toBeLessThan(RETEACH_BELOW)
    const pcts = s.reteach.map((id) => a.byBenchmark.get(id)!.pct!)
    expect(pcts).toEqual([...pcts].sort((x, y) => x - y))
    const e = summarize(analyze([]))
    expect(e).toEqual({ students: 0, average: null, reteach: [] })
  })

  it('sorts benchmarks and agents without mutating the analysis', () => {
    const before = a.benchmarks.map((b) => b.id)
    const low = sortBenchmarks(a, 'low').map((b) => a.byBenchmark.get(b.id)!.pct!)
    const high = sortBenchmarks(a, 'high').map((b) => a.byBenchmark.get(b.id)!.pct!)
    expect(low).toEqual([...low].sort((x, y) => x - y))
    expect(high).toEqual([...low].reverse())
    expect(sortBenchmarks(a, 'catalog')).toBe(a.benchmarks)
    expect(a.benchmarks.map((b) => b.id)).toEqual(before)
    const ag = sortAgents(a, 'low').map((c) => agentPct(c) ?? 101)
    expect(ag).toEqual([...ag].sort((x, y) => x - y))
    expect(sortAgents(a, 'agent')).toBe(a.agents)
    expect(sortAgents(a, 'high')).toHaveLength(24)
  })

  it('gradebook export has one row per agent plus header and class row, in the given order', () => {
    const tsv = toGradebook(a, '\t')
    const lines = tsv.trim().split('\n')
    expect(lines).toHaveLength(24 + 2)
    expect(lines[0].split('\t').slice(0, 2)).toEqual(['Agent', 'Average'])
    expect(lines[0].split('\t')).toHaveLength(2 + a.benchmarks.length)
    expect(lines[1].split('\t')).toHaveLength(2 + a.benchmarks.length)
    expect(lines.at(-1)!.startsWith('Class\t')).toBe(true)
    const order = sortBenchmarks(a, 'low')
    expect(toGradebook(a, ',', order).split('\n')[0].split(',').slice(2)).toEqual(order.map((b) => b.id))
    expect(toGradebook(a, ',').split('\n')[0]).toContain('SC.5.')
    expect(toGradebook(analyze([]), '\t').trim().split('\n')).toHaveLength(2)
  })
})
