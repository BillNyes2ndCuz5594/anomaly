import { seeded } from '../../lib/rkea'
import { validateModeSession, type ModeAnswerFeedback, type ModeSession } from '../quick/modeSession'

export type DefenseType = 'magnet' | 'freeze' | 'filter'
export const DEFENSE_COSTS: Readonly<Record<DefenseType, number>> = { magnet: 1, freeze: 1, filter: 2 }
export const DEFENSE_DESCRIPTIONS: Readonly<Record<DefenseType, { name: string; cost: number; description: string }>> = {
  magnet: { name: 'Containment Magnet', cost: 1, description: 'Removes the nearest anomaly in the lane' },
  freeze: { name: 'Stasis Field', cost: 1, description: 'Holds a lane for one wave' },
  filter: { name: 'Containment Filter', cost: 2, description: 'Clears all anomalies in the lane' },
}

export interface BoardEntity { lane: number; position: number; type?: string }
export interface ContainmentResources { charge: number; integrity: number }
export interface ContainmentState extends ModeSession<ContainmentResources, BoardEntity[]> {
  questionsAnswered: number; correctAnswers: number; contained: number; outcome: string
}

export const SPAWN_SCHEDULE: readonly (readonly number[])[] = [
  [0], [1], [2], [0], [1, 2], [0], [1], [0, 2], [1, 2], [0, 1],
]

export function getSpawnsForWave(wave: number, seed?: string): number[] {
  if (wave < 0 || wave >= SPAWN_SCHEDULE.length) return []
  const base = SPAWN_SCHEDULE[wave]
  if (!seed) return [...base]
  const offset = Math.floor(seeded(seed, `containment:spawn:${wave}`) * 3)
  return base.map((lane) => (lane + offset) % 3)
}

export function startContainment(seed: string): ContainmentState {
  const initialBoard: BoardEntity[] = getSpawnsForWave(0, seed).map((lane) => ({ lane, position: 0, type: 'anomaly' }))
  return {
    version: 1, mode: 'containment', caseId: '02-2', seed, questionIndex: 0,
    phase: 'question', turnToken: 0, feedback: null, resources: { charge: 1, integrity: 3 },
    board: initialBoard, questionsAnswered: 0, correctAnswers: 0, contained: 0, outcome: '',
  }
}

export function answerContainment(
  state: ContainmentState, correct: boolean, turnToken: number, feedback?: ModeAnswerFeedback | null,
): ContainmentState {
  if (state.turnToken !== turnToken || state.phase !== 'question') return state
  const fb: ModeAnswerFeedback = feedback ?? {
    itemId: `E6.1-${String((state.questionIndex % 12) + 1).padStart(2, '0')}`, correct,
  }
  return {
    ...state, phase: 'action', turnToken: state.turnToken + 1, feedback: fb,
    resources: { ...state.resources, charge: Math.min(100, state.resources.charge + (correct ? 2 : 0)) },
    questionsAnswered: state.questionsAnswered + 1, correctAnswers: state.correctAnswers + (correct ? 1 : 0),
  }
}

export function deployDefense(
  state: ContainmentState, slot: number, type: DefenseType, turnToken: number,
): ContainmentState {
  if (state.turnToken !== turnToken || state.phase !== 'action') return state
  if (!Number.isInteger(slot) || slot < 0 || slot > 2) return state
  const cost = DEFENSE_COSTS[type]
  if (cost === undefined || state.resources.charge < cost) return state
  if (state.board.some((e) => e.lane === slot && (e.type === 'magnet' || e.type === 'freeze' || e.type === 'filter'))) return state
  return {
    ...state, turnToken: state.turnToken + 1,
    resources: { ...state.resources, charge: state.resources.charge - cost },
    board: [...state.board, { lane: slot, position: 0, type }],
  }
}

export function resolveWave(state: ContainmentState, turnToken: number): ContainmentState {
  if (state.turnToken !== turnToken || (state.phase !== 'action' && state.phase !== 'wave')) return state
  const defenses = state.board.filter((e) => e.type === 'magnet' || e.type === 'freeze' || e.type === 'filter')
  let anomalies = state.board.filter((e) => !e.type || e.type === 'anomaly')
  let contained = 0
  const frozen = new Set<number>()

  for (const d of defenses) {
    if (d.type === 'freeze') frozen.add(d.lane)
    else if (d.type === 'filter') {
      const matched = anomalies.filter((a) => a.lane === d.lane)
      contained += matched.length
      anomalies = anomalies.filter((a) => a.lane !== d.lane)
    } else if (d.type === 'magnet') {
      const inLane = anomalies.filter((a) => a.lane === d.lane)
      if (inLane.length > 0) {
        const nearest = inLane.reduce((p, c) => (c.position > p.position ? c : p))
        anomalies = anomalies.filter((a) => a !== nearest)
        contained += 1
      }
    }
  }

  let breaches = 0
  const survivors: BoardEntity[] = []
  for (const a of anomalies) {
    if (frozen.has(a.lane)) survivors.push(a)
    else if (a.position + 1 >= 2) breaches += 1
    else survivors.push({ ...a, position: a.position + 1 })
  }

  const integrity = Math.max(0, state.resources.integrity - breaches)
  if (integrity > 0 && state.questionIndex < 9) {
    const spawns = getSpawnsForWave(state.questionIndex + 1, state.seed)
    for (const lane of spawns) {
      if (!survivors.some((a) => a.lane === lane && a.position === 0)) {
        survivors.push({ lane, position: 0, type: 'anomaly' })
      }
    }
  }

  const outcome = breaches > 0
    ? `Wave resolved: ${breaches} breach${breaches > 1 ? 'es' : ''}, ${contained} contained.`
    : `Wave resolved: ${contained} contained, integrity secure.`

  return {
    ...state, phase: 'resolved', turnToken: state.turnToken + 1,
    resources: { ...state.resources, integrity }, board: survivors,
    contained: state.contained + contained, outcome,
  }
}

export function nextContainment(state: ContainmentState, turnToken: number): ContainmentState {
  if (state.turnToken !== turnToken || state.phase !== 'resolved') return state
  if (state.resources.integrity <= 0 || state.questionIndex >= 9) {
    return { ...state, phase: 'done', turnToken: state.turnToken + 1 }
  }
  return {
    ...state, questionIndex: state.questionIndex + 1, phase: 'question',
    turnToken: state.turnToken + 1, feedback: null, outcome: '',
  }
}

export function getContainmentStats(state: ContainmentState) {
  const q = state.questionsAnswered
  return { questionsAnswered: q, accuracy: q > 0 ? Math.round((state.correctAnswers / q) * 100) : 0, contained: state.contained }
}

export function validateContainmentSession(value: unknown): ContainmentState | null {
  const session = validateModeSession<ContainmentResources, BoardEntity[]>(value, {
    mode: 'containment',
    caseId: '02-2',
    validateBoard: (board) => {
      if (!Array.isArray(board)) return false
      return board.every((e) => {
        if (!e || typeof e !== 'object' || Array.isArray(e)) return false
        const t = (e as Record<string, unknown>).type
        if (t === undefined || t === 'anomaly') return true
        return typeof t === 'string' && Object.prototype.hasOwnProperty.call(DEFENSE_DESCRIPTIONS, t)
      })
    },
  })
  if (!session) return null

  // Active question phases index into the 10-item question pool (indices 0..9).
  // Only terminal 'done' phase is allowed to have questionIndex === 10.
  if (session.phase === 'done') {
    if (session.questionIndex < 0 || session.questionIndex > 10) return null
  } else {
    if (session.questionIndex < 0 || session.questionIndex > 9) return null
  }

  const s = value as Record<string, unknown>
  const qa = typeof s.questionsAnswered === 'number' && Number.isInteger(s.questionsAnswered) && s.questionsAnswered >= 0 && s.questionsAnswered <= 10
    ? s.questionsAnswered : (s.questionsAnswered === undefined ? 0 : null)
  if (qa === null) return null
  const ca = typeof s.correctAnswers === 'number' && Number.isInteger(s.correctAnswers) && s.correctAnswers >= 0 && s.correctAnswers <= 10
    ? s.correctAnswers : (s.correctAnswers === undefined ? 0 : null)
  if (ca === null || ca > qa) return null
  const c = typeof s.contained === 'number' && Number.isInteger(s.contained) && s.contained >= 0 && s.contained <= 100
    ? s.contained : (s.contained === undefined ? 0 : null)
  if (c === null) return null
  return { ...session, questionsAnswered: qa, correctAnswers: ca, contained: c, outcome: typeof s.outcome === 'string' ? s.outcome : '' }
}
