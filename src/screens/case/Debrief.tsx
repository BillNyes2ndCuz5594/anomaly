import { useEffect } from 'react'
import { content } from '../../content/schema'
import { useSession } from '../../state/session'
import { useGame } from '../../state/store'
import Burst from '../../ui/Burst'
import { CaseTop } from './ui'

const LETTERS = ['A', 'B', 'C', 'D']
export const CLOSE_THRESHOLD = 0.8

export default function Debrief() {
  const items = useSession((s) => s.items)
  const answers = useSession((s) => s.answers)
  const go = useSession((s) => s.go)
  const kind = useSession((s) => s.kind)
  const caseId = useSession((s) => s.caseId) ?? content.case.id
  const def = kind === 'cold' ? content.coldCase : content.case
  const setCaseStatus = useGame((s) => s.setCaseStatus)
  const score = answers.filter((a) => a.correct).length
  const total = items.length
  const closed = total > 0 && score / total >= CLOSE_THRESHOLD

  useEffect(() => {
    setCaseStatus(caseId, { closed, date: new Date().toISOString().slice(0, 10), score, total })
  }, [caseId, closed, score, total, setCaseStatus])

  return (
    <div className="screen case-screen debrief-screen" data-testid="debrief">
      <CaseTop step="debrief" />
      <div className="debrief-body">
        <header className={closed ? 'panel brackets debrief-head impact' : 'panel brackets debrief-head'}>
          <div className="stamp-wrap">
            <div className={closed ? 'stamp closed' : 'stamp open'} data-testid="case-stamp" data-closed={closed ? 'yes' : 'no'}>
              <span className="stamp-icon" aria-hidden="true">
                {closed ? '\u2714' : '\u25CB'}
              </span>
              <span className="mono stamp-word">{closed ? (kind === 'cold' ? 'RESIDUE CLEARED' : 'CASE CLOSED') : 'CASE STILL OPEN'}</span>
            </div>
            {closed ? <Burst /> : null}
          </div>
          <div className="debrief-summary">
            <p className="debrief-score mono" data-testid="debrief-score">
              {score} OF {total} CORRECT
            </p>
            <p className="debrief-line">
              {closed ? def.debriefClosed : kind === 'cold' ? def.debriefOpen : 'CASE STILL OPEN. It returns as a cold case soon.'}
            </p>
          </div>
          <button type="button" className="btn primary big" data-testid="debrief-continue" onClick={() => go('results')}>
            See results
          </button>
        </header>

        <div className="debrief-list" data-testid="debrief-list">
          {items.map((it, n) => {
            const a = answers.find((x) => x.itemId === it.id)
            if (!a) return null
            return (
              <article key={it.id} className={`panel debrief-item ${a.correct ? 'ok' : 'bad'}`} data-testid={`debrief-item-${n}`}>
                <header>
                  <span className="mono label">
                    ITEM {n + 1} <span className="muted">{it.benchmark}</span>
                  </span>
                  <span className={`verdict-chip ${a.correct ? 'ok' : 'bad'}`}>
                    <span aria-hidden="true">{a.correct ? '\u2714' : '\u2716'}</span> {a.correct ? 'Correct' : 'Not quite'}
                  </span>
                </header>
                <p className="debrief-stem">{it.stem}</p>
                <p className="picked">
                  <span className="mono muted">You picked</span> {LETTERS[a.picked]}. {it.options[a.picked]}
                  {!a.correct ? (
                    <>
                      {' '}
                      <span className="mono muted">Key</span> {LETTERS[it.key]}. {it.options[it.key]}
                    </>
                  ) : null}
                </p>
                <ul className="why-list">
                  {it.options.map((o, i) => (
                    <li key={i} className={i === it.key ? 'key' : ''}>
                      <span className="mono why-letter">
                        <span aria-hidden="true">{i === it.key ? '\u2714' : '\u2716'}</span> {LETTERS[i]}
                      </span>
                      <span>
                        <strong className="why-opt">{o}</strong>
                        {it.why[i]}
                      </span>
                    </li>
                  ))}
                </ul>
              </article>
            )
          })}
        </div>
      </div>
    </div>
  )
}
