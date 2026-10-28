import { useState } from 'react'
import { navigate } from '../lib/router'
import { useGame } from '../state/store'
import FirstRunModal from '../ui/FirstRunModal'
import Presence from '../ui/Presence'
import ResumeModal from '../ui/ResumeModal'

export default function TitleScreen() {
  const profile = useGame((s) => s.profile)
  const createProfile = useGame((s) => s.createProfile)
  const [modal, setModal] = useState<'firstrun' | 'resume' | null>(null)

  function start() {
    if (profile) navigate('/hub')
    else setModal('firstrun')
  }

  return (
    <div className="screen title-screen" data-testid="title">
      <div className="topbar">
        <span className="label">FIELD UNIT // FLORIDA</span>
        <button type="button" className="btn small ghost" onClick={() => navigate('/settings')}>
          Settings
        </button>
      </div>

      <div className="title-bottom">
        <h1 className="sr-only">ANOMALY</h1>
        <p className="tagline">Science Response Unit</p>
        <div className="title-actions">
          <button type="button" className="btn primary big" data-testid="start-shift" onClick={start}>
            Start shift
          </button>
          <button type="button" className="link-btn" data-testid="resume-code" onClick={() => setModal('resume')}>
            Resume with code
          </button>
        </div>
        {profile ? (
          <p className="muted small-print" data-testid="title-agent">
            Signed in as {profile.codename}
          </p>
        ) : null}
      </div>

      <Presence show={modal === 'firstrun'}>
        <FirstRunModal
          onCancel={() => setModal(null)}
          onConfirm={(n, code) => {
            createProfile(n, code)
            setModal(null)
            navigate('/hub')
          }}
        />
      </Presence>
      <Presence show={modal === 'resume'}>
        <ResumeModal
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null)
            navigate('/hub')
          }}
        />
      </Presence>
    </div>
  )
}
