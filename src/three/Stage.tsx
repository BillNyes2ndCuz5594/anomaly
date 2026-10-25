import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react'
import {
  autoStartTier,
  dprForTier,
  initialAutoState,
  resolveTier,
  rollingFps,
  stepAuto,
  type AutoState,
  type Backend,
  type Tier,
  isPostTier,
} from '../state/quality'
import { useRuntime } from '../state/runtime'
import { useGame } from '../state/store'
import PostFX from './PostFX'
import { createRenderer } from './renderer'

declare global {
  interface Window {
    __anomaly?: { fps: number; tier: Tier; backend: Backend }
  }
}

const SAMPLE_MS = 500
/** Ignore FPS for this long after mount or a tier change (shader compiles, window refill). */
const GRACE_MS = 2500

/** Measures fps, runs the Auto tier controller, exposes window.__anomaly. Renders nothing. */
function Runtime() {
  const stamps = useRef<number[]>([])
  const auto = useRef<AutoState>(initialAutoState(useRuntime.getState().autoTier))
  const graceUntil = useRef(performance.now() + GRACE_MS)
  const lastTier = useRef<Tier | null>(null)

  useFrame(() => {
    const arr = stamps.current
    arr.push(performance.now())
    if (arr.length > 600) arr.splice(0, arr.length - 600)
  })

  useEffect(() => {
    const id = window.setInterval(() => {
      const now = performance.now()
      const { backend, setFps, setAutoTier } = useRuntime.getState()
      const quality = useGame.getState().settings.quality
      const tier = resolveTier(quality, useRuntime.getState().autoTier)
      if (lastTier.current !== null && lastTier.current !== tier) {
        stamps.current.length = 0
        graceUntil.current = now + GRACE_MS
      }
      lastTier.current = tier

      const fps = rollingFps(stamps.current, now)
      const rounded = Math.round(fps * 10) / 10
      setFps(rounded)
      window.__anomaly = { fps: rounded, tier, backend }

      if (quality !== 'auto' || document.hidden || now < graceUntil.current || fps === 0) return
      const next = stepAuto({ ...auto.current, tier: useRuntime.getState().autoTier }, fps, SAMPLE_MS)
      auto.current = next
      if (next.tier !== useRuntime.getState().autoTier) setAutoTier(next.tier)
    }, SAMPLE_MS)
    return () => window.clearInterval(id)
  }, [])

  return null
}

/** Applies the camera view offset so the scene centers in the area left of a side panel. */
function ViewOffset({ rightInset }: { rightInset: number }) {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  useEffect(() => {
    const cam = camera as import('three').PerspectiveCamera
    const inset = size.width > 900 ? rightInset : 0
    if (inset > 0) cam.setViewOffset(size.width, size.height, inset / 2, 0, size.width, size.height)
    else cam.clearViewOffset()
    cam.updateProjectionMatrix()
    return () => {
      cam.clearViewOffset()
      cam.updateProjectionMatrix()
    }
  }, [camera, size.width, size.height, rightInset])
  return null
}

export interface StageProps {
  children: ReactNode
  /** Pixels reserved on the right for HUD panels. The scene is shifted to stay centered in the rest. */
  rightInset?: number
}

/** Persistent R3F canvas running on WebGPURenderer (WebGL2 fallback). */
export default function Stage({ children, rightInset = 0 }: StageProps) {
  const quality = useGame((s) => s.settings.quality)
  const autoTier = useRuntime((s) => s.autoTier)
  const tier = resolveTier(quality, autoTier)
  const dpr = dprForTier(tier, window.devicePixelRatio)

  const initialTier = useRef<Tier>(resolveTier(quality, autoTier))
  const gl = useCallback(
    (props: Record<string, unknown>) =>
      createRenderer(props, initialTier.current, (backend) => {
        const rt = useRuntime.getState()
        rt.setBackend(backend)
        if (useGame.getState().settings.quality === 'auto') rt.setAutoTier(autoStartTier(backend))
      }),
    [],
  )

  const camera = useMemo(() => ({ fov: 40, near: 0.1, far: 200, position: [0, 3, 12] as [number, number, number] }), [])

  return (
    <Canvas
      gl={gl as never}
      dpr={dpr}
      camera={camera}
      frameloop="always"
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0 }}
    >
      <color attach="background" args={['#070c17']} />
      <Runtime />
      <ViewOffset rightInset={rightInset} />
      {isPostTier(tier) ? <PostFX tier={tier} /> : null}
      {children}
    </Canvas>
  )
}
