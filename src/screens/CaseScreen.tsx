import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { content } from '../content/schema'
import { navigate } from '../lib/router'
import { stepsFor, useSession } from '../state/session'
import { carryDelta, carryForget } from '../ui/carry'
import { stepDirection } from '../ui/motionMode'
import { useMotionMode } from '../ui/useMotionMode'
import Briefing from './case/Briefing'
import Debrief from './case/Debrief'
import ItemPlayer from './case/ItemPlayer'
import LabA from './case/LabA'
import LabB from './case/LabB'
import LabC from './case/LabC'
import Results from './case/Results'

function Placeholder({ label, text }: { label: string; text: string }) {
  return (
    <div className="screen case-screen" data-testid="case-placeholder">
      <div className="topbar">
        <button type="button" className="btn small" onClick={() => navigate('/hub')}>
          Back to hub
        </button>
        <span className="mono label">{label}</span>
      </div>
      <main className="panel brackets center-panel">
        <h1 className="screen-title mono">{label}</h1>
        <p>{text}</p>
      </main>
    </div>
  )
}

const CARRY: readonly [string, number][] = [
  ['.stepbar li.now', 240],
  ['.side-panel', 48],
  ['.dock', 48],
]

function CaseFlow({ id, kind }: { id: string; kind: 'case' | 'cold' }) {
  const caseId = useSession((s) => s.caseId)
  const step = useSession((s) => s.step)
  const start = useSession((s) => s.start)
  const motion = useMotionMode()
  const hostRef = useRef<HTMLDivElement>(null)
  const [seen, setSeen] = useState(step)
  const [dir, setDir] = useState<'forward' | 'back'>('forward')
  if (step !== seen) {
    const steps = stepsFor(kind)
    setDir(stepDirection(steps.findIndex((s) => s.id === seen), steps.findIndex((s) => s.id === step)))
    setSeen(step)
  }
  useEffect(() => {
    start(id, kind)
    return () => useSession.setState({ caseId: null })
  }, [id, kind, start])
  useLayoutEffect(() => {
    const root = hostRef.current
    if (root) {
      for (const [sel, limit] of CARRY) {
        const el = root.querySelector(sel) as HTMLElement | null
        if (!el) {
          carryForget(sel)
          continue
        }
        const r = el.getBoundingClientRect()
        const d = carryDelta(sel, r, limit, motion === 'full')
        if (!d) continue
        el.animate(
          [{ transform: `translate(${d.x}px, ${d.y}px)` }, { transform: 'translate(0px, 0px)' }],
          { duration: 420, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
        )
      }
    }
  }, [step, motion, caseId])
  if (caseId !== id) return null
  return (
    <div className="step-host" data-dir={dir} key={step} ref={hostRef}>
      <StepScreen step={step} kind={kind} />
    </div>
  )
}

function StepScreen({ step, kind }: { step: ReturnType<typeof useSession.getState>['step']; kind: 'case' | 'cold' }) {
  switch (step) {
    case 'briefing':
      return kind === 'cold' ? <Briefing kind="cold" /> : <Briefing />
    case 'lab-a':
      return <LabA />
    case 'lab-b':
      return <LabB />
    case 'lab-c':
      return <LabC />
    case 'items':
      return <ItemPlayer />
    case 'debrief':
      return <Debrief />
    case 'results':
      return <Results />
  }
}

export default function CaseScreen({ kind, id }: { kind: 'case' | 'cold'; id: string }) {
  if (kind === 'cold') {
    if (id !== content.coldCase.id) return <Placeholder label={`COLD CASE ${id.toUpperCase()}`} text="No such case on file." />
    return <CaseFlow id={id} kind="cold" />
  }
  if (id !== content.case.id) return <Placeholder label={`CASE ${id.toUpperCase()}`} text="No such case on file." />
  return <CaseFlow id={id} kind="case" />
}
