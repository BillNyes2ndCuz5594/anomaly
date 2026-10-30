import { useCallback, useEffect, useRef, useState } from 'react'
import { content } from '../../content/schema'
import { useFx, useSession } from '../../state/session'
import { useGame } from '../../state/store'
import { ORGAN_LIST } from '../../three/models/humanList'
import './labs-ac.css'
import { usePressed } from './pressable'
import { CaseTop, PanelHead, ReadAloudButton, Verdict } from './ui'

interface Feedback {
  ok: boolean
  word: string
  text: string
}

export default function LabA() {
  const lab = content.case.labs.organOps
  const next = useSession((s) => s.next)
  const unlock = useGame((s) => s.unlockCodex)
  const [i, setI] = useState(0)
  const [fb, setFb] = useState<Feedback | null>(null)
  const task = lab.tasks[i]
  const done = fb?.ok === true
  const last = i === lab.tasks.length - 1
  const hot = useFx((s) => s.hover)
  const lit = useFx((s) => s.lit)
  const press = usePressed()

  const pick = useCallback(
    (id: string) => {
      if (done) return
      const fx = useFx.getState()
      fx.flashPart(id, id === task.organ)
      if (id === task.organ) {
        setFb({ ok: true, word: 'Correct', text: task.why })
        useFx.getState().setLit([id])
        unlock([`organ:${id}`])
      } else {
        setFb({ ok: false, word: 'Not that one.', text: task.hint })
      }
    },
    [done, task, unlock],
  )

  // The 3D layer calls the registered handler on a click. Keep it pointed at the latest closure.
  const pickRef = useRef(pick)
  pickRef.current = pick
  useEffect(() => {
    useFx.getState().setPick((id) => pickRef.current(id))
    return () => {
      const fx = useFx.getState()
      fx.setPick(null)
      fx.setHover(null)
      fx.setLit([])
      document.body.style.cursor = ''
    }
  }, [])

  function advance() {
    const fx = useFx.getState()
    fx.setLit([])
    fx.setHover(null)
    if (last) next()
    else {
      setI(i + 1)
      setFb(null)
    }
  }

  return (
    <div className="screen case-screen" data-testid="lab-a">
      <CaseTop step="lab-a" />

      <aside className="panel brackets side-panel" aria-label="Organ list">
        <PanelHead code="FIELD LAB A" title="ORGAN OPS" />
        <p className="intro">{lab.scenario}</p>
        <p className="intro strong">{lab.intro}</p>
        <ReadAloudButton text={`${lab.scenario} ${lab.intro}`} testId="read-aloud-lab" />
        <h3 className="section-title mono">Organ list</h3>
        <div className="organ-list" data-testid="organ-list" role="group" aria-label="Choose an organ">
          {ORGAN_LIST.map((o) => (
            <button
              key={o.id}
              type="button"
              className={`organ-btn${hot === o.id ? ' is-hot' : ''}${lit.includes(o.id) ? ' is-lit' : ''}`}
              data-testid={`organ-${o.id}`}
              style={{ ['--tint' as string]: o.tint }}
              disabled={done}
              onClick={() => pick(o.id)}
              onMouseEnter={() => useFx.getState().setHover(o.id)}
              onMouseLeave={() => useFx.getState().setHover(null)}
              onFocus={() => useFx.getState().setHover(o.id)}
              onBlur={() => useFx.getState().setHover(null)}
              {...press(o.id, done)}
            >
              <span className="swatch" aria-hidden="true" />
              <span className="organ-name">{o.label}</span>
            </button>
          ))}
        </div>
        <p className="muted tiny">Tip: tap or click an organ on the hologram, or use this list. The skin covers the whole body.</p>
      </aside>

      <section className="dock" aria-label="Job card">
        <div className="panel brackets job-card" data-testid="task-card">
          <div className="job-head">
            <span className="mono label amber">
              JOB {i + 1} OF {lab.tasks.length}
            </span>
            <span className="pips" aria-hidden="true">
              {lab.tasks.map((t, k) => (
                <span key={t.id} className={k < i || (k === i && done) ? 'pip on' : 'pip'} />
              ))}
            </span>
          </div>
          <p className="job-text" data-testid="task-text">
            {task.text}
          </p>
          <div className="job-row">
          {fb ? (
            <Verdict ok={fb.ok} word={fb.word} testId="lab-feedback">
              {fb.text}
            </Verdict>
          ) : (
            <p className="muted">Pick the organ that does this job.</p>
          )}
          {done ? (
            <button type="button" className="btn primary" data-testid="lab-next" onClick={advance} autoFocus {...press('next')}>
              {last ? 'Finish lab' : 'Next job'}
            </button>
          ) : null}
          </div>
        </div>
      </section>
    </div>
  )
}
