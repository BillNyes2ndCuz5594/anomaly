import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
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
  isAutoActive,
  isPostTier,
} from '../state/quality'
import type * as THREE from 'three/webgpu'
import { useRuntime } from '../state/runtime'
import { useGame } from '../state/store'
import PostFX from './PostFX'
import { createRenderer } from './renderer'
import { InsetsContext, NO_INSETS, type Insets } from './insets'
import { hudInsets } from '../screens/case/layout'

declare global {
  interface Window {
    __anomaly?: { fps: number; tier: Tier; backend: Backend; frame: number; calls: number; triangles: number; geometries: number; textures: number }
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
  const gl = useThree((s) => s.gl) as unknown as THREE.WebGPURenderer
  // Draw stats of the last finished frame, including post passes. Info resets once per frame here.
  const stats = useRef({ calls: 0, triangles: 0 })
  const frame = useRef(0)

  useEffect(() => {
    gl.info.autoReset = false
    return () => {
      gl.info.autoReset = true
    }
  }, [gl])

  useFrame(() => {
    stats.current = { calls: gl.info.render.drawCalls, triangles: gl.info.render.triangles }
    gl.info.reset()
  }, -100)

  useFrame(() => {
    frame.current++
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
      window.__anomaly = {
        fps: rounded,
        tier,
        backend,
        frame: frame.current,
        calls: stats.current.calls,
        triangles: stats.current.triangles,
        geometries: gl.info.memory.geometries,
        textures: gl.info.memory.textures,
      }

      if (!isAutoActive(quality) || document.hidden || now < graceUntil.current || fps === 0) return
      const next = stepAuto({ ...auto.current, tier: useRuntime.getState().autoTier }, fps, SAMPLE_MS)
      auto.current = next
      if (next.tier !== useRuntime.getState().autoTier) setAutoTier(next.tier)
    }, SAMPLE_MS)
    return () => window.clearInterval(id)
  }, [gl])

  return null
}

/** Applies the camera view offset so the scene centers in the area not covered by HUD panels (side panel, bottom sheet, dock, top bar). */
function ViewOffset({ insets }: { insets: Insets }) {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  useEffect(() => {
    const cam = camera as import('three').PerspectiveCamera
    const x = insets.right / 2
    const y = (insets.bottom - insets.top) / 2
    if (x !== 0 || y !== 0) cam.setViewOffset(size.width, size.height, x, y, size.width, size.height)
    else cam.clearViewOffset()
    cam.updateProjectionMatrix()
    return () => {
      cam.clearViewOffset()
      cam.updateProjectionMatrix()
    }
  }, [camera, size.width, size.height, insets.right, insets.top, insets.bottom])
  return null
}

/**
 * Reads how much of the screen the HUD covers: the right side panel, the top step bar and the bottom job dock.
 * Measured from the DOM so it follows the text size setting and any layout change. Polled, since panels mount per step.
 */
function useHudInsets(fallbackRight: number, vertical: boolean): Insets {
  const [ins, setIns] = useState<Insets>({ right: fallbackRight, top: 0, bottom: 0 })
  useEffect(() => {
    const read = () => {
      const W = window.innerWidth
      const H = window.innerHeight
      const rectOf = (sel: string) => (document.querySelector(sel) as HTMLElement | null)?.getBoundingClientRect() ?? null
      const { right, top, bottom } = hudInsets(
        W,
        H,
        { panel: rectOf('.hud-layer .side-panel, .hud-layer .hub-panel'), dock: vertical ? rectOf('.hud-layer .dock') : null, bar: vertical ? rectOf('.hud-layer .topbar') : null },
        vertical,
        fallbackRight,
      )
      setIns((p) => (Math.abs(p.right - right) > 3 || Math.abs(p.top - top) > 3 || Math.abs(p.bottom - bottom) > 3 ? { right, top, bottom } : p))
    }
    read()
    const id = window.setInterval(read, 200)
    window.addEventListener('resize', read)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('resize', read)
    }
  }, [fallbackRight, vertical])
  return fallbackRight === 0 && !vertical ? NO_INSETS : ins
}

export interface StageProps {
  children: ReactNode
  /** Pixels reserved on the right for HUD panels when none is found in the DOM yet. */
  rightInset?: number
  /** Also measure the top bar and bottom dock (case steps), so models fit between them. */
  verticalInsets?: boolean
}

/** Persistent R3F canvas running on WebGPURenderer (WebGL2 fallback). */
export default function Stage({ children, rightInset = 0, verticalInsets = false }: StageProps) {
  const insets = useHudInsets(rightInset, verticalInsets)
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
        if (isAutoActive(useGame.getState().settings.quality)) rt.setAutoTier(autoStartTier(backend))
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
      <ViewOffset insets={insets} />
      {isPostTier(tier) ? <PostFX tier={tier} /> : null}
      <InsetsContext.Provider value={insets}>{children}</InsetsContext.Provider>
    </Canvas>
  )
}
