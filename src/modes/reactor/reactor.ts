import { validateModeSession, type ModeAnswerFeedback, type ModeSession } from '../quick/modeSession'

export interface ReactorResources { instability: number; streak: number; shields: number; score: number }
export interface ReactorState extends ModeSession<ReactorResources, never[]> {
  questionsAnswered: number; correctAnswers: number; outcome: string
}

export const BEST_SCORE_KEY = 'anomaly:reactor:best:v1'

export const getScoreMultiplier = (streak: number): number => (streak >= 6 ? 3 : streak >= 3 ? 2 : 1)

export function startReactor(seed: string): ReactorState {
  return {
    version: 1, mode: 'reactor', caseId: '02-2', seed, questionIndex: 0,
    phase: 'question', turnToken: 0, feedback: null,
    resources: { instability: 4, streak: 0, shields: 0, score: 0 },
    board: [], questionsAnswered: 0, correctAnswers: 0, outcome: '',
  }
}

export function answerReactor(
  state: ReactorState, correct: boolean, turnToken: number, feedback?: ModeAnswerFeedback | null,
): ReactorState {
  if (state.turnToken !== turnToken || state.phase !== 'question') return state
  const fb: ModeAnswerFeedback = feedback ?? {
    itemId: `E6.1-${String((state.questionIndex % 12) + 1).padStart(2, '0')}`, correct,
  }
  const nextStreak = correct ? state.resources.streak + 1 : 0
  const points = correct ? 10 * getScoreMultiplier(nextStreak) : 0
  const earnedShield = correct && nextStreak > 0 && nextStreak % 3 === 0
  const shields = Math.min(2, state.resources.shields + (earnedShield ? 1 : 0))
  const instability = correct ? Math.max(0, state.resources.instability - 2) : state.resources.instability

  return {
    ...state, phase: 'action', turnToken: state.turnToken + 1, feedback: fb,
    resources: { instability, streak: nextStreak, shields, score: state.resources.score + points },
    questionsAnswered: state.questionsAnswered + 1, correctAnswers: state.correctAnswers + (correct ? 1 : 0),
  }
}

export function useShield(state: ReactorState, turnToken: number): ReactorState {
  if (state.turnToken !== turnToken || state.phase !== 'action' || state.resources.shields <= 0) return state
  return {
    ...state, phase: 'resolved', turnToken: state.turnToken + 1,
    resources: { ...state.resources, shields: state.resources.shields - 1 },
    outcome: 'Shield activated: pulse blocked, core stabilized.',
  }
}

export function resolvePulse(state: ReactorState, turnToken: number): ReactorState {
  if (state.turnToken !== turnToken || (state.phase !== 'action' && state.phase !== 'pulse')) return state
  const instability = Math.min(10, state.resources.instability + 1)
  return {
    ...state, phase: 'resolved', turnToken: state.turnToken + 1,
    resources: { ...state.resources, instability },
    outcome: instability >= 10 ? 'Core overload! Instability reached critical.' : 'Pulse resolved: instability increased by 1.',
  }
}

export function nextReactor(state: ReactorState, turnToken: number): ReactorState {
  if (state.turnToken !== turnToken || state.phase !== 'resolved') return state
  if (state.resources.instability >= 10 || state.questionIndex >= 9) {
    return { ...state, phase: 'done', turnToken: state.turnToken + 1 }
  }
  return {
    ...state, questionIndex: state.questionIndex + 1, phase: 'question',
    turnToken: state.turnToken + 1, feedback: null, outcome: '',
  }
}

export function getReactorStats(state: ReactorState) {
  const q = state.questionsAnswered
  return {
    questionsAnswered: q, accuracy: q > 0 ? Math.round((state.correctAnswers / q) * 100) : 0,
    score: state.resources.score, overload: state.resources.instability >= 10,
  }
}

export function loadBestScore(storage?: { getItem(k: string): string | null } | null): number {
  try {
    const raw = storage?.getItem(BEST_SCORE_KEY)
    if (!raw) return 0
    const parsed = JSON.parse(raw)
    return typeof parsed === 'number' && Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0
  } catch { return 0 }
}

export function saveBestScore(storage: { getItem(k: string): string | null; setItem(k: string, v: string): void } | null | undefined, score: number): number {
  if (!Number.isSafeInteger(score) || score < 0) return 0
  try {
    const prev = loadBestScore(storage)
    const best = Math.max(prev, score)
    storage?.setItem(BEST_SCORE_KEY, JSON.stringify(best))
    return best
  } catch { return score }
}

export function validateReactorSession(value: unknown): ReactorState | null {
  const session = validateModeSession<ReactorResources, never[]>(value, { mode: 'reactor', caseId: '02-2' })
  if (!session) return null
  if (session.questionIndex < 0 || session.questionIndex > 9) return null
  const s = value as Record<string, unknown>
  const qa = typeof s.questionsAnswered === 'number' && Number.isInteger(s.questionsAnswered) && s.questionsAnswered >= 0 && s.questionsAnswered <= 10 ? s.questionsAnswered : null
  const ca = typeof s.correctAnswers === 'number' && Number.isInteger(s.correctAnswers) && s.correctAnswers >= 0 && s.correctAnswers <= 10 ? s.correctAnswers : null
  if (qa === null || ca === null || ca > qa) return null
  if (session.phase === 'question' && (session.feedback !== null || qa !== session.questionIndex)) return null
  if (session.phase !== 'question' && session.feedback === null) return null
  if (session.phase !== 'question' && session.phase !== 'done' && qa !== session.questionIndex + 1) return null
  if (session.phase === 'done' && qa < session.questionIndex) return null
  const res = session.resources
  if (typeof res.shields !== 'number' || res.shields < 0 || res.shields > 2) return null
  if (typeof res.instability !== 'number' || res.instability < 0 || res.instability > 10) return null
  if (typeof res.score !== 'number' || res.score < 0) return null
  return { ...session, questionsAnswered: qa, correctAnswers: ca, outcome: typeof s.outcome === 'string' ? s.outcome : '' }
}
