import { useEffect } from 'react'
import { content } from '../content/schema'
import { navigate } from '../lib/router'
import { useSession } from '../state/session'
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

function CaseFlow({ id }: { id: string }) {
  const caseId = useSession((s) => s.caseId)
  const step = useSession((s) => s.step)
  const start = useSession((s) => s.start)
  useEffect(() => {
    start(id)
    return () => useSession.setState({ caseId: null })
  }, [id, start])
  if (caseId !== id) return null
  switch (step) {
    case 'briefing':
      return <Briefing />
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
  if (kind === 'cold') return <Placeholder label={`COLD CASE ${id.toUpperCase()}`} text="Cold case missions arrive in a later update." />
  if (id !== content.case.id) return <Placeholder label={`CASE ${id.toUpperCase()}`} text="No such case on file." />
  return <CaseFlow id={id} />
}
