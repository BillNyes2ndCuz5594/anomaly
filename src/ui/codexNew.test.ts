import { describe, expect, it } from 'vitest'
import { CODEX_SEEN_KEY, diffNew, loadSeen, markAllSeen } from './codexNew'

function mem(raw?: string) {
  const m = new Map<string, string>()
  if (raw !== undefined) m.set(CODEX_SEEN_KEY, raw)
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m }
}

describe('codex NEW diffing', () => {
  it('everything is new when nothing has been seen', () => {
    expect(diffNew(['a', 'b'], new Set())).toEqual(['a', 'b'])
  })

  it('only entries unlocked since the last open are new, in unlock order', () => {
    expect(diffNew(['a', 'b', 'c', 'd'], new Set(['a', 'c']))).toEqual(['b', 'd'])
    expect(diffNew(['a'], new Set(['a', 'z']))).toEqual([])
    expect(diffNew([], new Set(['a']))).toEqual([])
  })

  it('opening and closing marks all as seen, and a later unlock is new again', () => {
    const s = mem()
    const seen = markAllSeen(['a', 'b'], loadSeen(s), s)
    expect(diffNew(['a', 'b'], seen)).toEqual([])
    expect(diffNew(['a', 'b', 'c'], loadSeen(s))).toEqual(['c'])
  })

  it('keeps seen ids that are no longer unlocked, and survives bad storage', () => {
    const s = mem()
    markAllSeen(['a'], new Set(['old']), s)
    expect([...loadSeen(s)].sort()).toEqual(['a', 'old'])
    expect(loadSeen(mem('not json')).size).toBe(0)
    expect(loadSeen(mem('{"a":1}')).size).toBe(0)
    expect([...loadSeen(mem('["a",3,null,"b"]'))]).toEqual(['a', 'b'])
    const broken = { getItem: () => { throw new Error('x') }, setItem: () => { throw new Error('x') } }
    expect(loadSeen(broken).size).toBe(0)
    expect(markAllSeen(['a'], new Set(), broken).has('a')).toBe(true)
  })
})
