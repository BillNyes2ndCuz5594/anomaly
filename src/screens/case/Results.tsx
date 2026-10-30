import { useEffect, useState } from 'react'
import Burst from '../../ui/Burst'
import { STILL } from '../../lib/flags'
import { content } from '../../content/schema'
import { navigate } from '../../lib/router'
import { MASTERY_STAGES, parseISO, stageFraction, stageIndex, type MasteryStage } from '../../state/mastery'
import { useSession } from '../../state/session'
import { CATALOG_BENCHMARKS } from '../../lib/catalog.generated'
import { MASTERY_LABEL, rankFor, useGame } from '../../state/store'
import ReportCodePanel from '../../ui/ReportCodePanel'
import { countValue } from '../../ui/countUp'
import { useMotionMode } from '../../ui/useMotionMode'
import { debriefLine, verdictWord } from './resultsDebrief'
import { CaseTop } from './ui'
import './results-debrief.css'

function dueLabel(iso: string | null | undefined): string {
  if (!iso) return 'No review scheduled yet'
  return new Date(parseISO(iso)).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' })
}

/** Counts up from 0. Reduced motion and ?still=1 show the final number immediately. */
function useCountUp(target: number, snap: boolean, startDelay = 220, ms = 680): number {
  const [v, setV] = useState(0)
  useEffect(() => {
    if (snap) return
    let raf = 0
    const t0 = performance.now() + startDelay
    const tick = (now: number) => {
      setV(countValue(target, now - t0, ms))
      if (now - t0 < ms) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, snap, startDelay, ms])
  return snap ? target : v
}

const LABELS: Record<string, string> = Object.fromEntries(CATALOG_BENCHMARKS.map((b) => [b.id, b.label]))

export default function Results() {
  const items = useSession((s) => s.items)
  const answers = useSession((s) => s.answers)
  const before = useSession((s) => s.stagesBefore)
  const kind = useSession((s) => s.kind)
  const benchmarks = useSession((s) => s.benchmarks)
  const caseId = useSession((s) => s.caseId) ?? content.case.id
  const cold = kind === 'cold'
  const def = cold ? content.coldCase : content.case
  const caseLabel = cold ? `COLD CASE ${content.coldCase.codename}` : `CASE ${content.case.id} ${content.case.codename}`
  const paint = useSession((s) => s.paint)
  const progress = useGame((s) => s.progress)
  const mastery = useGame((s) => s.mastery)
  const intelTotal = useGame((s) => s.intel)
  const cases = useGame((s) => s.cases)
  const codexCount = useGame((s) => s.codex.length)
  const reduced = useGame((s) => s.settings.reducedMotion)
  const motion = useMotionMode()
  const snap = reduced || STILL || motion === 'still'
  const [revealed, setRevealed] = useState(false)
  useEffect(() => {
    if (motion !== 'full') return
    const id = window.setTimeout(() => setRevealed(true), 280)
    return () => window.clearTimeout(id)
  }, [motion])
  const shown = motion !== 'full' || revealed

  const intel = answers.reduce((n, a) => n + a.intel, 0)
  const intelShown = useCountUp(intel, snap)
  const closed = Boolean(cases[caseId]?.closed)
  const score = cases[caseId]?.score ?? answers.filter((a) => a.correct).length
  const total = cases[caseId]?.total ?? items.length
  const scoreShown = useCountUp(score, snap, 160, 640)
  const rows = benchmarks.map((b) => {
    const mine = items.filter((i) => i.benchmark === b)
    const got = mine.filter((i) => answers.find((a) => a.itemId === i.id)?.correct).length
    const from = (before[b] ?? 'unseen') as MasteryStage
    const to = (progress[b]?.stage ?? 'unseen') as MasteryStage
    return { b, asked: mine.length, got, from, to, rose: stageIndex(to) > stageIndex(from) }
  })

  return (
    <div className="screen case-screen results-screen rd-screen" data-testid="results">
      <CaseTop step="results" />
      <main className="results-body" data-reveal={shown ? 'yes' : 'no'}>
        <section className="panel brackets rd-hero" aria-label="Case result">
          <div className="reward verdict-block" data-testid="case-status" data-closed={closed ? 'yes' : 'no'}>
            <span className="label amber">{caseLabel}</span>
            <p>
              <span aria-hidden="true">{closed ? '\u2714' : '\u25CB'}</span> <strong>{verdictWord(closed, cold)}</strong>
            </p>
            <p className="rd-scoreline">
              <span className="sr-only">
                {score} of {total} correct
              </span>
              <span aria-hidden="true">
                <span className="rd-score-num">{scoreShown}</span> of {total} correct
              </span>
            </p>
          </div>
          <div className="reward rd-intel" data-testid="intel-earned">
            <span className="label amber">Intel earned</span>
            <strong className="reward-num" aria-label={`${intel} Intel earned`}>
              <span className="sr-only">{intel}</span>
              <span className="rd-count" aria-hidden="true">
                {intelShown}
              </span>
            </strong>
            <span className="muted tiny">Total Intel: {intelTotal}</span>
          </div>
          <p className="rd-dispatch">{debriefLine(closed, cold, def.debriefClosed, def.debriefOpen)}</p>
        </section>

        <section className="panel brackets results-panel" aria-label="Mastery changes">
          <h1 className="panel-title">Mastery update</h1>
          <ul className="bars" data-testid="mastery-bars">
            {rows.map((r) => {
              const frac = shown ? stageFraction(r.to) : stageFraction(r.from)
              return (
                <li key={r.b} className="bar-row" data-testid={`mastery-bar-${r.b}`} data-stage={r.to}>
                  <div className="bar-head">
                    <span className="mono bench-id">{r.b}</span>
                    <span className="bar-label">{LABELS[r.b] ?? r.b}</span>
                  </div>
                  <div className={r.rose ? 'bar-track rose' : 'bar-track'} role="progressbar" aria-valuemin={0} aria-valuemax={4} aria-valuenow={stageIndex(r.to)} aria-label={`${LABELS[r.b] ?? r.b}: ${MASTERY_LABEL[r.to]}`}>
                    <div className="bar-fill" style={{ width: `${frac * 100}%` }} />
                    {r.rose && shown ? (
                      <span className="stage-up-burst" style={{ left: `${frac * 100}%` }}>
                        <Burst color="#ffb547" spread={70} delay={1.45} big={false} />
                      </span>
                    ) : null}
                    {[1, 2, 3].map((t) => (
                      <i key={t} className="bar-tick" style={{ left: `${t * 25}%` }} aria-hidden="true" />
                    ))}
                  </div>
                  <div className="bar-ladder mono" aria-hidden="true">
                    {MASTERY_STAGES.map((st, k) => (
                      <span key={st} className={st === r.to ? 'here' : ''} style={{ left: `${k * 25}%`, transform: `translateX(-${k * 25}%)` }}>
                        {MASTERY_LABEL[st]}
                      </span>
                    ))}
                  </div>
                  <div className="bar-foot mono">
                    <span>
                      {r.got} of {r.asked} correct | Next review: {dueLabel(progress[r.b]?.nextDue)}
                    </span>
                    <span>
                      {r.rose ? (
                        <>
                          <span aria-hidden="true">{'\u25B2'}</span> {MASTERY_LABEL[r.from]} to {MASTERY_LABEL[r.to]}
                        </>
                      ) : (
                        <>Stage: {MASTERY_LABEL[r.to]}</>
                      )}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>

        <aside className="panel brackets results-side" aria-label="Shift file">
          <h2 className="panel-title">Shift file</h2>
          <div className={paint ? 'reward unlocked' : 'reward'} data-testid="paint-unlock" data-unlocked={paint ? 'yes' : 'no'}>
            {paint ? <Burst color="#ffb547" spread={90} delay={0.9} big={false} /> : null}
            <span className="label amber">Drone paint</span>
            {paint ? (
              <p>
                <span aria-hidden="true">{'\u2605'}</span> Unlocked: <strong>{paint}</strong>
              </p>
            ) : (
              <p className="muted">No new paint this time. A paint unlocks when a benchmark moves up a stage.</p>
            )}
          </div>
          <div className="reward">
            <span className="label amber">Agent</span>
            <p>
              Rank: <strong data-testid="results-rank">{rankFor(mastery)}</strong>
            </p>
            <span className="muted tiny">Codex entries: {codexCount}</span>
          </div>
          <ReportCodePanel intro="Copy this into your Canvas assignment. It also resumes your progress on another laptop." />
          <button type="button" className="btn primary big" data-testid="back-to-hub" onClick={() => navigate('/hub')}>
            Back to hub
          </button>
        </aside>
      </main>
    </div>
  )
}
