import { Component, lazy, Suspense, useEffect, type ReactNode } from 'react'
import { navigate, parseHash, useHash, type Route } from './lib/router'
import CaseScreen from './screens/CaseScreen'
import HubScreen, { HUB_PANEL_WIDTH } from './screens/HubScreen'
import SettingsScreen from './screens/SettingsScreen'
import TitleScreen from './screens/TitleScreen'
import { useRuntime } from './state/runtime'
import { useGame } from './state/store'
import FpsReadout from './ui/FpsReadout'
import { useApplySettings } from './ui/useApplySettings'

// The whole 3D layer (three, R3F, scenes) loads lazily so the first chunk stays small.
const Stage = lazy(() => import('./three/Stage'))
const TitleScene = lazy(() => import('./three/scenes/TitleScene'))
const HubScene = lazy(() => import('./three/scenes/HubScene'))
const AmbientScene = lazy(() => import('./three/scenes/AmbientScene'))

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
    case 'case':
      return <CaseScreen kind="case" id={route.id} />
    case 'cold':
      return <CaseScreen kind="cold" id={route.id} />
  }
}

export default function App() {
  useApplySettings()
  const hash = useHash()
  const route = parseHash(hash)
  const profile = useGame((s) => s.profile)
  const ready = useRuntime((s) => s.backend !== 'none')

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
            <Stage rightInset={route.name === 'hub' ? HUB_PANEL_WIDTH : 0}>
              <Suspense fallback={null}>
                <SceneFor key={route.name} route={route} />
              </Suspense>
            </Stage>
          </Suspense>
        </StageBoundary>
      </div>
      <div className="hud-layer">
        <ScreenFor route={route} />
      </div>
      <FpsReadout />
    </div>
  )
}
