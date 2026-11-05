import { useEffect, useRef, useState } from 'react'
import { caseById, content, loadPack } from '../content'
import { navigate } from '../lib/router'
import { validCaseId } from '../state/startChoice'
import { useGame } from '../state/store'
import { armCodenameDecode } from '../ui/decode'
import AgentSwitchModal from '../ui/AgentSwitchModal'
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
  const [modal, setModal] = useState<'firstrun' | 'resume' | 'switch-confirm' | null>(null)
  const [intent, setIntent] = useState<StartIntent>('play')
  const quickPress = usePressed()
  const browsePress = usePressed()
  const resumePress = usePressed()
  const newAgentRef = useRef<HTMLButtonElement>(null)

  const chosen = validCaseId(lastCaseId, content.cases.map((c) => c.id))
  const chosenCase = caseById(chosen) ?? content.cases[0]

  const mode = useMotionMode()
  const [charging, setCharging] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const busy = useRef(false)
  const navSeq = useRef(0)

  function cancelPendingNavigation() {
    window.clearTimeout(timer.current)
    setCharging(false)
    navSeq.current++
    busy.current = false
  }

  useEffect(() => () => {
    cancelPendingNavigation()
  }, [])

  function focusNewAgent() {
    newAgentRef.current?.focus()
    window.setTimeout(() => newAgentRef.current?.focus(), 0)
  }

  async function openCase() {
    if (busy.current) return
    const seq = ++navSeq.current
    const initialProfile = useGame.getState().profile
    busy.current = true
    try {
      await loadPack(chosen)
      if (seq !== navSeq.current) return
      const currentProfile = useGame.getState().profile
      if (
        currentProfile?.agentNumber !== initialProfile?.agentNumber ||
        currentProfile?.classCode !== initialProfile?.classCode
      ) {
        return
      }
      navigate(startDestination('play', chosen))
    } catch {
      if (seq !== navSeq.current) return
      navigate('/hub')
    } finally {
      if (seq === navSeq.current) {
        busy.current = false
      }
    }
  }

  async function go(targetIntent: StartIntent) {
    setCharging(false)
    if (profile) {
      if (targetIntent === 'play') {
        await openCase()
      } else {
        navigate('/hub')
      }
    } else {
      cancelPendingNavigation()
      setIntent(targetIntent)
      setModal('firstrun')
    }
  }

  function start(targetIntent: StartIntent) {
    if (mode === 'still') return go(targetIntent)
    if (charging) return
    setIntent(targetIntent)
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
            onClick={() => {
              cancelPendingNavigation()
              setModal('resume')
            }}
            {...resumePress.bind}
          >
            Use a saved code
          </button>
        </div>
        {profile ? (
          <p className="muted small-print" data-testid="title-agent">
            Playing as {profile.codename}{' '}
            <button
              type="button"
              ref={newAgentRef}
              className="link-btn"
              style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center' }}
              data-testid="new-agent"
              onClick={() => {
                cancelPendingNavigation()
                setModal('switch-confirm')
              }}
            >
              New agent
            </button>
          </p>
        ) : null}
      </div>

      <Presence show={modal === 'switch-confirm'}>
        <AgentSwitchModal
          onCancel={() => {
            cancelPendingNavigation()
            setModal(null)
          }}
          onConfirm={() => {
            cancelPendingNavigation()
            setIntent('browse')
            setModal('firstrun')
          }}
        />
      </Presence>
      <Presence show={modal === 'firstrun'}>
        <FirstRunModal
          playIntent={intent === 'play'}
          topic={shortTopic(chosenCase.unitLabel)}
          startEmpty={profile !== null}
          onCancel={() => {
            cancelPendingNavigation()
            setModal(null)
            focusNewAgent()
          }}
          onConfirm={async (n, code) => {
            createProfile(n, code)
            armCodenameDecode()
            setModal(null)
            if (intent === 'play') {
              await openCase()
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
