import { useEffect, useMemo, useRef, useState } from 'react'
import { caseById, content } from '../../content'
import type { Item } from '../../content/schema'
import { usePack } from '../../content/usePack'
import { navigate } from '../../lib/router'
import { useReadAloud } from '../../lib/speech'
import ItemVisual from '../../screens/case/ItemVisual'
import { createTapGuard } from '../../ui/tapGuard'
import { useMotionMode } from '../../ui/useMotionMode'
import QuickQuestion from '../quick/QuickQuestion'
import { cleanFeedback, toSentenceCase } from '../quick/quickAnswer'
import { buildQuickPool } from '../quick/quickPool'
import { clearModeSession, loadModeSession, saveModeSession, type ModeAnswerFeedback } from '../quick/modeSession'
import {
  answerReactor, getReactorStats, loadBestScore, nextReactor, resolvePulse, saveBestScore,
  startReactor, useShield, validateReactorSession, type ReactorState,
} from './reactor'
import './reactor.css'

export type ReactorAction =
  | { type: 'answer'; correct: boolean; feedback?: ModeAnswerFeedback | null }
  | { type: 'shield' } | { type: 'pulse' } | { type: 'next' } | { type: 'restart'; seed?: string }

// oxlint-disable-next-line react/only-export-components -- storage guard
export function getSafeSessionStorage(): Storage | null {
  try { return typeof window !== 'undefined' ? window.sessionStorage : null } catch { return null }
}

// oxlint-disable-next-line react/only-export-components -- local storage guard
export function getSafeLocalStorage(): Storage | null {
  try { return typeof window !== 'undefined' ? window.localStorage : null } catch { return null }
}

// oxlint-disable-next-line react/only-export-components -- turn dispatcher
export function dispatchTurn(state: ReactorState, action: ReactorAction): ReactorState {
  if (action.type === 'answer') return answerReactor(state, action.correct, state.turnToken, action.feedback)
  // oxlint-disable-next-line react-hooks/rules-of-hooks
  if (action.type === 'shield') return useShield(state, state.turnToken)
  if (action.type === 'pulse') return resolvePulse(state, state.turnToken)
  if (action.type === 'next') return nextReactor(state, state.turnToken)
  if (action.type === 'restart') return startReactor(action.seed ?? String(Date.now()))
  return state
}

export function ReactorMeter({ instability }: { instability: number }) {
  const label = instability >= 8 ? 'Critical' : instability >= 5 ? 'Elevated' : 'Stable'
  return (
    <section className="panel reactor-meter-panel" aria-label="Core instability meter">
      <div>
        <strong>Core Instability: {instability}/10</strong> ({label})
      </div>
      <div className="reactor-meter-bar" role="progressbar" aria-valuenow={instability} aria-valuemin={0} aria-valuemax={10} aria-label={`Instability level ${instability} of 10, ${label}`}>
        {Array.from({ length: 10 }, (_, i) => {
          const segActive = i < instability
          const segClass = i >= 7 ? 'danger' : i >= 4 ? 'warning' : 'safe'
          return <div key={i} className={`reactor-meter-seg${segActive ? ` active ${segClass}` : ''}`} />
        })}
      </div>
    </section>
  )
}

function RestoredFeedback({ item, feedback, onContinue }: { item: Item; feedback: ModeAnswerFeedback; onContinue: () => void }) {
  const ra = useReadAloud(`${item.stem} ${feedback.explanation ?? ''}`)
  const continueRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    continueRef.current?.focus()
  }, [])
  return (
    <section className="panel quick-panel" aria-label="Restored question feedback" style={{ animation: 'none', transition: 'none' }}>
      <h2 tabIndex={-1} className="stem">{item.stem}</h2>
      <div className="quick-visual-wrap" style={{ maxHeight: 'min(34vh, 260px)', display: 'flex', justifyContent: 'center', width: '100%' }}><ItemVisual item={item} /></div>
      <button type="button" className="btn" aria-pressed={ra.speaking} onClick={() => (ra.speaking ? ra.stop() : ra.start())} style={{ minHeight: 44, transition: 'none' }}>{ra.speaking ? 'Stop reading' : 'Read aloud'}</button>
      <div role="group" aria-label="Answer choices" style={{ display: 'grid', gap: 12, marginTop: 12 }}>
        {item.options.map((opt, i) => {
          const isCorrect = i === item.key, letter = 'ABCD'[i]
          return <button key={i} type="button" className={`btn quick-option${isCorrect ? ' correct quick-correct' : ''}`} disabled aria-label={isCorrect ? `${letter}. ${toSentenceCase(opt)} (Correct answer)` : undefined} style={{ minHeight: 56, whiteSpace: 'normal', transition: 'none' }}>{letter}. {toSentenceCase(opt)}{isCorrect ? ' \u2713' : ''}</button>
        })}
      </div>
      <p role="status" aria-live="polite" className={`reactor-explanation ${feedback.correct ? 'correct' : 'incorrect'}`}>{feedback.explanation}</p>
      <div className="reactor-actions">
        <button
          ref={continueRef}
          type="button"
          className="btn reactor-continue-btn"
          onKeyDown={(e) => {
            if (e.repeat && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault()
            }
          }}
          onClick={onContinue}
        >
          Continue to core controls
        </button>
      </div>
    </section>
  )
}

export function ReactorGame({ caseId }: { caseId: string }) {
  const [initial] = useState(() => {
    const storage = getSafeSessionStorage(), saved = loadModeSession<ReactorState>(storage, 'reactor', caseId, validateReactorSession)
    if (saved && saved.phase !== 'done') return saved
    const fresh = startReactor(String(Date.now()))
    saveModeSession(storage, 'reactor', caseId, fresh)
    return fresh
  })
  const [game, setGame] = useState(initial), stateRef = useRef(initial)
  const [readyToAction, setReadyToAction] = useState(false)
  const [restoredFeedback, setRestoredFeedback] = useState(() => Boolean(initial.feedback && initial.phase === 'action'))
  const [bestScore, setBestScore] = useState(() => loadBestScore(getSafeLocalStorage()))
  const admit = useRef(createTapGuard()), motion = useMotionMode()
  const pool = useMemo(() => buildQuickPool(content.items, { caseId, count: 10, seed: game.seed }), [caseId, game.seed])
  const def = caseById(caseId)!, done = game.phase === 'done', stats = getReactorStats(game)
  const actionGroupRef = useRef<HTMLDivElement>(null), summaryRef = useRef<HTMLDivElement>(null), resultsRef = useRef<HTMLHeadingElement>(null), continueBtnRef = useRef<HTMLButtonElement>(null)

  const handleTurn = (action: ReactorAction) => {
    if (action.type !== 'answer' && !admit.current(action.type, 300)) return
    const current = stateRef.current, next = dispatchTurn(current, action)
    if (next === current) return
    stateRef.current = next
    const sessionStore = getSafeSessionStorage()
    if (next.phase === 'done') {
      clearModeSession(sessionStore, 'reactor', caseId)
      const best = saveBestScore(getSafeLocalStorage(), next.resources.score)
      setBestScore(best)
    } else {
      saveModeSession(sessionStore, 'reactor', caseId, next)
    }
    setGame(next)
  }

  useEffect(() => () => { const storage = getSafeSessionStorage(); if (stateRef.current.phase === 'done') clearModeSession(storage, 'reactor', caseId) }, [caseId])
  useEffect(() => {
    if (game.phase === 'action') {
      if (readyToAction) actionGroupRef.current?.focus()
      else if (game.feedback) continueBtnRef.current?.focus()
    } else if (game.phase === 'resolved') {
      summaryRef.current?.focus()
    } else if (game.phase === 'done') {
      resultsRef.current?.focus()
    }
  }, [game.phase, game.feedback, readyToAction])

  const handleAnswer = (ans: { correct: boolean }) => {
    const item = pool[game.questionIndex]
    if (!item) return
    const explanation = cleanFeedback(ans.correct ? `Correct. ${item.why[item.key]}` : `Not quite. Correct answer: ${'ABCD'[item.key]}. ${toSentenceCase(item.options[item.key])}. ${item.why[item.key]}`).replace(/[\u2013\u2014]/g, '-')
    handleTurn({ type: 'answer', correct: ans.correct, feedback: { itemId: item.id, correct: ans.correct, explanation } })
  }
  const handleNext = () => { setReadyToAction(false); setRestoredFeedback(false); handleTurn({ type: 'next' }) }

  return (
    <main className="screen reactor-screen" data-testid="reactor-stabilizer" data-motion={motion}>
      <div className="reactor-body">
        <header className="reactor-header">
          <button type="button" className="btn" onClick={() => navigate('/hub')} aria-label="Exit to hub">Exit to hub</button>
          <h1>Reactor Stabilizer</h1>
          <p>{def.codename} | {def.unitLabel}</p>
          <p>{done ? 'Mission debrief' : `Pulse ${game.questionIndex + 1}/10`} | Streak: <strong>{game.resources.streak}</strong> | Shields: <strong>{game.resources.shields}/2</strong> | Score: <strong>{game.resources.score}</strong> (Best: {bestScore})</p>
        </header>

        <ReactorMeter instability={game.resources.instability} />
        <section className="panel reactor-rules-panel" aria-label="Reactor rules">
          <p>
            Correct answer lowers instability by 2. Each pulse adds 1. Three consecutive correct answers earn a shield. A shield replaces the pulse.
          </p>
        </section>
        <div className="reactor-illustration" aria-hidden="true">[ Core Status: {game.resources.instability < 10 ? 'Active' : 'Overload'} ]</div>

        {done ? (
          <section className="panel reactor-results" aria-label="Mission results">
            <h2 ref={resultsRef} tabIndex={-1}>{stats.overload ? 'Core Overload' : 'Core Stabilized'}</h2>
            <div className="reactor-stats">
              <p>Questions answered: <strong>{stats.questionsAnswered}/10</strong></p>
              <p>Accuracy: <strong>{stats.accuracy}%</strong></p>
              <p>Score: <strong>{stats.score}</strong></p>
              <p>Best score: <strong>{bestScore}</strong></p>
            </div>
            <p className="reactor-debrief">{stats.overload ? 'Core reached critical instability.' : 'Core containment sustained across all pulses. Facility secure.'}</p>
            <div className="reactor-end-actions">
              <button type="button" className="btn" onClick={() => { clearModeSession(getSafeSessionStorage(), 'reactor', caseId); setReadyToAction(false); setRestoredFeedback(false); handleTurn({ type: 'restart' }) }}>Play again</button>
              <button type="button" className="btn" onClick={() => { clearModeSession(getSafeSessionStorage(), 'reactor', caseId); navigate('/hub') }}>Exit to hub</button>
            </div>
          </section>
        ) : game.phase === 'resolved' ? (
          <section className="panel reactor-resolved-panel">
            <div ref={summaryRef} tabIndex={-1} role="status" aria-live="polite" className="reactor-outcome"><p>{game.outcome}</p></div>
            <button type="button" className="btn reactor-continue-btn" onClick={handleNext}>Continue</button>
          </section>
        ) : (
          <>
            {!readyToAction ? (
              restoredFeedback && game.feedback ? (
                <RestoredFeedback item={pool[game.questionIndex]} feedback={game.feedback} onContinue={() => { setReadyToAction(true); actionGroupRef.current?.focus() }} />
              ) : (
                <>
                  <QuickQuestion key={`${game.seed}:${game.questionIndex}`} item={pool[game.questionIndex]} ariaLive={true} onAnswer={handleAnswer} />
                  {game.feedback && (
                    <div className="reactor-actions">
                      <button
                        ref={continueBtnRef}
                        type="button"
                        className="btn reactor-continue-btn"
                        onKeyDown={(e) => {
                          if (e.repeat && (e.key === 'Enter' || e.key === ' ')) {
                            e.preventDefault()
                          }
                        }}
                        onClick={() => { setReadyToAction(true); actionGroupRef.current?.focus() }}
                      >
                        Continue to core controls
                      </button>
                    </div>
                  )}
                </>
              )
            ) : (
              <>
                <section className="panel reactor-feedback" aria-label="Question feedback">
                  <p className="reactor-stem"><strong>Question {game.questionIndex + 1}:</strong> {pool[game.questionIndex]?.stem}</p>
                  <p className={`reactor-explanation ${game.feedback?.correct ? 'correct' : 'incorrect'}`}>{game.feedback?.explanation}</p>
                </section>
                <div ref={actionGroupRef} tabIndex={-1} className="reactor-action-group" role="group" aria-label="Reactor pulse controls">
                  {game.phase === 'action' && (
                    <div className="reactor-actions">
                      <button type="button" className="btn reactor-shield-btn" disabled={game.resources.shields <= 0} onClick={() => handleTurn({ type: 'shield' })}>
                        Use shield ({game.resources.shields} available)
                      </button>
                      <button type="button" className="btn reactor-pulse-btn" onClick={() => handleTurn({ type: 'pulse' })}>
                        Resolve pulse (+1 instability)
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </main>
  )
}

export default function ReactorScreen({ caseId }: { caseId: string }) {
  const id = caseById(caseId) ? caseId : '02-2', ready = usePack(id)
  return ready ? <ReactorGame key={id} caseId={id} /> : <main className="screen reactor-screen"><p role="status">Calibrating reactor core...</p></main>
}
