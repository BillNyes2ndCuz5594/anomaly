import { LAB_CARD_ART } from '../../ui/labCardArt'
import { useTapGuard } from '../../ui/useTapGuard'
import { useEffect, useRef, useState } from 'react'
import { codexById } from '../../content'
import { newSeed, useFx, useSession } from '../../state/session'
import { useGame } from '../../state/store'
import { clearFlyChips, flyChip } from '../../ui/flyChip'
import { useMotionMode } from '../../ui/useMotionMode'
import './lab-generic.css'
import {
  codexFor,
  initLab,
  isComplete,
  labCards,
  labReduce,
  visibleTargets,
  nextSlot,
  pedestalFor,
  placedCount,
  stepInSlot,
  targetOpen,
  type GenericLab,
  type LabAction,
  type LabState,
} from './labGenericData'
import { usePressed } from './pressable'
import { CaseTop, PanelHead, ReadAloudButton, Verdict } from './ui'
import { useCaseDef } from './useCaseDef'

const TITLE: Record<GenericLab['kind'], string> = { sort: 'SORT', match: 'MATCH', order: 'ORDER' }
const TARGETS_HEAD: Record<GenericLab['kind'], string> = { sort: 'Bins', match: 'Match it to', order: 'Pick the next step' }
const ASK: Record<GenericLab['kind'], string> = {
  sort: 'Which bin does this card go in?',
  match: 'Which card does this one go with?',
  order: 'Which step comes next?',
}

/** Test id of a target button. */
function targetTestId(kind: GenericLab['kind'], id: string): string {
  return kind === 'sort' ? `lab-bin-${id}` : kind === 'match' ? `lab-right-${id}` : `lab-step-${id}`
}

/** Test id of a card chip in the tray (the order lab shows its slots instead). */
function cardTestId(kind: GenericLab['kind'], id: string): string {
  return kind === 'match' ? `lab-left-${id}` : `lab-card-${id}`
}

/** One Field Lab for every case except VITALS: sort cards into bins, match pairs, or put steps in order. */
export default function LabGeneric() {
  useEffect(() => clearFlyChips, [])
  const admit = useTapGuard()
  const def = useCaseDef()
  const lab = def.lab as GenericLab
  const next = useSession((s) => s.next)
  const unlock = useGame((s) => s.unlockCodex)
  const [st, setSt] = useState<LabState>(() => initLab(lab, `${def.id}|${newSeed()}`))
  const motion = useMotionMode()
  const press = usePressed()
  const hot = useFx((s) => s.hover)
  const cards = labCards(lab)
  const byId = new Map(cards.map((c) => [c.id, c]))
  const targets = visibleTargets(lab, st)
  const done = isComplete(lab, st)
  const total = cards.length
  const slot = nextSlot(lab, st)
  const current = st.current ? byId.get(st.current) : undefined
  const order = lab.kind === 'order'

  function act(action: LabAction) {
    if (action.type === 'place' && (!admit('feedback', 0) || !admit(`place:${st.current}:${slot}:${action.target}`, 450))) return
    const after = labReduce(lab, st, action)
    if (after === st) return
    setSt(after)
    const fb = after.feedback
    if (action.type !== 'place' || !fb || fb === st.feedback) return
    const fx = useFx.getState()
    const pedestal = order ? `slot-${slot}` : fb.target
    fx.flashPart(pedestal, fb.ok)
    if (!fb.ok) return
    admit('feedback', 400)
    fx.setLit(Object.keys(after.placed).map((c) => pedestalFor(lab, after, c) as string))
    const codex = codexFor(def.id, fb.card, codexById)
    if (codex.length) unlock(codex)
    if (motion === 'full') {
      const from = document.querySelector(`[data-testid="${order ? targetTestId('order', fb.card) : cardTestId(lab.kind, fb.card)}"]`)
      const to = document.querySelector(`[data-testid="${order ? `lab-slot-${slot}` : targetTestId(lab.kind, fb.target)}"]`)
      flyChip(byId.get(fb.card)?.name ?? '', from, to, motion, 400)
    }
  }

  // The 3D pedestals call the registered handler on a click. Sort bins and match cards are pickable; order slots are not.
  const actRef = useRef<typeof act | null>(null)
  useEffect(() => {
    actRef.current = act
  })
  useEffect(() => {
    const fx = useFx.getState()
    fx.setPick((id) => {
      if (lab.kind !== 'order') actRef.current?.({ type: 'place', target: id })
    })
    return () => {
      const f = useFx.getState()
      f.setPick(null)
      f.setHover(null)
      f.setLit([])
      f.setCard(null)
      document.body.style.cursor = ''
    }
  }, [lab.kind])
  // What the 3D slab stands for: the current card, or the slot being filled in an order lab. Null hides it.
  const onDais = order ? (slot ? `slot-${slot}` : null) : st.current
  useEffect(() => {
    useFx.getState().setCard(onDais)
  }, [onDais])

  const hoverTarget = (id: string | null) => useFx.getState().setHover(id === null ? null : order ? (slot ? `slot-${slot}` : null) : id)
  const readText = order ? `${lab.intro} ${lab.prompt}` : lab.intro

  return (
    <div className="screen case-screen" data-testid="lab-generic" data-kind={lab.kind}>
      <CaseTop step="lab" />

      <aside className="panel brackets side-panel" aria-label={`Field lab, ${lab.kind}`}>
        <PanelHead code="FIELD LAB" title={TITLE[lab.kind]} />
        <p className="intro strong">{lab.intro}</p>
        <ReadAloudButton text={readText} testId="read-aloud-lab" />

        <div className="spec-card lab-card" data-testid="lab-card" style={{ backgroundImage: `linear-gradient(90deg, rgba(5, 11, 22, 0.94), rgba(5, 11, 22, 0.78)), url("${LAB_CARD_ART[def.category]}")` }}>
          {order ? (
            <>
              <span className="mono label amber">{slot ? `STEP ${slot} OF ${total}` : 'ALL STEPS PLACED'}</span>
              <h3 className="spec-name">{lab.prompt}</h3>
            </>
          ) : current ? (
            <>
              <span className="mono label amber">{lab.kind === 'match' ? 'MATCH CARD' : 'SAMPLE CARD'}</span>
              <h3 className="spec-name" data-testid="lab-card-name">
                {current.name}
              </h3>
              {current.lines.length ? (
                <ul>
                  {current.lines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : (
            <>
              <span className="mono label amber">ALL CARDS PLACED</span>
              <h3 className="spec-name">Lab complete</h3>
            </>
          )}
        </div>

        <div className="lab-targets">
          <h3 className="section-title mono">{TARGETS_HEAD[lab.kind]}</h3>
          <div className={`target-grid n${targets.length}`} role="group" aria-label={TARGETS_HEAD[lab.kind]}>
            {targets.map((t) => {
              const open = targetOpen(lab, st, t.id)
              const disabled = done || !open || (!order && !current)
              const count = lab.kind === 'sort' ? Object.values(st.placed).filter((b) => b === t.id).length : 0
              const used = !open
              const id = order ? `slot-${slot}` : t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  className={`btn target${used ? ' on' : ''}${hot === id && !disabled ? ' is-hot' : ''}`}
                  data-testid={targetTestId(lab.kind, t.id)}
                  disabled={disabled}
                  aria-label={used && lab.kind !== 'sort' ? `${t.name} (placed)` : undefined}
                  onClick={() => act({ type: 'place', target: t.id })}
                  onMouseEnter={() => hoverTarget(t.id)}
                  onMouseLeave={() => hoverTarget(null)}
                  onFocus={() => hoverTarget(t.id)}
                  onBlur={() => hoverTarget(null)}
                  {...press(t.id, disabled)}
                >
                  <span className="target-name">
                    {used && lab.kind !== 'sort' ? <span aria-hidden="true">{'\u2714 '}</span> : null}
                    {t.name}
                  </span>
                  {t.sub ? <span className="target-sub">{t.sub}</span> : null}
                  {count > 0 ? (
                    <span key={count} className="bin-n mono" aria-hidden="true">
                      {count}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>
      </aside>

      <section className="dock" aria-label={order ? 'Step slots' : 'Card tray'}>
        <div className="panel brackets job-card">
          <div className="job-head">
            <span className="mono label amber" data-testid="lab-placed">
              PLACED {placedCount(st)} OF {total}
            </span>
            {order ? (
              <ol className="tray slots" aria-label="Slots">
                {cards.map((_, i) => {
                  const placed = stepInSlot(st, i + 1)
                  return (
                    <li key={i} className={`chip slot${placed ? ' done' : ''}${slot === i + 1 ? ' now' : ''}`} data-testid={`lab-slot-${i + 1}`}>
                      <span className="chip-n" aria-hidden="true">
                        {i + 1}
                      </span>
                      <span className="chip-name">{placed ? byId.get(placed)?.name : 'Empty'}</span>
                      {placed ? null : <span className="sr-only"> (empty)</span>}
                    </li>
                  )
                })}
              </ol>
            ) : (
              <div className="tray" role="group" aria-label="Cards">
                {st.cards.map((id, i) => {
                  const c = byId.get(id)
                  const placed = id in st.placed
                  return (
                    <button
                      key={id}
                      type="button"
                      className={`chip${id === st.current ? ' now' : ''}${placed ? ' done' : ''}`}
                      data-testid={cardTestId(lab.kind, id)}
                      aria-current={id === st.current ? 'true' : undefined}
                      disabled={placed}
                      onClick={() => act({ type: 'select', id })}
                      {...press(`card-${id}`, placed)}
                    >
                      {placed ? <span aria-hidden="true">{'\u2714 '}</span> : null}
                      <span className="chip-n" aria-hidden="true">
                        {i + 1}
                      </span>
                      <span className="chip-name">{c?.name}</span>
                      {placed ? <span className="sr-only"> (placed)</span> : null}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          <div className="job-row">
            {st.feedback ? (
              <Verdict key={st.tries} ok={st.feedback.ok} word={st.feedback.word} testId="lab-feedback">
                {st.feedback.text}
              </Verdict>
            ) : (
              <p className="job-text">{ASK[lab.kind]}</p>
            )}
            {done ? (
              <button type="button" className="btn primary" data-testid="lab-next" onClick={next} autoFocus {...press('next')}>
                Finish lab
              </button>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  )
}
