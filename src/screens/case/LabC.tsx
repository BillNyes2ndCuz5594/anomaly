import { useEffect, useState } from 'react'
import { content } from '../../content/schema'
import { useFx, useSession } from '../../state/session'
import { useGame } from '../../state/store'
import './labs-ac.css'
import { usePressed } from './pressable'
import { CaseTop, PanelHead, ReadAloudButton, Verdict } from './ui'

const GROUPS = ['mammal', 'bird', 'reptile', 'amphibian', 'fish', 'arthropod'] as const
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

interface Progress {
  backbone: boolean
  group: boolean
}

export default function LabC() {
  const lab = content.case.labs.specimenSort
  const specimens = lab.specimens
  const next = useSession((s) => s.next)
  const unlock = useGame((s) => s.unlockCodex)
  const [idx, setIdx] = useState(0)
  const [prog, setProg] = useState<Record<string, Progress>>({})
  const [say, setSay] = useState<{ ok: boolean; word: string; text: string } | null>(null)
  const sp = specimens[idx]
  const p = prog[sp.id] ?? { backbone: false, group: false }
  const doneCount = specimens.filter((s) => prog[s.id]?.group).length
  const allDone = doneCount === specimens.length
  const press = usePressed()

  useEffect(() => {
    useFx.getState().setSpecimen(sp.id)
  }, [sp.id])
  useEffect(
    () => () => {
      useFx.getState().setSpecimen(null)
    },
    [],
  )

  function choose(id: string) {
    setIdx(specimens.findIndex((s) => s.id === id))
    setSay(null)
  }

  function sortBackbone(yes: boolean) {
    if (p.backbone) return
    if (yes === sp.backbone) {
      setProg({ ...prog, [sp.id]: { ...p, backbone: true } })
      setSay({ ok: true, word: 'Correct', text: sp.backbone ? 'This one has a backbone.' : 'This one has no backbone.' })
    } else {
      setSay({ ok: false, word: 'Not quite.', text: 'Read the card again, then try the other bin.' })
    }
  }

  function sortGroup(g: string) {
    if (!p.backbone || p.group) return
    if (g === sp.group) {
      setProg({ ...prog, [sp.id]: { ...p, group: true } })
      unlock([`specimen:${sp.id}`])
      setSay({ ok: true, word: 'Correct', text: `${sp.name} goes in the ${sp.group} group.` })
    } else {
      setSay({ ok: false, word: 'Not quite.', text: 'Check the card for body covering and how the young are born.' })
    }
  }

  function advance() {
    if (allDone) return next()
    const nextIdx = specimens.findIndex((s, i) => i > idx && !prog[s.id]?.group)
    const any = nextIdx >= 0 ? nextIdx : specimens.findIndex((s) => !prog[s.id]?.group)
    setIdx(any)
    setSay(null)
  }

  return (
    <div className="screen case-screen" data-testid="lab-c">
      <CaseTop step="lab-c" />

      <aside className="panel brackets side-panel" aria-label="Specimen sort">
        <PanelHead code="FIELD LAB C" title="SPECIMEN SORT" />
        <p className="intro strong">{lab.intro}</p>
        <ReadAloudButton text={lab.intro} testId="read-aloud-lab" />

        <div className="spec-card" data-testid="specimen-card">
          <span className="mono label amber">SPECIMEN FILE</span>
          <h3 className="spec-name" data-testid="specimen-name">
            {sp.name}
          </h3>
          <ul>
            {sp.card.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>

        <div className="sort-step">
          <h3 className="section-title mono">1. Backbone?</h3>
          <div className="row">
            <button type="button" className={`btn${p.backbone && sp.backbone ? ' on' : ''}`} data-testid="sort-backbone-yes" disabled={p.backbone} onClick={() => sortBackbone(true)} {...press('back-yes', p.backbone)}>
              Backbone
            </button>
            <button type="button" className={`btn${p.backbone && !sp.backbone ? ' on' : ''}`} data-testid="sort-backbone-no" disabled={p.backbone} onClick={() => sortBackbone(false)} {...press('back-no', p.backbone)}>
              No backbone
            </button>
          </div>
        </div>
        <div className="sort-step" aria-disabled={!p.backbone}>
          <h3 className="section-title mono">2. Group</h3>
          <div className="group-grid">
            {GROUPS.map((g) => (
              <button
                key={g}
                type="button"
                className={`btn${p.group && sp.group === g ? ' on' : ''}`}
                data-testid={`sort-group-${g}`}
                disabled={!p.backbone || p.group}
                onClick={() => sortGroup(g)}
                {...press(g, !p.backbone || p.group)}
              >
                {cap(g)}
              </button>
            ))}
          </div>
        </div>
      </aside>

      <section className="dock" aria-label="Specimen tray">
        <div className="panel brackets job-card">
          <div className="job-head">
            <span className="mono label amber">
              SORTED {doneCount} OF {specimens.length}
            </span>
            <div className="tray" role="group" aria-label="Specimens">
              {specimens.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  className={`chip${i === idx ? ' now' : ''}${prog[s.id]?.group ? ' done' : ''}`}
                  data-testid={`specimen-chip-${s.id}`}
                  aria-current={i === idx ? 'true' : undefined}
                  onClick={() => choose(s.id)}
                  {...press(s.id)}
                >
                  {prog[s.id]?.group ? <span aria-hidden="true">{'\u2714 '}</span> : null}
                  <span className="chip-n" aria-hidden="true">
                    {i + 1}
                  </span>
                  <span className="chip-name">{s.name}</span>
                  {prog[s.id]?.group ? <span className="sr-only"> (sorted)</span> : null}
                </button>
              ))}
            </div>
          </div>
          <div className="job-row">
          {say ? (
            <Verdict ok={say.ok} word={say.word} testId="lab-feedback">
              {say.text}
            </Verdict>
          ) : (
            <p className="job-text">{!p.backbone ? 'Does this specimen have a backbone?' : 'Which group does it belong to?'}</p>
          )}
          {p.group ? (
            <button type="button" className="btn primary" data-testid="lab-next" onClick={advance} autoFocus {...press('next')}>
              {allDone ? 'Finish lab' : 'Next specimen'}
            </button>
          ) : null}
          </div>
        </div>
      </section>
    </div>
  )
}
