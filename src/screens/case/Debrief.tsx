import { useEffect, useLayoutEffect, useRef } from 'react'
import { content } from '../../content/schema'
import { STILL } from '../../lib/flags'
import { useSession } from '../../state/session'
import { useGame } from '../../state/store'
import Burst from '../../ui/Burst'
import { countUpElement } from '../../ui/countUp'
import { useMotionMode } from '../../ui/useMotionMode'
import { debriefLine, fitStampFont, verdictPhrase } from './resultsDebrief'
import { CaseTop } from './ui'
import './results-debrief.css'

const LETTERS = ['A', 'B', 'C', 'D']
export const CLOSE_THRESHOLD = 0.8

/** Fits the stamp to the panel before paint, then again if the width or the font changes. */
function useStampFit(phrase: string) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const stamp = ref.current
    const panel = stamp?.closest('.panel') as HTMLElement | null
    if (!stamp || !panel) return
    let alive = true
    let lastW = -1
    const apply = () => {
      if (!alive) return
      const cs = getComputedStyle(panel)
      const inner = panel.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
      const fit = fitStampFont(Math.max(120, inner - 28), phrase)
      stamp.style.setProperty('--rd-stamp-font', `${fit.fontPx}px`)
      stamp.style.setProperty('--rd-stamp-track', `${fit.trackingEm}em`)
      const nodes = [stamp, ...stamp.querySelectorAll<HTMLElement>('.stamp-word, .stamp-icon')]
      for (let i = 0; i < 12; i++) {
        const b = panel.getBoundingClientRect()
        let over = 0
        for (const el of nodes) {
          const r = el.getBoundingClientRect()
          over = Math.max(over, b.left - r.left, r.right - b.right)
        }
        if (over <= 1) break
        const cur = parseFloat(stamp.style.getPropertyValue('--rd-stamp-font')) || fit.fontPx
        const next = Math.max(12, Math.round((cur - Math.max(0.5, over * 0.5)) * 10) / 10)
        if (next >= cur - 0.05) break
        stamp.style.setProperty('--rd-stamp-font', `${next}px`)
      }
    }
    const watch = () => {
      const w = panel.clientWidth
      if (Math.abs(w - lastW) < 0.5) return
      lastW = w
      apply()
    }
    watch()
    const ro = new ResizeObserver(watch)
    ro.observe(panel)
    const ready = document.fonts?.ready
    if (ready) {
      void ready.then(() => {
        lastW = -1
        watch()
      })
    }
    return () => {
      alive = false
      ro.disconnect()
    }
  }, [phrase])
  return ref
}

export default function Debrief() {
  const items = useSession((s) => s.items)
  const answers = useSession((s) => s.answers)
  const go = useSession((s) => s.go)
  const kind = useSession((s) => s.kind)
  const caseId = useSession((s) => s.caseId) ?? content.case.id
  const def = kind === 'cold' ? content.coldCase : content.case
  const setCaseStatus = useGame((s) => s.setCaseStatus)
  const reduced = useGame((s) => s.settings.reducedMotion)
  const motion = useMotionMode()
  const score = answers.filter((a) => a.correct).length
  const total = items.length
  const closed = total > 0 && score / total >= CLOSE_THRESHOLD
  const cold = kind === 'cold'
  const phrase = verdictPhrase(closed, cold)
  const stampRef = useStampFit(phrase)

  useEffect(() => {
    setCaseStatus(caseId, { closed, date: new Date().toISOString().slice(0, 10), score, total })
  }, [caseId, closed, score, total, setCaseStatus])

  // The main case score is counted from App. Cold cases count here. Still and reduced motion stay on the final number.
  useLayoutEffect(() => {
    if (!cold || reduced || STILL || motion === 'still') return
    const el = document.querySelector<HTMLElement>('[data-testid="debrief-score"]')
    return el ? countUpElement(el) : undefined
  }, [cold, reduced, motion, score, total])

  return (
    <div className="screen case-screen debrief-screen rd-screen" data-testid="debrief">
      <CaseTop step="debrief" />
      <div className="debrief-body">
        <header className={closed ? 'panel brackets debrief-head impact' : 'panel brackets debrief-head'}>
          <div className="stamp-wrap rd-stamp-slot">
            <div ref={stampRef} className={closed ? 'stamp closed' : 'stamp open'} data-testid="case-stamp" data-closed={closed ? 'yes' : 'no'}>
              <span className="stamp-icon" aria-hidden="true">
                {closed ? '\u2714' : '\u25CB'}
              </span>
              <span className="stamp-word">{phrase}</span>
            </div>
            {closed ? <Burst spread={90} /> : null}
          </div>
          <div className="debrief-summary">
            <p className="label amber">Shift result</p>
            <p className="debrief-score" data-testid="debrief-score">
              {score}
              {' OF '}
              {total}
              {' CORRECT'}
            </p>
            <p className="debrief-line">{debriefLine(closed, cold, def.debriefClosed, def.debriefOpen)}</p>
          </div>
          <button type="button" className="btn primary big" data-testid="debrief-continue" onClick={() => go('results')}>
            See results
          </button>
        </header>

        <div className="debrief-list" data-testid="debrief-list" aria-label="Evidence recap">
          {items.map((it, n) => {
            const a = answers.find((x) => x.itemId === it.id)
            if (!a) return null
            return (
              <article key={it.id} className={`panel debrief-item ${a.correct ? 'ok' : 'bad'}`} data-testid={`debrief-item-${n}`}>
                <header>
                  <span className="label">
                    ITEM {n + 1} <span className="muted">{it.benchmark}</span>
                  </span>
                  <span className={`verdict-chip ${a.correct ? 'ok' : 'bad'}`}>
                    <span aria-hidden="true">{a.correct ? '\u2714' : '\u2716'}</span> {a.correct ? 'Correct' : 'Not quite'}
                  </span>
                </header>
                <p className="debrief-stem">{it.stem}</p>
                <p className="label rd-block-label">Evidence</p>
                <p className="picked">
                  <span className="mono muted">You picked</span> {LETTERS[a.picked]}. {it.options[a.picked]}
                  {!a.correct ? (
                    <>
                      {' '}
                      <span className="mono muted">Key</span> {LETTERS[it.key]}. {it.options[it.key]}
                    </>
                  ) : null}
                </p>
                <div className="rd-take">
                  <p className="label rd-block-label">What this shows</p>
                  <p className="rd-learned-line">{it.why[it.key]}</p>
                </div>
                <ul className="why-list">
                  {it.options.map((o, i) => (
                    <li key={i} className={i === it.key ? 'key' : ''}>
                      <span className="why-letter">
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
