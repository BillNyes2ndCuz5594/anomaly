import { describe, expect, it } from 'vitest'
import raw from '../../content/packs/02-2.json'
import other from '../../content/packs/04-1.json'
import type { Item } from '../../content/schema'
import { buildQuickPool } from './quickPool'

const items = raw.items as Item[]
const pick = (count = items.length, seed = 'rush') =>
  buildQuickPool([...items, ...other.items as Item[]], { caseId: raw.case.id, count, seed })

describe('BEDROCK quick pool', () => {
  it('has at least 15 eligible real Unit 4 items, all from case 02-2', () => {
    expect(raw.case.id).toBe('02-2')
    const pool = pick()
    expect(pool.length).toBeGreaterThanOrEqual(15)
    expect(pool).toHaveLength(36)
    expect(new Set(pool.map((i) => i.id)).size).toBe(pool.length)
    for (const item of pool) {
      expect(items).toContain(item)
      expect(raw.case.benchmarks).toContain(item.benchmark)
      expect(item.options).toHaveLength(4)
    }
  })
  it('is deterministic, varies by seed, preserves inputs and has stable prefixes', () => {
    const before = JSON.stringify(items)
    expect(pick()).toEqual(pick())
    expect(pick(36, 'other')).not.toEqual(pick())
    expect(pick(5)).toEqual(pick().slice(0, 5))
    expect(JSON.stringify(items)).toBe(before)
  })
  it('exhausts each bank before repeats, even with duplicate input IDs', () => {
    const pool = buildQuickPool([...items, ...items], { caseId: '02-2', count: 80, seed: 17 })
    expect(pool).toHaveLength(80)
    for (const start of [0, 36]) expect(new Set(pool.slice(start, start + 36).map((i) => i.id)).size).toBe(36)
    for (let i = 1; i < pool.length; i++) expect(pool[i].id).not.toBe(pool[i - 1].id)
  })
  it('handles unknown, empty and invalid requests', () => {
    expect(buildQuickPool(items, { caseId: 'missing', count: 5, seed: 1 })).toEqual([])
    expect(buildQuickPool([], { caseId: '02-2', count: 5, seed: 1 })).toEqual([])
    for (const count of [0, -1, 1.5, Infinity]) expect(pick(count)).toEqual([])
  })
})
