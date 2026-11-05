import { Component, lazy, Suspense, useEffect, useLayoutEffect, type ReactNode } from 'react'
import { STILL } from './lib/flags'
import { isUnknownHash, navigate, parseHash, routeNeedsProfile, type Route } from './lib/router'
import { HUB_PANEL_WIDTH } from './screens/hubLayout'
const loadHub = () => import('./screens/HubScreen')
const HubScreen = lazy(loadHub)
import { caseInset } from './screens/case/layout'
import TitleScreen from './screens/TitleScreen'
import { caseById } from './content'
import { caseIdFromRoute } from './state/startChoice'

const CaseScreen = lazy(() => import('./screens/CaseScreen'))
const SettingsScreen = lazy(() => import('./screens/SettingsScreen'))
const GoldRushScreen = lazy(() => import('./modes/gold/GoldRushScreen'))
const ContainmentScreen = lazy(() => import('./modes/containment/ContainmentScreen'))
const ReactorScreen = lazy(() => import('./modes/reactor/ReactorScreen'))
const VisualsScreen = lazy(() => import('./screens/VisualsScreen'))
import { resolveTier } from './state/quality'
import { useRuntime } from './state/runtime'
import { isChunkLoadError, noteGpuLoss, reloadForNewDeploy, setRuntimeForceWebGL } from './three/recovery'
import { useSession } from './state/session'
import { useGame } from './state/store'
import { Announcer } from './ui/announce'
import CasePreview from './ui/CasePreview'
import CodexNew from './ui/CodexNew'
import FpsReadout from './ui/FpsReadout'
import { countUpElement } from './ui/countUp'
import { useApplySettings } from './ui/useApplySettings'
import { useRouteTransition, useStepHandoff } from './ui/useRouteTransition'
import WarpStreak, { WarpPreload } from './ui/WarpStreak'

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
      return <Suspense fallback={null}><HubScreen /></Suspense>
    case 'settings':
      return (
        <Suspense fallback={null}>
          <SettingsScreen />
        </Suspense>
      )
    case 'gold':
      return <Suspense fallback={null}><GoldRushScreen key={route.id} caseId={route.id} /></Suspense>
    case 'containment':
      return <Suspense fallback={null}><ContainmentScreen key={route.id} caseId={route.id} /></Suspense>
    case 'reactor':
      return <Suspense fallback={null}><ReactorScreen key={route.id} caseId={route.id} /></Suspense>
    case 'visuals':
      return (
        <Suspense fallback={null}>
          <VisualsScreen view={route.view} />
        </Suspense>
      )
    case 'case':
      return (
        <Suspense fallback={null}>
          <CaseScreen kind="case" id={route.id} />
        </Suspense>
      )
    case 'cold':
      return (
        <Suspense fallback={null}>
          <CaseScreen kind="cold" id={route.id} />
        </Suspense>
      )
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

let hubBooted = false

export default function App() {
  useApplySettings()
  useEffect(() => {
    // Two frames let the title paint before idle prefetch begins.
    let idle = 0
    let timer = 0
    let second = 0
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        const prefetch = () => { void loadHub().catch(() => {}) }
        if (typeof window.requestIdleCallback === 'function') idle = window.requestIdleCallback(prefetch)
        else timer = window.setTimeout(prefetch, 200)
      })
    })
    return () => {
      cancelAnimationFrame(first)
      cancelAnimationFrame(second)
      if (idle) window.cancelIdleCallback(idle)
      window.clearTimeout(timer)
    }
  }, [])
  const reducedMotion = useGame((s) => s.settings.reducedMotion)
  const quality = useGame((s) => s.settings.quality)
  const autoTier = useRuntime((s) => s.autoTier)
  const tier = resolveTier(quality, autoTier)
  const { hash, phase, kind, dir, mode } = useRouteTransition(reducedMotion, tier)
  const route = parseHash(hash)
  const hubReady = useRuntime((s) => s.hubReady)
  useEffect(() => {
    if (hubReady) hubBooted = true
  }, [hubReady])
  useEffect(() => {
    if (route.name === 'hub') {
      if (hubBooted) {
        if (!useRuntime.getState().hubReady) useRuntime.getState().setHubReady(true)
        return
      }
      const timer = window.setTimeout(() => {
        hubBooted = true
        useRuntime.getState().setHubReady(true)
      }, 2500)
      return () => window.clearTimeout(timer)
    }
  }, [route.name, hubReady])
  const hubWaiting = route.name === 'hub' && !hubReady && mode !== 'still' && !hubBooted
  const profile = useGame((s) => s.profile)
  useEffect(() => {
    const id = caseIdFromRoute(route)
    if (id && caseById(id) && profile) {
      useGame.getState().setLastCaseId(id)
    }
  }, [hash, profile])
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
    host.inert = hubWaiting || phase === 'cover'
    return () => {
      host.inert = false
    }
  }, [phase, hash, hubWaiting])

  // Routes past the title need an agent. Send new visitors to check in first.
  const needsProfile = routeNeedsProfile(route.name, Boolean(profile))
  useEffect(() => {
    if (needsProfile) navigate('/')
  }, [needsProfile])
  // A typo or stale link sends a checked-in agent back to the hub instead of the title screen.
  const unknown = isUnknownHash(hash)
  useEffect(() => {
    if (unknown) window.location.replace(profile ? '#/hub' : '#/')
  }, [unknown, profile])
  if (needsProfile) return null

  return (
    <div className="app" data-route={route.name}>
      <div className={ready && !hubWaiting ? 'stage-layer ready' : 'stage-layer'}>
        <StageBoundary>
          <Suspense fallback={null}>
            <Stage prefetch={route.name !== 'title' && (route.name !== 'hub' || (hubReady && phase === 'idle'))} verticalInsets={route.name === 'case' || route.name === 'cold'} rightInset={route.name === 'hub' ? HUB_PANEL_WIDTH : route.name === 'case' || route.name === 'cold' ? caseInset(step) : 0}>
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
        <div className="handoff-band" />
        <div className="handoff-sweep" />
        <div className="handoff-sweep delay" />
        <div className="handoff-edge" />
      </div>
      <div className="veil" data-phase={hubWaiting ? 'cover' : phase} data-kind={kind} data-dir={dir} aria-hidden="true">
        <div className="veil-stack">
          {mode === 'full' ? <WarpPreload /> : null}
          <div className="veil-fill">{mode === 'full' && phase !== 'idle' && (kind === 'launch' || kind === 'warp') ? <WarpStreak /> : null}</div>
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
      {route.name === 'hub' ? <CasePreview /> : null}
      {route.name === 'hub' ? <CodexNew /> : null}
      <FpsReadout />
      <Announcer />
    </div>
  )
}
