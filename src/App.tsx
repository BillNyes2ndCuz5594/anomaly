import { Component, lazy, Suspense, useEffect, useLayoutEffect, type ReactNode } from 'react'
import { STILL } from './lib/flags'
import { navigate, parseHash, type Route } from './lib/router'
import CaseScreen from './screens/CaseScreen'
import HubScreen, { HUB_PANEL_WIDTH } from './screens/HubScreen'
import { caseInset } from './screens/case/layout'
import SettingsScreen from './screens/SettingsScreen'
import TitleScreen from './screens/TitleScreen'

const VisualsScreen = lazy(() => import('./screens/VisualsScreen'))
import { resolveTier } from './state/quality'
import { useRuntime } from './state/runtime'
import { isChunkLoadError, noteGpuLoss, reloadForNewDeploy, setRuntimeForceWebGL } from './three/recovery'
import { useSession } from './state/session'
import { useGame } from './state/store'
import { Announcer } from './ui/announce'
import FpsReadout from './ui/FpsReadout'
import { countUpElement } from './ui/countUp'
import { useApplySettings } from './ui/useApplySettings'
import { useRouteTransition, useStepHandoff } from './ui/useRouteTransition'

// The whole 3D layer (three, R3F, scenes) loads lazily so the first chunk stays small.
const Stage = lazy(() => import('./three/Stage'))
const TitleScene = lazy(() => import('./three/scenes/TitleScene'))
const HubScene = lazy(() => import('./three/scenes/HubScene'))
const AmbientScene = lazy(() => import('./three/scenes/AmbientScene'))
const CaseScene = lazy(() => import('./three/scenes/CaseScene'))

/**
 * Catches a crash in the 3D layer. A lazy chunk from an older deploy reloads the page once. Anything else gets
 * one retry on three's WebGL2 backend (a fresh canvas) before the game settles for the 2D interface.
 */
class StageBoundary extends Component<{ children: ReactNode }, { failed: boolean; tries: number }> {
  state = { failed: false, tries: 0 }
  private timer = 0
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: unknown) {
    if (isChunkLoadError(error) && reloadForNewDeploy()) return
    if (this.state.tries < 1) {
      console.warn('3D layer crashed, retrying on WebGL2.', error)
      setRuntimeForceWebGL()
      noteGpuLoss('WebGL')
      this.timer = window.setTimeout(() => this.setState((s) => ({ failed: false, tries: s.tries + 1 })), 300)
      return
    }
    console.warn('3D layer unavailable, continuing with the 2D interface.', error)
  }
  componentWillUnmount() {
    window.clearTimeout(this.timer)
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

/** The debrief score counts up when the stamp lands. The final text stays available to readers and tests. */
function useResultCountUps(routeName: string, step: string, reduced: boolean) {
  useLayoutEffect(() => {
    if (reduced || STILL || routeName !== 'case') return
    const el = document.querySelector<HTMLElement>('[data-testid="debrief-score"]')
    return el ? countUpElement(el) : undefined
  }, [routeName, step, reduced])
}

export default function App() {
  useApplySettings()
  const reducedMotion = useGame((s) => s.settings.reducedMotion)
  const quality = useGame((s) => s.settings.quality)
  const autoTier = useRuntime((s) => s.autoTier)
  const tier = resolveTier(quality, autoTier)
  const { hash, phase, kind, dir, mode } = useRouteTransition(reducedMotion, tier)
  const route = parseHash(hash)
  const profile = useGame((s) => s.profile)
  const ready = useRuntime((s) => s.backend !== 'none')
  const step = useSession((s) => s.step)
  const caseKind = useSession((s) => s.kind)
  const hand = useStepHandoff(step, caseKind, route.name, phase, mode)
  useResultCountUps(route.name, step, reducedMotion || STILL)
  useLayoutEffect(() => {
    const root = document.documentElement
    root.dataset.motion = mode
    root.dataset.tier = tier
  }, [mode, tier])
  // Hold the outgoing screen only while the veil is covering it. Reveal stays clickable.
  useLayoutEffect(() => {
    const host = document.querySelector('.screen-host') as HTMLElement | null
    if (!host) return
    host.inert = phase === 'cover'
    return () => {
      host.inert = false
    }
  }, [phase, hash])

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
            <Stage verticalInsets={route.name === 'case' || route.name === 'cold'} rightInset={route.name === 'hub' ? HUB_PANEL_WIDTH : route.name === 'case' || route.name === 'cold' ? caseInset(step) : 0}>
              <Suspense fallback={null}>
                <SceneFor key={route.name} route={route} />
              </Suspense>
            </Stage>
          </Suspense>
        </StageBoundary>
      </div>
      <div className="hud-layer">
        <div className="screen-host" key={route.name} data-arrive={phase === 'reveal' && (kind === 'launch' || kind === 'warp') ? kind : undefined}>
          <ScreenFor route={route} />
        </div>
      </div>
      <div className="handoff" data-phase={hand.phase} data-dir={hand.dir} data-kind={hand.kind} aria-hidden="true">
        <div className="handoff-grid" />
        <div className="handoff-sweep" />
        <div className="handoff-sweep delay" />
        <div className="handoff-edge" />
      </div>
      <div className="veil" data-phase={phase} data-kind={kind} data-dir={dir} aria-hidden="true">
        <div className="veil-stack">
          <div className="veil-fill" />
          <div className="veil-glow" />
          <div className="veil-grid" />
          <div className="veil-scanlines" />
          <div className="veil-noise" />
          <div className="veil-sweep" />
          <div className="veil-sweep b" />
          <div className="veil-edge" />
          <div className="veil-bits" aria-hidden="true">
            {Array.from({ length: 8 }, (_, i) => (
              <i key={i} />
            ))}
          </div>
          <div className="veil-mark">
            <span>ANOMALY</span>
            <small>Science Response Unit</small>
          </div>
          <div className="veil-line" />
        </div>
      </div>
      <FpsReadout />
      <Announcer />
    </div>
  )
}
