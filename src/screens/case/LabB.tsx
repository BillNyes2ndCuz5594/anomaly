import { useTapGuard } from '../../ui/useTapGuard'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { VITALS_LABS } from '../../content'
import { useFx, useSession } from '../../state/session'
import { PAIR_TINTS } from '../../three/scenes/case/pairTints'
import { useBlip } from '../../ui/useBlip'
import VitalsStable from '../../ui/VitalsStable'
import { CaseTop, PanelHead, ReadAloudButton, Verdict } from './ui'
import { usePressed } from './usePressed'
import { choiceArt } from './labToolArt'
import './briefing-labb.css'

/** "bark (plant covering)" to "bark": the 3D part id. */
const partKey = (s: string) => s.split(' (')[0].trim()

interface Say {
  ok: boolean
  word: string
  text: string
}

export default function LabB() {
  const admit = useTapGuard()
  const completed = useRef(new Set<string>())
  const lab = VITALS_LABS.structureMatch
  const next = useSession((s) => s.next)
  const [armed, setArmed] = useState<string | null>(null)
  const [matched, setMatched] = useState<string[]>([])
  const [say, setSay] = useState<Say | null>(null)
  const [phase, setPhase] = useState<'match' | 'contrast'>('match')
  const [ci, setCi] = useState(0)
  const [tried, setTried] = useState<number[]>([])
  const [cDone, setCDone] = useState(false)
  // L2: which button reacted and how, for 500 ms. A correct match also fires the arc in the 3D scene.
  const [react, fireReact] = useBlip<string>(500)
  const reactOf = (key: string) => (react && react.split(':')[1].split(',').includes(key) ? react.split(':')[0] : undefined)

  const pairs = lab.pairs
  const plantOrder = useMemo(() => [...pairs].reverse(), [pairs])
  const allMatched = matched.length === pairs.length

  const syncFx = useCallback(
    (arm: string | null, list: string[]) => {
      const fx = useFx.getState()
      const a = arm ? pairs.find((p) => p.id === arm) : null
      fx.setLit(a ? [`a:${partKey(a.animal)}`] : [])
      fx.setBridges(list.map((id) => {
        const p = pairs.find((x) => x.id === id)!
        return [`a:${partKey(p.animal)}`, `p:${partKey(p.plant)}`] as [string, string]
      }))
    },
    [pairs],
  )

  const pickAnimal = useCallback(
    (pairId: string) => {
      if (matched.includes(pairId) || completed.current.has(pairId) || phase !== 'match') return
      if (armed === pairId || !admit(`animal:${pairId}`, 100)) return
      setArmed(pairId)
      syncFx(pairId, matched)
      setSay({ ok: true, word: 'Selected', text: 'Now pick the plant part that does the same job.' })
    },
    [matched, phase, syncFx, armed, admit],
  )

  const pickPlant = useCallback(
    (pairId: string) => {
      if (matched.includes(pairId) || completed.current.has(pairId) || phase !== 'match') return
      if (armed && completed.current.has(armed)) return
      if (!admit(`plant:${armed}:${pairId}`, armed === pairId ? Infinity : 450)) return
      const plantId = `p:${partKey(pairs.find((p) => p.id === pairId)!.plant)}`
      if (!armed) {
        fireReact(`bad:p-${pairId}`)
        setSay({ ok: false, word: 'Pick an animal part first.', text: 'Then choose the plant part that does the same job.' })
        useFx.getState().flashPart(plantId, false)
        return
      }
      if (armed === pairId) {
        completed.current.add(pairId)
        const list = [...matched, pairId]
        setMatched(list)
        setArmed(null)
        syncFx(null, list)
        const p = pairs.find((x) => x.id === pairId)!
        useFx.getState().flashPart(plantId, true)
        fireReact(`ok:p-${pairId},a-${pairId}`)
        setSay({ ok: true, word: 'Match', text: p.why })
      } else {
        useFx.getState().flashPart(plantId, false)
        fireReact(`bad:p-${pairId},a-${armed}`)
        setSay({ ok: false, word: 'Not a match.', text: 'Think about what job each part does, then try another plant part!' })
      }
    },
    [armed, matched, pairs, phase, syncFx, fireReact, admit],
  )

  const handle3D = useCallback(
    (id: string) => {
      const [side, key] = [id.slice(0, 1), id.slice(2)]
      if (side === 'a') {
        const p = pairs.find((x) => partKey(x.animal) === key)
        if (p) pickAnimal(p.id)
      } else {
        const p = pairs.find((x) => partKey(x.plant) === key)
        if (p) pickPlant(p.id)
      }
    },
    [pairs, pickAnimal, pickPlant],
  )
  const ref = useRef(handle3D)
  useLayoutEffect(() => {
    ref.current = handle3D
  })
  useEffect(() => {
    const fx = useFx.getState()
    fx.setBridges([])
    fx.setLit([])
    fx.setPick((id) => ref.current(id))
    return () => {
      const f = useFx.getState()
      f.setPick(null)
      f.setHover(null)
      f.setBridges([])
      f.setLit([])
      document.body.style.cursor = ''
    }
  }, [])

  const card = lab.contrast[ci]
  useEffect(() => {
    if (phase !== 'contrast') return
    const fx = useFx.getState()
    fx.setLit(card.structure === 'root' ? ['p:root'] : card.structure === 'leaf' ? ['p:leaf'] : [])
  }, [phase, card])

  function answer(idx: number) {
    if (cDone || completed.current.has(`contrast:${ci}`) || !admit(`contrast:${ci}:${idx}`, card.choices[idx] === card.job ? Infinity : 450)) return
    if (card.choices[idx] === card.job) {
      completed.current.add(`contrast:${ci}`)
      setCDone(true)
      setSay({ ok: true, word: 'Correct', text: card.why })
    } else {
      setTried((t) => t.includes(idx) ? t : [...t, idx])
      setSay({ ok: false, word: 'Not quite.', text: 'Try another choice.' })
    }
  }

  const press = usePressed()

  function afterContrast() {
    if (ci === lab.contrast.length - 1) next()
    else {
      setCi(ci + 1)
      setTried([])
      setCDone(false)
      setSay(null)
    }
  }

  return (
    <div className="screen case-screen labb-screen" data-testid="lab-b">
      <CaseTop step="lab-b" />

      <aside className="panel brackets side-panel" aria-label="Structure match">
        <PanelHead code="FIELD LAB B" title="STRUCTURE MATCH" />
        <p className="intro strong">{lab.intro}</p>
        <ReadAloudButton text={lab.intro} testId="read-aloud-lab" />

        {phase === 'match' ? (
          <>
            <div className="match-cols" data-testid="match-list">
              <div>
                <h3 className="section-title">Deer</h3>
                <p className="match-role">Animal part</p>
                {pairs.map((p) => {
                  const done = matched.includes(p.id)
                  const tint = PAIR_TINTS[matched.indexOf(p.id) % PAIR_TINTS.length]
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={`match-btn${armed === p.id ? ' armed' : ''}${done ? ' matched' : ''}`}
                      data-testid={`match-${p.id}-animal`}
                      data-react={reactOf(`a-${p.id}`)}
                      aria-pressed={armed === p.id}
                      disabled={done}
                      style={done ? ({ borderColor: tint, '--pair': tint } as CSSProperties) : undefined}
                      {...press(`a-${p.id}`, done)}
                      onClick={() => pickAnimal(p.id)}
                      onMouseEnter={() => useFx.getState().setHover(`a:${partKey(p.animal)}`)}
                      onMouseLeave={() => useFx.getState().setHover(null)}
                    >
                      <span className="match-name">
                        {done ? <span aria-hidden="true">{'\u2714 '}</span> : null}
                        {cap(partKey(p.animal))}
                      </span>
                      {done ? <span className="match-note">{p.job}</span> : null}
                    </button>
                  )
                })}
              </div>
              <div>
                <h3 className="section-title">Live oak</h3>
                <p className="match-role">Plant part</p>
                {plantOrder.map((p) => {
                  const done = matched.includes(p.id)
                  const tint = PAIR_TINTS[matched.indexOf(p.id) % PAIR_TINTS.length]
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={`match-btn${done ? ' matched' : ''}`}
                      data-testid={`match-${p.id}-plant`}
                      data-react={reactOf(`p-${p.id}`)}
                      disabled={done}
                      style={done ? ({ borderColor: tint, '--pair': tint } as CSSProperties) : undefined}
                      {...press(`p-${p.id}`, done)}
                      onClick={() => pickPlant(p.id)}
                      onMouseEnter={() => useFx.getState().setHover(`p:${partKey(p.plant)}`)}
                      onMouseLeave={() => useFx.getState().setHover(null)}
                    >
                      <span className="match-name">
                        {done ? <span aria-hidden="true">{'\u2714 '}</span> : null}
                        {cap(p.plant)}
                        {choiceArt(p.id) ? (
                          <img
                            className="match-icon"
                            src={choiceArt(p.id)}
                            alt=""
                            aria-hidden="true"
                            width={48}
                            height={48}
                            draggable={false}
                            style={{ marginLeft: 8, verticalAlign: 'middle', flex: 'none' }}
                          />
                        ) : null}
                      </span>
                      {done ? <span className="match-note">{p.job}</span> : null}
                    </button>
                  )
                })}
              </div>
            </div>
            <p className="muted hint-line">Tap a glowing part on the hologram, or pick from the buttons below. Choose the animal part first, then find the matching plant part!</p>
          </>
        ) : (
          <div className="contrast" data-testid="contrast-card">
            {cDone && ci === lab.contrast.length - 1 ? <VitalsStable /> : null}
            <span className="mono label amber">
              CONTRAST CARD {ci + 1} OF {lab.contrast.length}
            </span>
            <p className="job-text">
              {card.owner === 'plant' ? `What job does a ${card.structure} do for a plant?` : `What job do ${card.structure} do for an animal?`}
            </p>
            <div className="choice-col">
              {card.choices.map((ch, k) => (
                <button
                  key={ch}
                  type="button"
                  className={`match-btn${tried.includes(k) ? ' tried' : ''}`}
                  data-testid={`contrast-${card.id}-${k}`}
                  disabled={cDone || tried.includes(k)}
                  {...press(`c-${card.id}-${k}`, cDone || tried.includes(k))}
                  onClick={() => answer(k)}
                >
                  {ch}
                </button>
              ))}
            </div>
            {say ? (
              <Verdict ok={say.ok} word={say.word} testId="lab-feedback">
                {say.text}
              </Verdict>
            ) : null}
            {cDone ? (
              <button type="button" className="btn primary" data-testid="lab-next" {...press('contrast-next')} onClick={afterContrast} autoFocus>
                {ci === lab.contrast.length - 1 ? 'Finish lab' : 'Next card'}
              </button>
            ) : null}
          </div>
        )}
      </aside>

      {phase === 'match' ? (
        <section className="dock" aria-label="Match status">
          <div className="panel brackets job-card">
            <div className="job-head">
              <span className="mono label amber">
                MATCHES {matched.length} OF {pairs.length}
              </span>
            </div>
            <div className="job-row">
            {say ? (
              <Verdict ok={say.ok} word={say.word} testId="lab-feedback">
                {say.text}
              </Verdict>
            ) : (
              <p className="job-text">Pair the parts that do the same job.</p>
            )}
            {allMatched ? (
              <button
                type="button"
                className="btn primary"
                data-testid="lab-next"
                {...press('match-next')}
                onClick={() => {
                  setPhase('contrast')
                  setSay(null)
                }}
                autoFocus
              >
                Next: contrast cards
              </button>
            ) : null}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  )
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
