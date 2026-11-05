import { describe, expect, it } from 'vitest'
import {
  answerReactor, BEST_SCORE_KEY, getReactorStats, getScoreMultiplier,
  loadBestScore, nextReactor, resolvePulse, saveBestScore,
  startReactor, useShield, validateReactorSession,
} from './reactor'

describe('Reactor Stabilizer rules', () => {
  it('starts at instability 4, streak 0, shields 0, score 0', () => {
    const s = startReactor('seed-alpha')
    expect(s.resources).toEqual({ instability: 4, streak: 0, shields: 0, score: 0 })
    expect(s.phase).toBe('question')
    expect(s.turnToken).toBe(0)
    expect(s.board).toEqual([])
  })

  it('calculates score multipliers and banks shields every 3 consecutive correct', () => {
    expect([0, 1, 2].map(getScoreMultiplier)).toEqual([1, 1, 1])
    expect([3, 4, 5].map(getScoreMultiplier)).toEqual([2, 2, 2])
    expect([6, 7].map(getScoreMultiplier)).toEqual([3, 3])

    let s = startReactor('test')
    s = answerReactor(s, true, 0)
    expect(s.resources).toEqual({ instability: 2, streak: 1, shields: 0, score: 10 })
    s = nextReactor(resolvePulse(s, s.turnToken), s.turnToken + 1)
    s = answerReactor(s, true, s.turnToken)
    expect(s.resources).toEqual({ instability: 1, streak: 2, shields: 0, score: 20 })
    s = nextReactor(resolvePulse(s, s.turnToken), s.turnToken + 1)
    s = answerReactor(s, true, s.turnToken)
    expect(s.resources).toEqual({ instability: 0, streak: 3, shields: 1, score: 40 })

    // resets streak on incorrect and clamps shields at 2
    s = nextReactor(resolvePulse(s, s.turnToken), s.turnToken + 1)
    s = { ...s, resources: { ...s.resources, shields: 2, streak: 2 } }
    expect(answerReactor(s, true, s.turnToken).resources.shields).toBe(2)
    const wrong = answerReactor(s, false, s.turnToken)
    expect(wrong.resources.streak).toBe(0)
    expect(wrong.resources.score).toBe(40)
  })

  it('useShield blocks pulse and resolvePulse increments instability to overload', () => {
    let s = answerReactor(startReactor('test'), false, 0)
    expect(useShield(s, s.turnToken)).toBe(s) // no shields
    s = useShield({ ...s, resources: { ...s.resources, shields: 1 } }, s.turnToken)
    expect(s.phase).toBe('resolved')
    expect(s.resources.shields).toBe(0)
    expect(s.resources.instability).toBe(4)

    const initial = answerReactor(startReactor('test'), false, 0)
    s = resolvePulse(initial, initial.turnToken)
    expect(s.resources.instability).toBe(5)
    const pulse9 = resolvePulse({ ...initial, resources: { ...initial.resources, instability: 9 } }, initial.turnToken)
    expect(pulse9.resources.instability).toBe(10)
    const overloaded = nextReactor(pulse9, pulse9.turnToken)
    expect(overloaded.phase).toBe('done')
    expect(getReactorStats(overloaded).overload).toBe(true)
  })

  it('guards stale tokens and handles 10-turn completion', () => {
    const s = startReactor('test')
    expect(answerReactor(s, true, 42)).toBe(s)
    expect(useShield(s, 0)).toBe(s)
    let cur = s
    for (let q = 0; q < 10; q++) {
      cur = answerReactor(cur, true, cur.turnToken)
      const p = resolvePulse(cur, cur.turnToken)
      cur = nextReactor(p, p.turnToken)
    }
    expect(cur.phase).toBe('done')
    expect(getReactorStats(cur)).toEqual({ questionsAnswered: 10, accuracy: 100, score: 230, overload: false })
  })

  it('manages best score persistence safely in storage', () => {
    const mem = new Map<string, string>()
    const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) }
    expect(loadBestScore(storage)).toBe(0)
    expect(saveBestScore(storage, 150)).toBe(150)
    expect(saveBestScore(storage, 100)).toBe(150)
    const throwing = { getItem: () => { throw new Error('err') }, setItem: () => { throw new Error('err') } }
    expect(loadBestScore(throwing)).toBe(0)
    expect(saveBestScore(throwing, 300)).toBe(300)
    expect(BEST_SCORE_KEY).toBe('anomaly:reactor:best:v1')
  })

  it('validates sessions and safely rejects corrupted data', () => {
    const s = startReactor('save-test'), answered = answerReactor(s, true, 0)
    expect(validateReactorSession(s)).not.toBeNull()
    expect(validateReactorSession(answered)).not.toBeNull()
    for (const bad of [
      null, { ...s, mode: 'unknown' },
      { ...s, phase: 'question', feedback: { itemId: 'E6.1-01', correct: true } },
      { ...s, phase: 'action', feedback: null },
      { ...s, resources: { ...s.resources, shields: 5 } },
      { ...s, resources: { ...s.resources, instability: 15 } },
      { ...s, correctAnswers: 5, questionsAnswered: 4 },
      { ...s, questionsAnswered: undefined },
      { ...s, board: [{ lane: 0 }] },
      { ...s, questionIndex: 10, questionsAnswered: 10, phase: 'question', feedback: null },
      { ...s, questionIndex: -1 },
    ]) {
      expect(validateReactorSession(bad)).toBeNull()
    }
  })

  it('calculates accuracy as 0 when no questions have been answered', () => {
    const s = startReactor('stats-test')
    const stats = getReactorStats(s)
    expect(stats.accuracy).toBe(0)
    expect(stats.questionsAnswered).toBe(0)
    expect(stats.score).toBe(0)
    expect(stats.overload).toBe(false)
  })
})
