import { describe, expect, it, vi } from 'vitest'
import type { MasteryStage } from './mastery'

function fakeStorage() {
  const data = new Map<string, string>()
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  }
}

const many = (n: number, stage: MasteryStage) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`b${i}`, stage]))

describe('rank by fraction of known benchmarks', () => {
  it('matches the old point ranks for four or fewer known benchmarks', async () => {
    vi.stubGlobal('localStorage', fakeStorage())
    const { rankFor } = await import('./store')
    expect(rankFor({ a: 'rookie', b: 'rookie' })).toBe('Cadet')
    expect(rankFor({ a: 'field-ready', b: 'rookie' })).toBe('Field Agent')
    expect(rankFor({ a: 'ace', b: 'ace', c: 'ace' })).toBe('Commander')
    expect(rankFor({ a: 'ace' })).toBe('Field Agent')
  })

  it('never changes when cases add unseen benchmarks', async () => {
    vi.stubGlobal('localStorage', fakeStorage())
    const { rankFor } = await import('./store')
    const agent = { a: 'expert', b: 'ace', c: 'field-ready' } as Record<string, MasteryStage>
    const before = rankFor(agent)
    expect(rankFor({ ...agent, ...many(60, 'unseen') })).toBe(before)
  })

  it('depends on the fraction, not the count, once an agent knows many benchmarks', async () => {
    vi.stubGlobal('localStorage', fakeStorage())
    const { rankFor } = await import('./store')
    // 20 benchmarks at Rookie are 20 points: the old rule said Commander, a quarter of full mastery is Field Agent.
    expect(rankFor(many(20, 'rookie'))).toBe('Field Agent')
    expect(rankFor(many(20, 'field-ready'))).toBe('Specialist')
    expect(rankFor(many(20, 'ace'))).toBe('Commander')
    expect(rankFor(many(40, 'expert'))).toBe('Commander')
  })
})
