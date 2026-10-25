import { navigate } from '../lib/router'

export default function CaseScreen({ kind, id }: { kind: 'case' | 'cold'; id: string }) {
  const label = kind === 'case' ? `CASE ${id.toUpperCase()}` : `COLD CASE ${id.toUpperCase()}`
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
        <p>Briefing coming in S2.</p>
      </main>
    </div>
  )
}
