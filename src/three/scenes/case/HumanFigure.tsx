import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import * as THREE from 'three/webgpu'
import { STILL } from '../../../lib/flags'
import { useFx } from '../../../state/session'
import { depthOnlyMaterial, humanShell, organMaterial, tintedHolo } from '../../materials/tinted'
import { humanModel, ORGAN_LIST, type OrganDef } from '../../models/human'
import { pointerHandlers, useTier } from './common'
import { SCAN_FACE_SHIFT, useBodyScan, useOrganGeo } from '../../models/labScans'

export interface HumanFigureProps {
  /** lab: interactive with hover and flashes. visual: static highlights for item art. */
  mode: 'lab' | 'visual' | 'briefing'
  highlight?: string[]
  spin?: boolean
  reduced?: boolean
  showMuscles?: boolean
  scale?: number
  /** Rendered inside the figure group, so it turns with the figure. */
  children?: ReactNode
}

const SKIN_TINT = '#3ee6ff'
/** Small head organs idle dimmer so the face silhouette reads; hover, highlight and flash keep full strength. */
const CALM_IDLE: Record<string, number> = { eyes: 0.5, ears: 0.55, nose: 0.7, tongue: 0.8, brain: 0.75 }

const organScreen: Record<string, [number, number]> = {}
const tmpP = new THREE.Vector3()

/** Publishes where an organ is on screen (CSS px) on the canvas as data-organs, so a touch test can tap the hologram itself. */
function publishOrgan(id: string, mesh: THREE.Mesh, state: { camera: THREE.Camera; gl: { domElement: HTMLCanvasElement | HTMLElement } }) {
  mesh.getWorldPosition(tmpP)
  tmpP.project(state.camera)
  const el = state.gl.domElement as HTMLElement
  const r = el.getBoundingClientRect()
  organScreen[id] = [Math.round(r.left + ((tmpP.x + 1) / 2) * r.width), Math.round(r.top + ((1 - tmpP.y) / 2) * r.height)]
  el.dataset.organs = JSON.stringify(organScreen)
}

function OrganMesh({ def, mode, highlighted, dimOthers, reduced, low, scanFace }: { def: OrganDef; mode: HumanFigureProps['mode']; highlighted: boolean; dimOthers: boolean; reduced: boolean; low: boolean; scanFace: boolean }) {
  const geo = useOrganGeo(def.id, def.geo, def.center, low, scanFace)
  const shift = scanFace ? SCAN_FACE_SHIFT[def.id] : undefined
  const at = useMemo<[number, number, number]>(() => (shift ? [def.center[0] + shift[0], def.center[1] + shift[1], def.center[2] + shift[2]] : [...def.center]), [def.center, shift])
  const ref = useRef<THREE.Mesh>(null)
  const mat = useMemo(() => organMaterial(def.tint), [def.tint])
  const base = useMemo(() => new THREE.Color(def.tint), [def.tint])
  const glow = useRef(0.45)
  const body = useRef(1)
  const flashN = useRef(0)
  const flashT = useRef(-10)
  const tick = useRef(0)
  useEffect(() => () => mat.dispose(), [mat])
  const hand = useMemo(() => {
    const st = useFx.getState()
    return mode === 'lab' ? pointerHandlers(st.setHover, () => useFx.getState().pick) : null
  }, [mode])

  useFrame((state, dt) => {
    const mesh = ref.current
    if (!mesh) return
    const now = state.clock.elapsedTime
    const wave = reduced ? 0 : Math.sin(now * 6.5)
    let g = 0.45
    let dim = 1
    let pulse = 1
    let shake = 0
    if (mode === 'lab') {
      const fx = useFx.getState()
      if (tick.current++ % 20 === 0) publishOrgan(def.id, mesh, state as never)
      if (fx.flash && fx.flash.id === def.id && fx.flash.n !== flashN.current) {
        flashN.current = fx.flash.n
        flashT.current = now
      }
      const age = now - flashT.current
      if (fx.hover === def.id) {
        g = 1.5 + wave * 0.45
        pulse = 1.06 + wave * 0.03
      }
      if (fx.lit.includes(def.id)) {
        g = Math.max(g, 1.2 + wave * 0.3)
        pulse = Math.max(pulse, 1.03 + wave * 0.02)
      }
      if (fx.flash && fx.flash.id === def.id && age < 1.3) {
        const k = 1 - age / 1.3
        if (fx.flash.ok) {
          g = Math.max(g, 1.6 + 2.4 * k)
          pulse = 1 + 0.16 * Math.sin(Math.min(age, 1.0) * Math.PI * 3) * k + 0.06
        } else if (age < 0.5) {
          shake = Math.sin(age * 60) * 0.045 * (1 - age / 0.5)
        }
      }
    } else if (mode === 'visual' && dimOthers) {
      if (highlighted) {
        g = 1.5 + Math.sin(now * 3) * 0.5 * (reduced ? 0 : 1)
        pulse = reduced ? 1 : 1 + Math.sin(now * 3) * 0.04
      } else {
        g = 0.05
        dim = 0.32
      }
    } else if (mode === 'briefing' && !reduced) {
      g = 0.5 + Math.sin(now * 1.6 + def.center[1] * 2) * 0.12
    }
    // The heart keeps a gentle idle beat.
    if (def.id === 'heart' && !reduced) pulse *= 1 + 0.03 * Math.pow(Math.sin(now * 5) * 0.5 + 0.5, 4)
    const calm = CALM_IDLE[def.id]
    if (calm !== undefined && g < 0.8) g *= calm
    const f = Math.min(1, dt * 10)
    glow.current += (g - glow.current) * f
    body.current += (dim - body.current) * f
    mat.color.copy(base).multiplyScalar(body.current)
    mat.emissive.copy(base).multiplyScalar(glow.current)
    mesh.scale.setScalar(pulse)
    mesh.position.x = at[0] + shake
  })

  return (
    <mesh ref={ref} geometry={geo} position={at} userData={{ part: def.id, prio: 1 }} {...(hand ?? {})}>
      <primitive object={mat} attach="material" />
    </mesh>
  )
}

/**
 * Hologram human with every organ as its own mesh. Facing +z, feet at y = 0, about 6.5 units tall.
 * Skin is one translucent merged shell. Pointer events are handled per part (see choosePart).
 */
export default function HumanFigure({ mode, highlight = [], spin = false, reduced = false, showMuscles = false, scale = 1, children }: HumanFigureProps) {
  const group = useRef<THREE.Group>(null)
  const low = useTier() === 'low'
  const model = useMemo(() => humanModel(low), [low])
  // Medium tier and up: the scanned body (warped to the sculpted proportions) replaces the sculpted shell and muscles.
  const bodyScan = useBodyScan(low)
  const skinGeo = bodyScan?.skin ?? model.skin
  const muscleGeo = bodyScan?.muscles ?? model.muscles
  const skinMat = useMemo(() => humanShell(SKIN_TINT, 0.9), [])
  const depthMat = useMemo(() => depthOnlyMaterial(), [])
  const muscleMat = useMemo(() => tintedHolo('#E69F00', 0.9, true, false), [])
  const skinBase = useMemo(() => new THREE.Color(SKIN_TINT), [])
  const muscleBase = useMemo(() => new THREE.Color('#E69F00'), [])
  const skinCur = useRef(1)
  const speed = useRef(1)
  const skinFlashN = useRef(0)
  const skinFlashT = useRef(-10)
  useEffect(
    () => () => {
      skinMat.dispose()
      muscleMat.dispose()
      depthMat.dispose()
    },
    [skinMat, muscleMat, depthMat],
  )
  const dimOthers = mode === 'visual' && highlight.length > 0
  const muscles = showMuscles || highlight.includes('muscles')
  const skinHand = useMemo(() => (mode === 'lab' ? pointerHandlers(useFx.getState().setHover, () => useFx.getState().pick) : null), [mode])

  useFrame((state, dt) => {
    const g = group.current
    if (g) {
      if (STILL) {
        g.rotation.y = 0.3
      } else if (mode === 'visual') {
        // Low tier keeps the body facing the viewer: a small sway instead of the wider turn.
        g.rotation.y = reduced ? 0 : Math.sin(state.clock.elapsedTime * 0.6) * (low ? 0.2 : 0.5)
      } else if (low && spin) {
        g.rotation.y = reduced ? 0 : Math.sin(state.clock.elapsedTime * 0.4) * 0.55
      } else if (spin && !reduced) {
        const hovering = mode === 'lab' && useFx.getState().hover !== null
        speed.current += ((hovering ? 0 : 1) - speed.current) * Math.min(1, dt * 6)
        g.rotation.y += dt * 0.32 * speed.current
      }
    }
    let target = 1
    let op = mode === 'visual' ? (highlight.length === 0 ? 0.9 : 0.6) : 0.9
    if (mode === 'visual' && highlight.includes('skin')) {
      target = 1.7 + (reduced ? 0 : Math.sin(state.clock.elapsedTime * 3) * 0.4)
      op = 1
    }
    if (mode === 'lab') {
      const fx = useFx.getState()
      if (fx.hover === 'skin' || fx.lit.includes('skin')) {
        target = 1.9
        op = 1
      }
      if (fx.flash?.id === 'skin') {
        if (fx.flash.n !== skinFlashN.current) {
          skinFlashN.current = fx.flash.n
          skinFlashT.current = state.clock.elapsedTime
        }
        const age = state.clock.elapsedTime - skinFlashT.current
        if (fx.flash.ok && age < 1.3) {
          target = Math.max(target, 1.6 + 2.4 * (1 - age / 1.3))
          op = 1
        }
      }
    }
    skinCur.current += (target - skinCur.current) * Math.min(1, dt * 10)
    skinMat.color.copy(skinBase).multiplyScalar(skinCur.current)
    skinMat.opacity = op
    muscleMat.color.copy(muscleBase).multiplyScalar(1.6 + (reduced ? 0 : Math.sin(state.clock.elapsedTime * 3) * 0.3))
  })

  return (
    <group ref={group} scale={scale}>
      <mesh geometry={skinGeo} renderOrder={1}>
        <primitive object={depthMat} attach="material" />
      </mesh>
      <mesh geometry={skinGeo} renderOrder={2} userData={{ part: 'skin', prio: 0 }} {...(skinHand ?? {})}>
        <primitive object={skinMat} attach="material" />
      </mesh>
      {muscles ? (
        <mesh geometry={muscleGeo}>
          <primitive object={muscleMat} attach="material" />
        </mesh>
      ) : null}
      {ORGAN_LIST.filter((o) => o.id !== 'skin').map((o) => {
        const def = model.organs.get(o.id)!
        return <OrganMesh key={o.id} def={def} mode={mode} highlighted={highlight.includes(o.id)} dimOthers={dimOthers} reduced={reduced} low={low} scanFace={!!bodyScan} />
      })}
      {children}
    </group>
  )
}
