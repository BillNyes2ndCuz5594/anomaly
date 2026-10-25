import { describe, expect, it } from 'vitest'
import { decodeAll } from '../lib/reportCode'
import { analyze, categoryOf, scaleColor, toCsv } from './analysis'
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
})
