import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react'
import * as THREE from 'three/webgpu'
import type { ThreeEvent } from '@react-three/fiber'
import { resolveTier } from '../../../state/quality'
import { useRuntime } from '../../../state/runtime'
import { useGame } from '../../../state/store'
import { useSession } from '../../../state/session'
import type { LoopClip } from '../LoopSky'
import { Backdrop, ConsoleRing, DeckLights, DeckPlate, Dust, GridFloor } from '../common'
import { tintedHolo } from '../../materials/tinted'
import { STILL } from '../../../lib/flags'
import { useFitPose, usePublishFit, type FitView } from '../../FitCamera'
import { flyStart, noteCamera, peekCamera, vlen, vsub, type V3 } from '../../flyPose'
import { widthFit } from '../../fit'

const BASE_FOV = 40

/**
 * Keeps `halfWidth` world units either side of the view axis (at `distance`) visible on tall narrow canvases:
 * widens the field of view up to `maxFovDeg`, then reports how much further back the camera has to go.
 * Restores the default fov on unmount, since the canvas and camera outlive scenes.
 */
export function useWidthFit(halfWidth: number, distance: number, maxFovDeg = 70, margin = 0.08): { current: number } {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const width = useThree((s) => s.size.width)
  const height = useThree((s) => s.size.height)
  const scale = useRef(1)
  useLayoutEffect(() => {
    const r = widthFit(halfWidth, distance, width / Math.max(1, height), BASE_FOV, maxFovDeg, margin)
    scale.current = r.distanceScale
    camera.fov = r.fovDeg
    camera.updateProjectionMatrix()
    return () => {
      camera.fov = BASE_FOV
      camera.updateProjectionMatrix()
    }
  }, [camera, width, height, halfWidth, distance, maxFovDeg, margin])
  return scale
}

export function useTier() {
  const quality = useGame((s) => s.settings.quality)
  const autoTier = useRuntime((s) => s.autoTier)
  return resolveTier(quality, autoTier)
}

export function useReduced() {
  return useGame((s) => s.settings.reducedMotion)
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)
/** Full tier dolly. Low tier is a shorter push along the fit ray. */
const FLY_MS = 0.64
const LOW_FLY_MS = 0.28

/**
 * Eases the camera from a safe start (never closer than the fit) onto its resting pose,
 * then adds a light pointer parallax. Step changes leave from the previous settled pose
 * when that pose still faces the new subject. Reduced motion, ?still=1, and the moment
 * the fly ends all sit on the exact fit. Low tier skips the orbit and only pushes back.
 */
export function CameraRig({
  pos,
  look,
  from = [3, 2.5, 5],
  parallax = 0.35,
}: {
  pos: [number, number, number]
  look: [number, number, number]
  from?: [number, number, number]
  parallax?: number
}) {
  const reduced = useReduced()
  const tier = useTier()
  const snap = reduced || STILL
  const t0 = useRef(performance.now())
  const start = useRef<V3 | null>(null)
  const rest = useRef<V3>(pos)
  const target = useMemo(() => new THREE.Vector3(), [])
  useFrame((state, dt) => {
    const next: V3 = [pos[0], pos[1], pos[2]]
    const lookAt: V3 = [look[0], look[1], look[2]]
    const dur = tier === 'low' ? LOW_FLY_MS : FLY_MS
    const elapsed = (performance.now() - t0.current) / 1000
    let k = snap ? 1 : easeOutCubic(Math.min(1, elapsed / dur))
    if (!start.current) {
      const push = snap ? 0 : tier === 'low' ? 0.06 : 0.16
      const hint: V3 = tier === 'low' || snap ? [0, 0, 0] : from
      start.current = flyStart(next, lookAt, tier === 'low' || snap ? null : peekCamera(), hint, push)
      rest.current = next
    } else if (!snap && k > 0.99 && vlen(vsub(next, rest.current)) > 0.35) {
      // A new subject (another specimen, a refit) gets a short dolly instead of a cut.
      t0.current = performance.now()
      k = 0
      start.current = flyStart(next, lookAt, rest.current, [0, 0, 0], tier === 'low' ? 0.05 : 0.1)
      rest.current = next
    }
    const s = start.current
    const px = snap ? 0 : state.pointer.x * parallax * k
    const py = snap ? 0 : state.pointer.y * parallax * 0.5 * k
    target.set(s[0] + (next[0] - s[0]) * k + px, s[1] + (next[1] - s[1]) * k + py, s[2] + (next[2] - s[2]) * k)
    const follow = snap ? 1 : 1 - Math.exp(-dt * (tier === 'low' ? 16 : 9))
    state.camera.position.lerp(target, follow)
    state.camera.lookAt(lookAt[0], lookAt[1], lookAt[2])
    if (snap || k > 0.995) noteCamera([state.camera.position.x, state.camera.position.y, state.camera.position.z])
  })
  return null
}

/** CameraRig whose pose comes from fitting a bounding box into the part of the screen the HUD leaves free. */
export function FitRig({
  view,
  from,
  parallax,
  measure,
}: {
  view: FitView
  from?: [number, number, number]
  parallax?: number
  measure?: RefObject<THREE.Object3D | null>
}) {
  const pose = useFitPose(view)
  usePublishFit(pose, measure, view.box)
  return <CameraRig pos={pose.position} look={pose.target} from={from} parallax={parallax} />
}

/** Ambient sky loop for each case step. */
const STEP_CLIP: Partial<Record<string, LoopClip>> = { briefing: 'swamp', 'lab-a': 'cells', 'lab-b': 'canopy', 'lab-c': 'water' }

/** Shared lab environment: deck, grid, console ring, fog, dust. */
export function LabEnvironment({ children, ring = true, floorY = 0 }: { children?: ReactNode; ring?: boolean; floorY?: number }) {
  const tier = useTier()
  const step = useSession((s) => s.step)
  const kind = useSession((s) => s.kind)
  const clip = kind === 'cold' ? undefined : STEP_CLIP[step]
  return (
    <>
      <fogExp2 attach="fog" args={['#070c17', 0.017]} />
      <DeckLights rim={0.7} />
      <Backdrop clip={clip} />
      <DeckPlate y={floorY - 0.02} />
      <GridFloor y={floorY} fade={34} intensity={0.55} />
      {ring ? (
        <group position={[0, floorY, 0]}>
          <ConsoleRing radius={17} count={16} arc={Math.PI * 1.1} />
        </group>
      ) : null}
      <Dust tier={tier} spread={[24, 8, 24]} baseY={0.2} />
      {children}
    </>
  )
}

/** Glowing hologram projector ring under a model. */
export function Pedestal({ radius = 1.8, y = 0.02, tint = '#3ee6ff' }: { radius?: number; y?: number; tint?: string }) {
  const { mat, discMat } = useMemo(() => {
    const m = tintedHolo(tint, 0.9)
    const d = new THREE.MeshBasicNodeMaterial()
    d.color.set(tint)
    d.opacity = 0.07
    d.transparent = true
    d.blending = THREE.AdditiveBlending
    d.depthWrite = false
    d.side = THREE.DoubleSide
    return { mat: m, discMat: d }
  }, [tint])
  useEffect(
    () => () => {
      mat.dispose()
      discMat.dispose()
    },
    [mat, discMat],
  )
  return (
    <group position={[0, y, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius * 0.94, radius, 64]} />
        <primitive object={mat} attach="material" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[radius * 0.94, 48]} />
        <primitive object={discMat} attach="material" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[radius * 0.55, radius * 0.57, 48]} />
        <primitive object={mat} attach="material" />
      </mesh>
    </group>
  )
}

export interface Pickable {
  part: string
  prio: number
}

/**
 * Picks the intended part from every object under the pointer. Higher priority wins (organs beat the
 * translucent skin that covers them), then the nearest. Returns null when nothing pickable was hit.
 */
export function choosePart(e: ThreeEvent<PointerEvent> | ThreeEvent<MouseEvent>): string | null {
  let best: { part: string; prio: number; d: number } | null = null
  for (const hit of e.intersections) {
    const u = hit.object.userData as Partial<Pickable>
    if (!u.part) continue
    const prio = u.prio ?? 0
    if (!best || prio > best.prio || (prio === best.prio && hit.distance < best.d)) {
      best = { part: u.part, prio, d: hit.distance }
    }
  }
  return best?.part ?? null
}

/** Pointer handlers shared by the interactive models. Hover goes to the fx store, click to the active lab. */
export function pointerHandlers(
  setHover: (id: string | null) => void,
  pick: () => ((id: string) => void) | null,
  allowed?: (id: string) => boolean,
) {
  const ok = (id: string | null): id is string => !!id && (!allowed || allowed(id))
  return {
    onPointerMove: (e: ThreeEvent<PointerEvent>) => {
      const id = choosePart(e)
      e.stopPropagation()
      setHover(ok(id) ? id : null)
      document.body.style.cursor = ok(id) ? 'pointer' : ''
    },
    onPointerOut: () => {
      setHover(null)
      document.body.style.cursor = ''
    },
    onClick: (e: ThreeEvent<MouseEvent>) => {
      const id = choosePart(e)
      e.stopPropagation()
      if (ok(id)) pick()?.(id)
    },
  }
}
