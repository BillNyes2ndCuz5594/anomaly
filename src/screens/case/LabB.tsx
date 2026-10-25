import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { content } from '../../content/schema'
import { useFx, useSession } from '../../state/session'
import { PAIR_TINTS } from '../../three/scenes/case/pairTints'
import { CaseTop, PanelHead, ReadAloudButton, Verdict } from './ui'

/** "bark (plant covering)" to "bark": the 3D part id. */
const partKey = (s: string) => s.split(' (')[0].trim()

interface Say {
  ok: boolean
  word: string
  text: string
}

export default function LabB() {
  const lab = content.case.labs.structureMatch
  const next = useSession((s) => s.next)
  const [armed, setArmed] = useState<string | null>(null)
  const [matched, setMatched] = useState<string[]>([])
  const [say, setSay] = useState<Say | null>(null)
  const [phase, setPhase] = useState<'match' | 'contrast'>('match')
  const [ci, setCi] = useState(0)
  const [tried, setTried] = useState<number[]>([])
  const [cDone, setCDone] = useState(false)

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
      if (matched.includes(pairId) || phase !== 'match') return
      setArmed(pairId)
      syncFx(pairId, matched)
      setSay({ ok: true, word: 'Selected', text: 'Now pick the plant part that does the same job.' })
    },
    [matched, phase, syncFx],
  )

  const pickPlant = useCallback(
    (pairId: string) => {
      if (matched.includes(pairId) || phase !== 'match') return
      const plantId = `p:${partKey(pairs.find((p) => p.id === pairId)!.plant)}`
      if (!armed) {
        setSay({ ok: false, word: 'Pick an animal part first.', text: 'Then choose the plant part that does the same job.' })
        useFx.getState().flashPart(plantId, false)
        return
      }
      if (armed === pairId) {
        const list = [...matched, pairId]
        setMatched(list)
        setArmed(null)
        syncFx(null, list)
        const p = pairs.find((x) => x.id === pairId)!
        useFx.getState().flashPart(plantId, true)
        setSay({ ok: true, word: 'Match', text: p.why })
      } else {
        useFx.getState().flashPart(plantId, false)
        setSay({ ok: false, word: 'Not a match.', text: 'Think about the job each part does, then try another plant part.' })
      }
    },
    [armed, matched, pairs, phase, syncFx],
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
  ref.current = handle3D
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
    if (cDone) return
    if (card.choices[idx] === card.job) {
      setCDone(true)
      setSay({ ok: true, word: 'Correct', text: card.why })
    } else {
      setTried((t) => [...t, idx])
      setSay({ ok: false, word: 'Not quite.', text: 'Try another choice.' })
    }
  }

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
    <div className="screen case-screen" data-testid="lab-b">
      <CaseTop step="lab-b" />

      <aside className="panel brackets side-panel" aria-label="Structure match">
        <PanelHead code="FIELD LAB B" title="STRUCTURE MATCH" />
        <p className="intro strong">{lab.intro}</p>
        <ReadAloudButton text={lab.intro} testId="read-aloud-lab" />

        {phase === 'match' ? (
          <>
            <div className="match-cols" data-testid="match-list">
              <div>
                <h3 className="section-title mono">Animal part</h3>
                {pairs.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`match-btn${armed === p.id ? ' armed' : ''}${matched.includes(p.id) ? ' matched' : ''}`}
                    data-testid={`match-${p.id}-animal`}
                    aria-pressed={armed === p.id}
                    disabled={matched.includes(p.id)}
                    style={matched.includes(p.id) ? { borderColor: PAIR_TINTS[matched.indexOf(p.id) % PAIR_TINTS.length] } : undefined}
                    onClick={() => pickAnimal(p.id)}
                    onMouseEnter={() => useFx.getState().setHover(`a:${partKey(p.animal)}`)}
                    onMouseLeave={() => useFx.getState().setHover(null)}
                  >
                    {matched.includes(p.id) ? <span aria-hidden="true">{'\u2714 '}</span> : null}
                    {cap(partKey(p.animal))}
                  </button>
                ))}
              </div>
              <div>
                <h3 className="section-title mono">Plant part</h3>
                {plantOrder.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`match-btn${matched.includes(p.id) ? ' matched' : ''}`}
                    data-testid={`match-${p.id}-plant`}
                    disabled={matched.includes(p.id)}
                    style={matched.includes(p.id) ? { borderColor: PAIR_TINTS[matched.indexOf(p.id) % PAIR_TINTS.length] } : undefined}
                    onClick={() => pickPlant(p.id)}
                    onMouseEnter={() => useFx.getState().setHover(`p:${partKey(p.plant)}`)}
                    onMouseLeave={() => useFx.getState().setHover(null)}
                  >
                    {matched.includes(p.id) ? <span aria-hidden="true">{'\u2714 '}</span> : null}
                    {cap(p.plant)}
                  </button>
                ))}
              </div>
            </div>
            <p className="muted tiny">Click a part on the hologram or use these buttons. Animal first, then plant.</p>
          </>
        ) : (
          <div className="contrast" data-testid="contrast-card">
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
              <button type="button" className="btn primary" data-testid="lab-next" onClick={afterContrast} autoFocus>
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
