import { describe, expect, it } from 'vitest'
import { BANNED_WORDS, content, keyShares, studentStrings, validateContent, type Content } from './schema'

describe('content (SPEC section 11)', () => {
  it('passes validateContent with no problems', () => {
    expect(validateContent(content)).toEqual([])
  })

  it('has four options, a key from 0 to 3, and four why lines on every item', () => {
    for (const it of content.items) {
      expect(it.options, it.id).toHaveLength(4)
      expect(it.key, it.id).toBeGreaterThanOrEqual(0)
      expect(it.key, it.id).toBeLessThanOrEqual(3)
      expect(it.why, it.id).toHaveLength(4)
    }
  })

  it('has every key word inside its stem, case-insensitively', () => {
    for (const it of content.items) {
      expect(it.keyWords.length, it.id).toBeGreaterThan(0)
      for (const k of it.keyWords) expect(it.stem.toLowerCase(), `${it.id}: ${k}`).toContain(k.toLowerCase())
    }
  })

  it('has a visual and alt text on every item', () => {
    for (const it of content.items) {
      expect(it.visual?.kind, it.id).toBeTruthy()
      expect(it.alt.trim().length, it.id).toBeGreaterThan(5)
    }
  })

  it('contains no em or en dashes anywhere in the file', () => {
    expect(JSON.stringify(content)).not.toMatch(/[\u2013\u2014]/)
  })

  it('keeps banned words out of every student facing string', () => {
    const strings = studentStrings(content)
    expect(strings.length).toBeGreaterThan(100)
    for (const s of strings) {
      for (const w of BANNED_WORDS) expect(s.toLowerCase(), s).not.toContain(w)
    }
  })

  it('balances key positions in each pool (no position above 40 percent)', () => {
    for (const pool of ['case', 'cold'] as const) {
      for (const share of keyShares(content.items, pool)) expect(share).toBeLessThanOrEqual(0.4)
    }
  })

  it('has the item mix the case flow needs', () => {
    const count = (b: string) => content.items.filter((i) => i.pool === 'case' && i.benchmark === b).length
    expect(count('SC.5.L.14.1')).toBeGreaterThanOrEqual(2)
    expect(count('SC.5.L.14.2')).toBeGreaterThanOrEqual(2)
    expect(count('SC.3.L.15.1')).toBeGreaterThanOrEqual(1)
  })

  it('has lab organ ids that exist in the codex or model list', () => {
    const codexOrgans = new Set(content.codex.filter((e) => e.id.startsWith('organ:')).map((e) => e.id.slice(6)))
    for (const t of content.case.labs.organOps.tasks) expect(codexOrgans.has(t.organ), t.organ).toBe(true)
  })
})

describe('validateContent catches problems', () => {
  const clone = (): Content => JSON.parse(JSON.stringify(content)) as Content

  it('flags a missing key word, a bad key, and a dash', () => {
    const c = clone()
    c.items[0].keyWords = ['not in the stem at all']
    c.items[1].key = 7
    c.items[2].why[0] = 'A dash \u2014 here'
    const p = validateContent(c)
    expect(p.some((x) => x.includes('not in the stem'))).toBe(true)
    expect(p.some((x) => x.includes('key must be'))).toBe(true)
    expect(p.some((x) => x.includes('dash'))).toBe(true)
  })

  it('flags banned words in student text but not in teacher metadata', () => {
    const c = clone()
    c.items[0].misconceptions = 'mentions body system on purpose'
    expect(validateContent(c)).toEqual([])
    c.items[0].why[1] = 'This is about the net force'
    expect(validateContent(c).some((x) => x.includes('banned'))).toBe(true)
  })

  it('flags lopsided key positions', () => {
    const c = clone()
    for (const it of c.items) if (it.pool === 'case') it.key = 0
    expect(validateContent(c).some((x) => x.includes('key position 1'))).toBe(true)
  })
})
