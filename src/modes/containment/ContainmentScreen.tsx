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
  answerContainment, DEFENSE_COSTS, DEFENSE_DESCRIPTIONS, deployDefense, getContainmentStats,
  nextContainment, resolveWave, startContainment, validateContainmentSession,
  type BoardEntity, type ContainmentState, type DefenseType,
} from './containment'
import './containment.css'

export type ContainmentAction =
  | { type: 'answer'; correct: boolean; feedback?: ModeAnswerFeedback | null }
  | { type: 'deploy'; slot: number; defense: DefenseType }
  | { type: 'resolve' } | { type: 'next' } | { type: 'restart'; seed?: string }

// oxlint-disable-next-line react/only-export-components -- storage guard
export function getSafeStorage(): Storage | null {
  try { return typeof window !== 'undefined' ? window.sessionStorage : null } catch { return null }
}

// oxlint-disable-next-line react/only-export-components -- turn dispatcher
export function dispatchTurn(state: ContainmentState, action: ContainmentAction): ContainmentState {
  if (action.type === 'answer') return answerContainment(state, action.correct, state.turnToken, action.feedback)
  if (action.type === 'deploy') return deployDefense(state, action.slot, action.defense, state.turnToken)
  if (action.type === 'resolve') return resolveWave(state, state.turnToken)
  if (action.type === 'next') return nextContainment(state, state.turnToken)
  if (action.type === 'restart') return startContainment(action.seed ?? String(Date.now()))
  return state
}

export function LaneBoard({
  board, phase, selectedDefense, charge, onDeploy,
}: {
  board: BoardEntity[]; phase: string; selectedDefense: DefenseType; charge: number; onDeploy: (lane: number) => boolean
}) {
  const [focusedLane, setFocusedLane] = useState(0), laneRefs = useRef<(HTMLButtonElement | null)[]>([])
  const cost = DEFENSE_COSTS[selectedDefense]
  const canAfford = charge >= cost
  const handleDeploy = (lane: number) => {
    const accepted = onDeploy(lane)
    if (accepted) {
      const next = [0, 1, 2].find((l) => l !== lane && !board.some((b) => b.lane === l && b.type && b.type !== 'anomaly'))
      if (next !== undefined) { setFocusedLane(next); laneRefs.current[next]?.focus() }
    }
  }
  const onKey = (e: React.KeyboardEvent, i: number) => {
    if (e.repeat) return
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); const n = (i + 1) % 3; setFocusedLane(n); laneRefs.current[n]?.focus() }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); const p = (i + 2) % 3; setFocusedLane(p); laneRefs.current[p]?.focus() }
    else if (e.key === 'Home') { e.preventDefault(); setFocusedLane(0); laneRefs.current[0]?.focus() }
    else if (e.key === 'End') { e.preventDefault(); setFocusedLane(2); laneRefs.current[2]?.focus() }
    else if ((e.key === 'Enter' || e.key === ' ') && phase === 'action' && canAfford && !board.some((b) => b.lane === i && b.type && b.type !== 'anomaly')) {
      e.preventDefault(); handleDeploy(i)
    }
  }

  return (
    <section className="panel containment-lanes-panel" aria-label="Containment lanes">
      <p className="containment-rules-note" style={{ margin: '0 0 8px 0', fontSize: '0.95rem' }}>
        Defenses last one wave.
      </p>
      <div className="containment-lanes" role="group" aria-label="Approach lanes">
        {[0, 1, 2].map((lane) => {
          const def = board.find((b) => b.lane === lane && b.type && b.type !== 'anomaly'), anoms = board.filter((b) => b.lane === lane && (!b.type || b.type === 'anomaly'))
          const isOccupied = Boolean(def), deployable = phase === 'action' && canAfford && !isOccupied, dt = def?.type as DefenseType | undefined
          const statusText = def && dt ? DEFENSE_DESCRIPTIONS[dt].name : deployable ? `Deploy ${DEFENSE_DESCRIPTIONS[selectedDefense].name}` : canAfford ? 'Occupied' : `Need ${cost} charge`
          return (
            <button key={lane} ref={(el) => { laneRefs.current[lane] = el }} type="button" className={`btn containment-lane-btn${isOccupied ? ' has-defense' : ''}`} tabIndex={focusedLane === lane ? 0 : -1} aria-label={`Lane ${lane + 1}: ${def && dt ? DEFENSE_DESCRIPTIONS[dt].name : 'No defense'}, ${anoms.length} anomalies`} aria-disabled={!deployable} onClick={() => { if (deployable) handleDeploy(lane) }} onKeyDown={(e) => onKey(e, lane)}>
              <span className="lane-header">Lane {lane + 1}</span>
              <span className="lane-status">{statusText}</span>
              <span className="lane-pos">Approaching: {anoms.filter((a) => a.position === 0).length} | At perimeter: {anoms.filter((a) => a.position === 1).length}</span>
            </button>
          )
        })}
      </div>
      <div className="containment-summary" aria-label="Lane status summary">
        <ul className="containment-summary-list">
          {[0, 1, 2].map((l) => {
            const def = board.find((b) => b.lane === l && b.type && b.type !== 'anomaly'), anoms = board.filter((b) => b.lane === l && (!b.type || b.type === 'anomaly')), dt = def?.type as DefenseType | undefined
            return <li key={l}>Lane {l + 1}: Approaching {anoms.some((a) => a.position === 0) ? 'anomaly' : 'clear'}, At perimeter {anoms.some((a) => a.position === 1) ? 'anomaly' : 'clear'}. Defense: {dt ? DEFENSE_DESCRIPTIONS[dt].name : 'None'}.</li>
          })}
        </ul>
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
      <p role="status" aria-live="polite" className={`containment-explanation ${feedback.correct ? 'correct' : 'incorrect'}`}>{feedback.explanation}</p>
      <div className="containment-actions">
        <button
          ref={continueRef}
          type="button"
          className="btn containment-continue-btn"
          onKeyDown={(e) => {
            if (e.repeat && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault()
            }
          }}
          onClick={onContinue}
        >
          Continue to deployment
        </button>
      </div>
    </section>
  )
}

export function ContainmentGame({ caseId }: { caseId: string }) {
  const [initial] = useState(() => {
    const storage = getSafeStorage(), saved = loadModeSession<ContainmentState>(storage, 'containment', caseId, validateContainmentSession)
    if (saved && saved.phase !== 'done') return saved
    const fresh = startContainment(String(Date.now()))
    saveModeSession(storage, 'containment', caseId, fresh)
    return fresh
  })
  const [game, setGame] = useState(initial), stateRef = useRef(initial)
  const [readyToDeploy, setReadyToDeploy] = useState(() => Boolean(initial.phase === 'action' && initial.board.some((b) => b.type && b.type !== 'anomaly')))
  const [restoredFeedback, setRestoredFeedback] = useState(() => Boolean(initial.feedback && initial.phase === 'action'))
  const [selectedDefense, setSelectedDefense] = useState<DefenseType>('magnet'), admit = useRef(createTapGuard()), motion = useMotionMode()
  const pool = useMemo(() => buildQuickPool(content.items, { caseId, count: 10, seed: game.seed }), [caseId, game.seed])
  const def = caseById(caseId)!, done = game.phase === 'done', stats = getContainmentStats(game)
  const deployGroupRef = useRef<HTMLDivElement>(null), summaryRef = useRef<HTMLDivElement>(null), resultsRef = useRef<HTMLHeadingElement>(null), continueBtnRef = useRef<HTMLButtonElement>(null)

  const handleTurn = (action: ContainmentAction): boolean => {
    const key = action.type === 'deploy' ? `deploy:${action.slot}` : action.type
    if (action.type !== 'answer' && !admit.current(key, 300)) return false
    const current = stateRef.current, next = dispatchTurn(current, action)
    if (next === current) return false
    stateRef.current = next
    const storage = getSafeStorage()
    if (next.phase === 'done') clearModeSession(storage, 'containment', caseId)
    else saveModeSession(storage, 'containment', caseId, next)
    setGame(next)
    return true
  }

  useEffect(() => () => { const storage = getSafeStorage(); if (stateRef.current.phase === 'done') clearModeSession(storage, 'containment', caseId) }, [caseId])
  useEffect(() => {
    if (game.phase === 'action') {
      if (readyToDeploy) deployGroupRef.current?.focus()
      else if (game.feedback) continueBtnRef.current?.focus()
    } else if (game.phase === 'resolved') {
      summaryRef.current?.focus()
    } else if (game.phase === 'done') {
      resultsRef.current?.focus()
    }
  }, [game.phase, game.feedback, readyToDeploy])

  const handleAnswer = (ans: { correct: boolean }) => {
    const item = pool[game.questionIndex]
    if (!item) return
    const explanation = cleanFeedback(ans.correct ? `Correct. ${item.why[item.key]}` : `Not quite. Correct answer: ${'ABCD'[item.key]}. ${toSentenceCase(item.options[item.key])}. ${item.why[item.key]}`).replace(/[\u2013\u2014]/g, '-')
    handleTurn({ type: 'answer', correct: ans.correct, feedback: { itemId: item.id, correct: ans.correct, explanation } })
  }
  const handleNext = () => { setReadyToDeploy(false); setRestoredFeedback(false); handleTurn({ type: 'next' }) }

  return (
    <main className="screen containment-screen" data-testid="containment-rush" data-motion={motion}>
      <div className="containment-body">
        <header className="containment-header">
          <button type="button" className="btn" onClick={() => navigate('/hub')} aria-label="Exit to hub">Exit to hub</button>
          <h1>Containment Rush</h1>
          <p>{def.codename} | {def.unitLabel}</p>
          <p>{done ? 'Mission debrief' : `Wave ${game.questionIndex + 1}/10`} | Integrity: <strong>{game.resources.integrity}/3</strong> | Charge: <strong>{game.resources.charge}</strong></p>
        </header>
        {done ? (
          <section className="panel containment-results" aria-label="Mission results">
            <h2 ref={resultsRef} tabIndex={-1}>{game.resources.integrity > 0 ? 'Containment Secured' : 'Facility Breached'}</h2>
            <div className="containment-stats">
              <p>Questions answered: <strong>{stats.questionsAnswered}/10</strong></p>
              <p>Accuracy: <strong>{stats.accuracy}%</strong></p>
              <p>Anomalies contained: <strong>{stats.contained}</strong></p>
              <p>Final integrity: <strong>{game.resources.integrity}/3</strong></p>
            </div>
            <p className="containment-debrief">{game.resources.integrity > 0 ? 'Field perimeter held. Geological anomaly specimens contained safely.' : 'Integrity compromised. Review geological data and retry containment.'}</p>
            <div className="containment-end-actions">
              <button type="button" className="btn" onClick={() => { clearModeSession(getSafeStorage(), 'containment', caseId); setReadyToDeploy(false); setRestoredFeedback(false); handleTurn({ type: 'restart' }) }}>Play again</button>
              <button type="button" className="btn" onClick={() => { clearModeSession(getSafeStorage(), 'containment', caseId); navigate('/hub') }}>Exit to hub</button>
            </div>
          </section>
        ) : game.phase === 'resolved' ? (
          <section className="panel containment-resolved-panel">
            <div ref={summaryRef} tabIndex={-1} role="status" aria-live="polite" className="containment-outcome"><p>{game.outcome}</p></div>
            <button type="button" className="btn containment-continue-btn" onClick={handleNext}>Continue</button>
          </section>
        ) : (
          <>
            {!readyToDeploy ? (
              restoredFeedback && game.feedback ? (
                <RestoredFeedback item={pool[game.questionIndex]} feedback={game.feedback} onContinue={() => { setReadyToDeploy(true); deployGroupRef.current?.focus() }} />
              ) : (
                <>
                  <QuickQuestion key={`${game.seed}:${game.questionIndex}`} item={pool[game.questionIndex]} ariaLive={true} onAnswer={handleAnswer} />
                  {game.feedback && (
                    <div className="containment-actions">
                      <button
                        ref={continueBtnRef}
                        type="button"
                        className="btn containment-continue-btn"
                        onKeyDown={(e) => {
                          if (e.repeat && (e.key === 'Enter' || e.key === ' ')) {
                            e.preventDefault()
                          }
                        }}
                        onClick={() => { setReadyToDeploy(true); deployGroupRef.current?.focus() }}
                      >
                        Continue to deployment
                      </button>
                    </div>
                  )}
                </>
              )
            ) : (
              <>
                <section className="panel containment-feedback" aria-label="Question feedback">
                  <p className="containment-stem"><strong>Question {game.questionIndex + 1}:</strong> {pool[game.questionIndex]?.stem}</p>
                  <p className={`containment-explanation ${game.feedback?.correct ? 'correct' : 'incorrect'}`}>{game.feedback?.explanation}</p>
                </section>
                <div ref={deployGroupRef} tabIndex={-1} className="containment-deploy-group" role="group" aria-label="Defense deployment">
                  <div className="containment-defense-select" role="radiogroup" aria-label="Select defense">
                    {(['magnet', 'freeze', 'filter'] as const).map((type) => {
                      const info = DEFENSE_DESCRIPTIONS[type], affordable = game.resources.charge >= info.cost, isSel = selectedDefense === type
                      return (
                        <button key={type} type="button" className={`btn containment-defense-btn${isSel ? ' selected' : ''}`} aria-pressed={isSel} aria-label={`${info.name}, cost ${info.cost} charge. ${info.description}`} disabled={game.phase !== 'action' || !affordable} onClick={() => setSelectedDefense(type)}>
                          <span className="defense-name">{info.name}</span>
                          <span className="defense-cost">Cost: {info.cost} charge</span>
                          <span className="defense-desc" style={{ fontSize: '0.85rem' }}>{info.description}</span>
                        </button>
                      )
                    })}
                  </div>
                  <LaneBoard board={game.board} phase={game.phase} selectedDefense={selectedDefense} charge={game.resources.charge} onDeploy={(lane) => handleTurn({ type: 'deploy', slot: lane, defense: selectedDefense })} />
                  {game.phase === 'action' && (
                    <div className="containment-actions"><button type="button" className="btn containment-resolve-btn" onClick={() => handleTurn({ type: 'resolve' })}>Resolve wave</button></div>
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

export default function ContainmentScreen({ caseId }: { caseId: string }) {
  const id = caseById(caseId) ? caseId : '02-2', ready = usePack(id)
  return ready ? <ContainmentGame key={id} caseId={id} /> : <main className="screen containment-screen"><p role="status">Opening containment facility...</p></main>
}
