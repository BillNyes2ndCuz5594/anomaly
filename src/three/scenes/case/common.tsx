import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react'
import * as THREE from 'three/webgpu'
import type { ThreeEvent } from '@react-three/fiber'
import { resolveTier } from '../../../state/quality'
import { useRuntime } from '../../../state/runtime'
import { useGame } from '../../../state/store'
import { Backdrop, ConsoleRing, DeckLights, DeckPlate, Dust, GridFloor } from '../common'
import { tintedHolo } from '../../materials/tinted'
import { useFitPose, usePublishFit, type FitView } from '../../FitCamera'

export function useTier() {
  const quality = useGame((s) => s.settings.quality)
  const autoTier = useRuntime((s) => s.autoTier)
  return resolveTier(quality, autoTier)
}

export function useReduced() {
  return useGame((s) => s.settings.reducedMotion)
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

/** Eases the camera from an offset start to its resting pose, then adds a light pointer parallax. */
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
  const t0 = useRef(performance.now())
  const target = useMemo(() => new THREE.Vector3(), [])
  useFrame((state, dt) => {
    const t = (performance.now() - t0.current) / 1000
    const k = reduced ? 1 : easeOutCubic(Math.min(1, t / 1.6))
    const px = reduced ? 0 : state.pointer.x * parallax * k
    const py = reduced ? 0 : state.pointer.y * parallax * 0.5 * k
    target.set(pos[0] + from[0] * (1 - k) + px, pos[1] + from[1] * (1 - k) + py, pos[2] + from[2] * (1 - k))
    const follow = reduced ? 1 : 1 - Math.exp(-dt * 8)
    state.camera.position.lerp(target, follow)
    state.camera.lookAt(look[0], look[1], look[2])
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

/** Shared lab environment: deck, grid, console ring, fog, dust. */
export function LabEnvironment({ children, ring = true, floorY = 0 }: { children?: ReactNode; ring?: boolean; floorY?: number }) {
  const tier = useTier()
  return (
    <>
      <fogExp2 attach="fog" args={['#070c17', 0.017]} />
      <DeckLights rim={0.7} />
      <Backdrop />
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
