import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import { navigate, parseHash, useHash, type Route } from './lib/router'
import CaseScreen from './screens/CaseScreen'
import HubScreen, { HUB_PANEL_WIDTH } from './screens/HubScreen'
import { caseInset } from './screens/case/layout'
import SettingsScreen from './screens/SettingsScreen'
import TitleScreen from './screens/TitleScreen'

const VisualsScreen = lazy(() => import('./screens/VisualsScreen'))
import { useRuntime } from './state/runtime'
import { useSession } from './state/session'
import { useGame } from './state/store'
import { Announcer } from './ui/announce'
import FpsReadout from './ui/FpsReadout'
import { useApplySettings } from './ui/useApplySettings'

// The whole 3D layer (three, R3F, scenes) loads lazily so the first chunk stays small.
const Stage = lazy(() => import('./three/Stage'))
const TitleScene = lazy(() => import('./three/scenes/TitleScene'))
const HubScene = lazy(() => import('./three/scenes/HubScene'))
const AmbientScene = lazy(() => import('./three/scenes/AmbientScene'))
const CaseScene = lazy(() => import('./three/scenes/CaseScene'))

class StageBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: unknown) {
    console.warn('3D layer unavailable, continuing with the 2D interface.', error)
  }
  render() {
    return this.state.failed ? <div className="stage-fallback" aria-hidden="true" /> : this.props.children
  }
}

function SceneFor({ route }: { route: Route }) {
  switch (route.name) {
    case 'title':
      return <TitleScene />
    case 'hub':
      return <HubScene />
    case 'case':
      return <CaseScene />
    case 'cold':
      return <CaseScene cold />
    default:
      return <AmbientScene />
  }
}

function ScreenFor({ route }: { route: Route }) {
  switch (route.name) {
    case 'title':
      return <TitleScreen />
    case 'hub':
      return <HubScreen />
    case 'settings':
      return <SettingsScreen />
    case 'visuals':
      return (
        <Suspense fallback={null}>
          <VisualsScreen view={route.view} />
        </Suspense>
      )
    case 'case':
      return <CaseScreen kind="case" id={route.id} />
    case 'cold':
      return <CaseScreen kind="cold" id={route.id} />
  }
}

type Phase = 'idle' | 'cover' | 'reveal'
const COVER_MS = 200
const REVEAL_MS = 460

/**
 * Eased screen transition: the old screen is covered by a scan veil, the route swaps underneath it,
 * then the veil wipes away top to bottom. Reduced motion swaps instantly with no veil.
 */
function useTransitionedHash(reduced: boolean): { hash: string; phase: Phase } {
  const target = useHash()
  const [shown, setShown] = useState(target)
  const [phase, setPhase] = useState<Phase>('idle')
  const shownRef = useRef(shown)
  shownRef.current = shown

  useEffect(() => {
    if (target === shownRef.current) return
    if (reduced) {
      setShown(target)
      setPhase('idle')
      return
    }
    setPhase('cover')
    const t1 = window.setTimeout(() => {
      setShown(target)
      setPhase('reveal')
    }, COVER_MS)
    const t2 = window.setTimeout(() => setPhase('idle'), COVER_MS + REVEAL_MS)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [target, reduced])

  return { hash: shown, phase }
}

export default function App() {
  useApplySettings()
  const reducedMotion = useGame((s) => s.settings.reducedMotion)
  const { hash, phase } = useTransitionedHash(reducedMotion)
  const route = parseHash(hash)
  const profile = useGame((s) => s.profile)
  const ready = useRuntime((s) => s.backend !== 'none')
  const step = useSession((s) => s.step)

  // Routes past the title need an agent. Send new visitors to check in first.
  const needsProfile = (route.name === 'hub' || route.name === 'case' || route.name === 'cold') && !profile
  useEffect(() => {
    if (needsProfile) navigate('/')
  }, [needsProfile])
  if (needsProfile) return null

  return (
    <div className="app" data-route={route.name}>
      <div className={ready ? 'stage-layer ready' : 'stage-layer'}>
        <StageBoundary>
          <Suspense fallback={null}>
            <Stage rightInset={route.name === 'hub' ? HUB_PANEL_WIDTH : route.name === 'case' || route.name === 'cold' ? caseInset(step) : 0}>
              <Suspense fallback={null}>
                <SceneFor key={route.name} route={route} />
              </Suspense>
            </Stage>
          </Suspense>
        </StageBoundary>
      </div>
      <div className="hud-layer">
        <div className="screen-host" key={route.name}>
          <ScreenFor route={route} />
        </div>
      </div>
      <div className="veil" data-phase={phase} aria-hidden="true">
        <div className="veil-fill" />
        <div className="veil-line" />
      </div>
      <FpsReadout />
      <Announcer />
    </div>
  )
}
