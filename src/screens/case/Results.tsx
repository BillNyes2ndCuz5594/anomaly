import { useEffect, useState } from 'react'
import { content } from '../../content/schema'
import { navigate } from '../../lib/router'
import { MASTERY_STAGES, parseISO, stageFraction, stageIndex, type MasteryStage } from '../../state/mastery'
import { useSession } from '../../state/session'
import { HUB_BENCHMARKS, MASTERY_LABEL, rankFor, useGame } from '../../state/store'
import { CaseTop } from './ui'

function dueLabel(iso: string | null | undefined): string {
  if (!iso) return 'No review scheduled yet'
  return new Date(parseISO(iso)).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' })
}

const LABELS: Record<string, string> = Object.fromEntries(HUB_BENCHMARKS.map((b) => [b.id, b.label]))

export default function Results() {
  const items = useSession((s) => s.items)
  const answers = useSession((s) => s.answers)
  const before = useSession((s) => s.stagesBefore)
  const paint = useSession((s) => s.paint)
  const progress = useGame((s) => s.progress)
  const mastery = useGame((s) => s.mastery)
  const intelTotal = useGame((s) => s.intel)
  const cases = useGame((s) => s.cases)
  const codexCount = useGame((s) => s.codex.length)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const id = window.setTimeout(() => setShown(true), 350)
    return () => window.clearTimeout(id)
  }, [])

  const intel = answers.reduce((n, a) => n + a.intel, 0)
  const rows = content.case.benchmarks.map((b) => {
    const mine = items.filter((i) => i.benchmark === b)
    const got = mine.filter((i) => answers.find((a) => a.itemId === i.id)?.correct).length
    const from = (before[b] ?? 'unseen') as MasteryStage
    const to = (progress[b]?.stage ?? 'unseen') as MasteryStage
    return { b, asked: mine.length, got, from, to, rose: stageIndex(to) > stageIndex(from) }
  })

  return (
    <div className="screen case-screen results-screen" data-testid="results">
      <CaseTop step="results" />
      <main className="results-body">
        <section className="panel brackets results-panel" aria-label="Mastery changes">
          <h1 className="mono panel-title">MASTERY UPDATE</h1>
          <ul className="bars" data-testid="mastery-bars">
            {rows.map((r) => {
              const frac = shown ? stageFraction(r.to) : stageFraction(r.from)
              return (
                <li key={r.b} className="bar-row" data-testid={`mastery-bar-${r.b}`} data-stage={r.to}>
                  <div className="bar-head">
                    <span className="mono bench-id">{r.b}</span>
                    <span className="bar-label">{LABELS[r.b] ?? r.b}</span>
                  </div>
                  <div className="bar-track" role="progressbar" aria-valuemin={0} aria-valuemax={4} aria-valuenow={stageIndex(r.to)} aria-label={`${LABELS[r.b] ?? r.b}: ${MASTERY_LABEL[r.to]}`}>
                    <div className="bar-fill" style={{ width: `${frac * 100}%` }} />
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

        <aside className="panel brackets results-side" aria-label="Rewards">
          <div className="reward" data-testid="intel-earned">
            <span className="mono label amber">INTEL EARNED</span>
            <strong className="reward-num mono">{intel}</strong>
            <span className="muted tiny">Total Intel: {intelTotal}</span>
          </div>
          <div className="reward" data-testid="case-status" data-closed={cases[content.case.id]?.closed ? 'yes' : 'no'}>
            <span className="mono label amber">CASE 03-1 VITALS</span>
            <p>
              <span aria-hidden="true">{cases[content.case.id]?.closed ? '\u2714' : '\u25CB'}</span>{' '}
              <strong>{cases[content.case.id]?.closed ? 'Case closed' : 'Case still open'}</strong>
            </p>
            <span className="muted tiny">
              {cases[content.case.id] ? `${cases[content.case.id].score} of ${cases[content.case.id].total} correct` : ''}
            </span>
          </div>
          <div className="reward" data-testid="paint-unlock" data-unlocked={paint ? 'yes' : 'no'}>
            <span className="mono label amber">DRONE PAINT</span>
            {paint ? (
              <p>
                <span aria-hidden="true">{'\u2605'}</span> Unlocked: <strong>{paint}</strong>
              </p>
            ) : (
              <p className="muted">No new paint this time. A paint unlocks when a benchmark moves up a stage.</p>
            )}
          </div>
          <div className="reward">
            <span className="mono label amber">AGENT</span>
            <p>
              Rank: <strong data-testid="results-rank">{rankFor(mastery)}</strong>
            </p>
            <span className="muted tiny">Codex entries: {codexCount}</span>
          </div>
          <button type="button" className="btn primary big" data-testid="back-to-hub" onClick={() => navigate('/hub')}>
            Back to hub
          </button>
        </aside>
      </main>
    </div>
  )
}
