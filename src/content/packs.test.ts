import { existsSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { baseContent, caseById, content, mergeContent, PACK_ORDER, vitalsCase } from '.'
import { packs } from './sync.test-helper'
import manifest from './manifest.json'
import fixture from './__fixtures__/pack-test.json'
import labsFixture from './__fixtures__/labs-test.json'
import { validateContent, validatePack, type CasePack, type LabDef } from './schema'

const pack = (): CasePack => JSON.parse(JSON.stringify(fixture)) as CasePack
const withLab = (lab: unknown): CasePack => {
  const p = pack()
  p.case.lab = lab as LabDef
  return p
}

describe('case packs on disk', () => {
  it('lists every pack file in PACK_ORDER, and every listed pack has a file', () => {
    const dir = new URL('./packs/', import.meta.url)
    const onDisk = existsSync(dir)
      ? readdirSync(dir)
          .filter((f) => f.endsWith('.json'))
          .map((f) => f.slice(0, -5))
      : []
    for (const id of onDisk) expect(PACK_ORDER, `src/content/packs/${id}.json is not listed in PACK_ORDER`).toContain(id)
    for (const id of PACK_ORDER) expect(onDisk, `PACK_ORDER lists ${id} but there is no file`).toContain(id)
    expect(new Set(PACK_ORDER).size).toBe(PACK_ORDER.length)
  })

  it('keeps navigation metadata and counts in sync with the packs', () => {
    expect(manifest, 'Manifest is stale: run npm run manifest').toEqual(packs.map((p) => ({ case: p.case, codex: p.codex ?? [], itemCount: p.items.length, reviewBenchmarks: [...new Set(p.items.filter((i) => i.pool === 'cold').map((i) => i.benchmark))].sort() })))
  })

  it('never lists the test fixture', () => {
    expect(PACK_ORDER).not.toContain(fixture.case.id)
  })

  it('merges VITALS first, then the packs in PACK_ORDER', () => {
    expect(content.cases[0].id).toBe('03-1')
    expect(content.cases.map((c) => c.id)).toEqual(['03-1', ...PACK_ORDER])
    expect(packs.length).toBe(PACK_ORDER.length)
    for (const p of packs) expect(validatePack(p), p.case.id).toEqual([])
    expect(validateContent(content, packs)).toEqual([])
  })

  it('finds cases by id', () => {
    expect(caseById('03-1')).toBe(vitalsCase)
    expect(caseById('nope')).toBeUndefined()
    expect(caseById(null)).toBeUndefined()
    expect(vitalsCase.lab.kind).toBe('vitals')
    expect(vitalsCase.evidencePlan.reduce((n, p) => n + p.count, 0)).toBe(5)
  })
})

describe('the fixture pack', () => {
  it('is a valid pack on its own', () => {
    expect(validatePack(pack())).toEqual([])
  })

  it('merges onto the base content without problems', () => {
    const p = pack()
    const merged = mergeContent(baseContent, [p])
    expect(merged.cases.map((c) => c.id)).toEqual(['03-1', '90-1'])
    expect(merged.items.length).toBe(baseContent.items.length + p.items.length)
    expect(merged.codex.length).toBe(baseContent.codex.length + (p.codex?.length ?? 0))
    expect(validateContent(merged, [p])).toEqual([])
  })

  it('accepts the match and order fixture labs', () => {
    expect(validatePack(withLab(labsFixture.match))).toEqual([])
    expect(validatePack(withLab(labsFixture.order))).toEqual([])
  })
})

describe('validateContent and validatePack catch pack problems', () => {
  const has = (problems: string[], text: string) => problems.some((x) => x.includes(text))

  it('names an id clash between two packs', () => {
    const a = pack()
    const b = pack()
    b.case.id = '90-2'
    b.items = b.items.map((it, i) => (i === 0 ? it : { ...it, id: `${it.id}-B` }))
    b.codex = []
    const p = validateContent(mergeContent(baseContent, [a, b]), [a, b])
    expect(has(p, 'item TEST-P8.1-01: id clash between pack 90-1 and pack 90-2')).toBe(true)
  })

  it('names a clash with the base content and a duplicate case id', () => {
    const a = pack()
    a.items[0].id = baseContent.items[0].id
    a.case.id = '03-1'
    const p = validateContent(mergeContent(baseContent, [a]), [a])
    expect(has(p, `item ${baseContent.items[0].id}: id clash between pack 03-1 and the base content`)).toBe(true)
    expect(has(p, 'case 03-1: duplicate case id')).toBe(true)
  })

  it('checks the sort lab shape', () => {
    const p = pack()
    if (p.case.lab.kind !== 'sort') throw new Error('fixture is a sort lab')
    p.case.lab.cards[0].bin = 'plasma'
    p.case.lab.cards[1].card = []
    p.case.lab.bins = [p.case.lab.bins[0]]
    const out = validatePack(p)
    expect(has(out, 'names a bin that does not exist (plasma)')).toBe(true)
    expect(has(out, 'needs 1 to 3 lines')).toBe(true)
    expect(has(out, 'sort needs 2 to 4 bins')).toBe(true)
  })

  it('checks the match lab shape', () => {
    const lab = JSON.parse(JSON.stringify(labsFixture.match))
    lab.right.pop()
    lab.pairs[0].right = 'to-nowhere'
    const out = validatePack(withLab(lab))
    expect(has(out, 'same count left and right')).toBe(true)
    expect(has(out, 'right id that does not exist (to-nowhere)')).toBe(true)
    const lab2 = JSON.parse(JSON.stringify(labsFixture.match))
    lab2.pairs.pop()
    expect(has(validatePack(withLab(lab2)), 'left evaporation needs exactly one pair')).toBe(true)
  })

  it('checks the order lab shape', () => {
    const lab = JSON.parse(JSON.stringify(labsFixture.order))
    lab.steps = lab.steps.slice(0, 2)
    expect(has(validatePack(withLab(lab)), 'order needs 3 to 6 steps')).toBe(true)
    expect(has(validatePack(withLab({ kind: 'spin', intro: 'x' })), 'unknown kind spin')).toBe(true)
  })

  it('checks the evidence plan, marker, category and id', () => {
    const p = pack()
    p.case.evidencePlan = [{ benchmark: 'SC.5.P.8.1', count: 3 }, { benchmark: 'SC.5.E.7.1', count: 1 }]
    p.case.marker = { lon: -70, lat: 40 }
    ;(p.case as { category: string }).category = 'chemistry'
    p.case.id = '901'
    const out = validatePack(p)
    expect(has(out, 'evidencePlan counts must sum to 5 (got 4)')).toBe(true)
    expect(has(out, 'evidencePlan names SC.5.E.7.1')).toBe(true)
    expect(has(out, 'marker is outside Florida and the Cape')).toBe(true)
    expect(has(out, 'category must be nature, earth, physical or life')).toBe(true)
    expect(has(out, 'id must look like NN-N')).toBe(true)
  })

  it('wants enough case pool items for the plan', () => {
    const p = pack()
    p.items = p.items.filter((it) => it.id !== 'TEST-P9.1-02')
    expect(has(validatePack(p), 'evidencePlan wants 2 items for SC.5.P.9.1 but the case pool has 1')).toBe(true)
  })

  it('holds new items to the strict rules (VITALS and cold items are exempt)', () => {
    const p = pack()
    delete p.items[0].tisCheck
    p.items[1].misconceptions = ' '
    p.items[2].keyWords = ['WOODEN BLOCK', 'stays the same']
    p.items[3].category = 'Physical Science'
    p.items[4].benchmark = 'SC.5.L.14.1'
    const out = validatePack(p)
    expect(has(out, 'item TEST-P8.1-01: missing tisCheck')).toBe(true)
    expect(has(out, 'item TEST-P8.1-02: missing misconceptions')).toBe(true)
    expect(has(out, 'key word "WOODEN BLOCK" is not copied verbatim')).toBe(true)
    expect(has(out, 'item TEST-P9.1-01: category must be')).toBe(true)
    expect(has(out, 'item TEST-P9.1-02: benchmark SC.5.L.14.1 is not one of the case benchmarks')).toBe(true)
    // The base file keeps its long category names and passes.
    expect(validateContent(content)).toEqual([])
  })

  it('finds a dash anywhere in a pack', () => {
    const p = pack()
    p.case.briefing[0] = 'A dash \u2013 here.'
    expect(has(validatePack(p), 'em or en dash')).toBe(true)
  })
})
