import { useEffect, useRef, useState } from 'react'
import { caseById, content, loadPack } from '../content'
import { navigate } from '../lib/router'
import { validCaseId } from '../state/startChoice'
import { useGame } from '../state/store'
import { armCodenameDecode } from '../ui/decode'
import FirstRunModal from '../ui/FirstRunModal'
import Presence from '../ui/Presence'
import ResumeModal from '../ui/ResumeModal'
import { useMotionMode } from '../ui/useMotionMode'
import { playLabel, shortTopic, startDestination, type StartIntent } from './startFlow'
import './title-hub.css'

function usePressed() {
  const [pressed, setPressed] = useState(false)
  return {
    pressed,
    bind: {
      onPointerDown: () => setPressed(true),
      onPointerUp: () => setPressed(false),
      onPointerCancel: () => setPressed(false),
      onPointerLeave: () => setPressed(false),
    },
  }
}

export default function TitleScreen() {
  const profile = useGame((s) => s.profile)
  const createProfile = useGame((s) => s.createProfile)
  const lastCaseId = useGame((s) => s.lastCaseId)
  const [modal, setModal] = useState<'firstrun' | 'resume' | null>(null)
  const [intent, setIntent] = useState<StartIntent>('play')
  const quickPress = usePressed()
  const browsePress = usePressed()
  const resumePress = usePressed()

  const chosen = validCaseId(lastCaseId, content.cases.map((c) => c.id))
  const chosenCase = caseById(chosen) ?? content.cases[0]

  const mode = useMotionMode()
  const [charging, setCharging] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  async function go(targetIntent: StartIntent) {
    setCharging(false)
    if (profile) {
      if (targetIntent === 'play') {
        await loadPack(chosen)
        navigate(startDestination('play', chosen))
      } else {
        navigate('/hub')
      }
    } else {
      setIntent(targetIntent)
      setModal('firstrun')
    }
  }

  function start(targetIntent: StartIntent) {
    setIntent(targetIntent)
    if (mode === 'still') return go(targetIntent)
    if (charging) return
    setCharging(true)
    timer.current = window.setTimeout(() => go(targetIntent), 250)
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
        <p className="tagline">Solve science mysteries.</p>
        <div className="title-actions">
          <button
            type="button"
            className="btn primary big title-quick-play"
            data-testid="title-quick-play"
            data-pressed={quickPress.pressed ? 'yes' : 'no'}
            data-charging={charging && intent === 'play' ? 'yes' : 'no'}
            onClick={() => start('play')}
            {...quickPress.bind}
          >
            {playLabel(chosenCase)}
          </button>
          <button
            type="button"
            className="btn big title-browse"
            data-testid="start-shift"
            data-pressed={browsePress.pressed ? 'yes' : 'no'}
            data-charging={charging && intent === 'browse' ? 'yes' : 'no'}
            onClick={() => start('browse')}
            {...browsePress.bind}
          >
            Choose a unit
          </button>
          <button
            type="button"
            className="link-btn"
            data-testid="resume-code"
            data-pressed={resumePress.pressed ? 'yes' : 'no'}
            onClick={() => setModal('resume')}
            {...resumePress.bind}
          >
            Use a saved code
          </button>
        </div>
        {profile ? (
          <p className="muted small-print" data-testid="title-agent">
            Playing as {profile.codename}
          </p>
        ) : null}
      </div>

      <Presence show={modal === 'firstrun'}>
        <FirstRunModal
          playIntent={intent === 'play'}
          topic={shortTopic(chosenCase.unitLabel)}
          onCancel={() => setModal(null)}
          onConfirm={async (n, code) => {
            createProfile(n, code)
            armCodenameDecode()
            setModal(null)
            if (intent === 'play') {
              await loadPack(chosen)
              navigate(startDestination('play', chosen))
            } else {
              navigate('/hub')
            }
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
