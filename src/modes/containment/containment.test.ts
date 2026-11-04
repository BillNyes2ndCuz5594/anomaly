import { describe, expect, it } from 'vitest'
import {
  answerContainment, DEFENSE_COSTS, deployDefense, getContainmentStats,
  getSpawnsForWave, nextContainment, resolveWave, SPAWN_SCHEDULE,
  startContainment, validateContainmentSession,
} from './containment'

describe('Containment Rush rules', () => {
  it('starts with 3 integrity, 1 charge, and deterministic wave 0 spawn', () => {
    const s1 = startContainment('seed-alpha'), s2 = startContainment('seed-alpha')
    expect(s1.resources).toEqual({ charge: 1, integrity: 3 })
    expect(s1.phase).toBe('question')
    expect(s1.turnToken).toBe(0)
    expect(s1.board).toEqual(s2.board)
    expect(s1.board.length).toBeGreaterThan(0)
    expect(SPAWN_SCHEDULE).toHaveLength(10)
  })

  it('awards 2 charge on correct answers and 0 on incorrect answers', () => {
    const s = startContainment('test')
    const correct = answerContainment(s, true, 0)
    expect(correct.phase).toBe('action')
    expect(correct.resources.charge).toBe(3)
    expect(correct.turnToken).toBe(1)
    expect(correct.correctAnswers).toBe(1)
    expect(correct.questionsAnswered).toBe(1)

    const incorrect = answerContainment(s, false, 0)
    expect(incorrect.resources.charge).toBe(1)
    expect(incorrect.correctAnswers).toBe(0)
    expect(incorrect.questionsAnswered).toBe(1)
  })

  it('rejects stale turn tokens and invalid phases', () => {
    const s = startContainment('test')
    expect(answerContainment(s, true, 99)).toBe(s)
    expect(deployDefense(s, 0, 'magnet', 0)).toBe(s)
    expect(resolveWave(s, 0)).toBe(s)
    expect(nextContainment(s, 0)).toBe(s)

    const answered = answerContainment(s, true, 0)
    expect(answerContainment(answered, true, 1)).toBe(answered)
    expect(nextContainment(answered, 1)).toBe(answered)
  })

  it('enforces defense costs, insufficient charge, and invalid slots', () => {
    let s = answerContainment(startContainment('test'), false, 0) // charge 1
    expect(DEFENSE_COSTS.magnet).toBe(1)
    expect(DEFENSE_COSTS.freeze).toBe(1)
    expect(DEFENSE_COSTS.filter).toBe(2)

    expect(deployDefense(s, 0, 'filter', 1)).toBe(s) // needs 2 charge
    for (const badSlot of [-1, 3, 1.5, Number.NaN]) expect(deployDefense(s, badSlot, 'magnet', 1)).toBe(s)

    s = deployDefense(s, 0, 'magnet', 1)
    expect(s.resources.charge).toBe(0)
    expect(s.turnToken).toBe(2)
    expect(deployDefense(s, 0, 'freeze', 2)).toBe(s) // duplicate action on same slot rejected
  })

  it('applies magnet defense to remove nearest anomaly in targeted lane', () => {
    let s = answerContainment(startContainment('test'), true, 0) // charge 3
    s = { ...s, board: [{ lane: 0, position: 0, type: 'anomaly' }, { lane: 0, position: 1, type: 'anomaly' }] }
    s = deployDefense(s, 0, 'magnet', s.turnToken)
    s = resolveWave(s, s.turnToken)
    expect(s.contained).toBe(1)
    const lane0 = s.board.filter((e) => e.lane === 0 && (!e.type || e.type === 'anomaly'))
    expect(lane0.some((a) => a.position === 1)).toBe(true)
    expect(s.resources.integrity).toBe(3)
  })

  it('applies filter defense to clear entire targeted lane', () => {
    let s = answerContainment(startContainment('test'), true, 0) // charge 3
    s = { ...s, board: [{ lane: 1, position: 0, type: 'anomaly' }, { lane: 1, position: 1, type: 'anomaly' }] }
    s = deployDefense(s, 1, 'filter', s.turnToken)
    s = resolveWave(s, s.turnToken)
    expect(s.contained).toBe(2)
    expect(s.resources.integrity).toBe(3)
  })

  it('freeze holds a lane for one wave without granting permanent immunity', () => {
    let s = answerContainment(startContainment('test'), true, 0)
    s = { ...s, board: [{ lane: 2, position: 1, type: 'anomaly' }] }
    s = deployDefense(s, 2, 'freeze', s.turnToken)
    s = resolveWave(s, s.turnToken) // Wave 1: held, does not breach
    expect(s.resources.integrity).toBe(3)
    expect(s.board.find((e) => e.lane === 2 && e.position === 1)).toBeDefined()

    // Next wave without freeze: held anomaly advances and breaches
    s = nextContainment(s, s.turnToken)
    s = answerContainment(s, true, s.turnToken)
    s = resolveWave(s, s.turnToken)
    expect(s.resources.integrity).toBe(2) // breached!
  })

  it('terminates safely when integrity drops to zero', () => {
    let s = startContainment('zero-integrity')
    s = answerContainment(s, false, s.turnToken)
    s = { ...s, board: [{ lane: 0, position: 1, type: 'anomaly' }, { lane: 1, position: 1, type: 'anomaly' }, { lane: 2, position: 1, type: 'anomaly' }] }
    s = resolveWave(s, s.turnToken)
    expect(s.resources.integrity).toBe(0)
    expect(s.phase).toBe('resolved')
    s = nextContainment(s, s.turnToken)
    expect(s.phase).toBe('done')
  })

  it('completes 10 waves safely on an all-correct run with stats reporting', () => {
    let s = startContainment('perfect-run')
    for (let q = 0; q < 10; q++) {
      s = answerContainment(s, true, s.turnToken)
      for (const lane of [0, 1, 2]) {
        const threatened = s.board.find((e) => e.lane === lane && e.position === 1 && (!e.type || e.type === 'anomaly'))
        if (threatened && s.resources.charge >= 1) s = deployDefense(s, lane, 'magnet', s.turnToken)
      }
      s = resolveWave(s, s.turnToken)
      s = nextContainment(s, s.turnToken)
    }
    expect(s.phase).toBe('done')
    const stats = getContainmentStats(s)
    expect(stats.questionsAnswered).toBe(10)
    expect(stats.accuracy).toBe(100)
    expect(stats.contained).toBeGreaterThan(0)
    expect(s.resources.integrity).toBe(3)
  })

  it('validates sessions and safely rejects corrupted data', () => {
    const s = startContainment('save-test')
    expect(validateContainmentSession(s)).not.toBeNull()
    for (const bad of [null, { ...s, mode: 'unknown' }, { ...s, resources: { charge: -1, integrity: 3 } },
      { ...s, correctAnswers: 5, questionsAnswered: 4 }, { ...s, contained: -2 }]) {
      expect(validateContainmentSession(bad)).toBeNull()
    }
  })

  it('produces deterministic spawns per wave', () => {
    expect(getSpawnsForWave(0, 'seed-1')).toEqual(getSpawnsForWave(0, 'seed-1'))
    expect(getSpawnsForWave(-1)).toEqual([])
    expect(getSpawnsForWave(99)).toEqual([])
  })
})
