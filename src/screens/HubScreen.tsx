import { useState } from 'react'
import { navigate } from '../lib/router'
import { HUB_BENCHMARKS, MASTERY_LABEL, MASTERY_STAGES, rankFor, useGame, type MasteryStage } from '../state/store'
import { useRuntime } from '../state/runtime'
import NoticeModal from '../ui/NoticeModal'

export const HUB_PANEL_WIDTH = 360

/** Four pips (Rookie to Ace). Filled square plus the stage word, never color alone. */
function Pips({ stage }: { stage: MasteryStage }) {
  const level = MASTERY_STAGES.indexOf(stage)
  return (
    <span className="pips" aria-hidden="true">
      {[1, 2, 3, 4].map((i) => (
        <span key={i} className={i <= level ? 'pip on' : 'pip'} />
      ))}
    </span>
  )
}

export default function HubScreen() {
  const profile = useGame((s) => s.profile)
  const mastery = useGame((s) => s.mastery)
  const setFocused = useRuntime((s) => s.setFocusedMarker)
  const [notice, setNotice] = useState<string | null>(null)
  if (!profile) return null

  return (
    <div className="screen hub-screen" data-testid="hub">
      <div className="topbar">
        <button type="button" className="btn small" onClick={() => navigate('/')}>
          Title
        </button>
        <span className="mono label">AGENT HUB</span>
      </div>

      <aside className="panel brackets hub-panel" aria-label="Agent panel" style={{ width: HUB_PANEL_WIDTH }}>
        <header className="agent-head">
          <span className="mono label">Field agent</span>
          <h2 className="mono codename" data-testid="codename">
            {profile.codename}
          </h2>
          <p className="muted">
            Rank: <strong data-testid="rank">{rankFor(mastery)}</strong>
            {profile.classCode ? <span className="mono"> | Class {profile.classCode}</span> : null}
          </p>
        </header>

        <section aria-labelledby="dispatch-h">
          <h3 id="dispatch-h" className="section-title mono">
            Dispatch
          </h3>
          <div className="case-list">
            <button
              type="button"
              className="case-btn amber"
              data-testid="case-marker-03-1"
              onClick={() => navigate('/case/03-1')}
              onFocus={() => setFocused('case')}
              onBlur={() => setFocused(null)}
              onMouseEnter={() => setFocused('case')}
              onMouseLeave={() => setFocused(null)}
            >
              <span className="mono case-code">CASE 03-1 VITALS</span>
              <span className="case-sub">Unit 3: Living Things</span>
            </button>
            <button
              type="button"
              className="case-btn cyan"
              data-testid="cold-marker"
              onClick={() => navigate('/cold/residue')}
              onFocus={() => setFocused('cold')}
              onBlur={() => setFocused(null)}
              onMouseEnter={() => setFocused('cold')}
              onMouseLeave={() => setFocused(null)}
            >
              <span className="mono case-code">COLD CASE RESIDUE</span>
              <span className="case-sub">Review of earlier units</span>
            </button>
          </div>
        </section>

        <section aria-labelledby="mastery-h" className="mastery">
          <h3 id="mastery-h" className="section-title mono">
            Benchmark mastery
          </h3>
          <ul className="mastery-list" data-testid="mastery-list">
            {HUB_BENCHMARKS.map((b) => {
              const stage = mastery[b.id] ?? 'unseen'
              return (
                <li key={b.id}>
                  <span className="mono bench-id">{b.id}</span>
                  <span className="bench-label">{b.label}</span>
                  <span className="bench-stage">
                    <Pips stage={stage} />
                    <span className="mono">{MASTERY_LABEL[stage]}</span>
                  </span>
                </li>
              )
            })}
          </ul>
        </section>

        <footer className="panel-actions">
          <button type="button" className="btn" data-testid="open-settings" onClick={() => navigate('/settings')}>
            Settings
          </button>
          <button
            type="button"
            className="btn"
            data-testid="report-code"
            onClick={() => setNotice('Report codes arrive in a later update. Nothing to copy yet.')}
          >
            Report Code
          </button>
        </footer>
      </aside>

      {notice ? <NoticeModal title="Report Code" text={notice} onClose={() => setNotice(null)} /> : null}
    </div>
  )
}
