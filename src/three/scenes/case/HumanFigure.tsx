import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import * as THREE from 'three/webgpu'
import { useFx } from '../../../state/session'
import { depthOnlyMaterial, tintedHolo } from '../../materials/tinted'
import { humanModel, ORGAN_LIST, type OrganDef } from '../../models/human'
import { pointerHandlers } from './common'

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

function OrganMesh({ def, mode, highlighted, dimOthers, reduced }: { def: OrganDef; mode: HumanFigureProps['mode']; highlighted: boolean; dimOthers: boolean; reduced: boolean }) {
  const ref = useRef<THREE.Mesh>(null)
  const mat = useMemo(() => tintedHolo(def.tint, 0.6, true, false), [def.tint])
  const base = useMemo(() => new THREE.Color(def.tint), [def.tint])
  const cur = useRef(1)
  const flashN = useRef(0)
  const flashT = useRef(-10)
  useEffect(() => () => mat.dispose(), [mat])
  const hand = useMemo(() => {
    const st = useFx.getState()
    return mode === 'lab' ? pointerHandlers(st.setHover, () => useFx.getState().pick) : null
  }, [mode])

  useFrame((state, dt) => {
    const mesh = ref.current
    if (!mesh) return
    const now = state.clock.elapsedTime
    let target = 1
    let opacity = 0.62
    let pulse = 1
    let shake = 0
    if (mode === 'lab') {
      const fx = useFx.getState()
      if (fx.flash && fx.flash.id === def.id && fx.flash.n !== flashN.current) {
        flashN.current = fx.flash.n
        flashT.current = now
      }
      const age = now - flashT.current
      if (fx.hover === def.id) {
        target = 2.1
        opacity = 0.95
        pulse = 1.05
      }
      if (fx.lit.includes(def.id)) {
        target = Math.max(target, 1.6)
        opacity = Math.max(opacity, 0.85)
      }
      if (fx.flash && fx.flash.id === def.id && age < 1.3) {
        const k = 1 - age / 1.3
        if (fx.flash.ok) {
          target = Math.max(target, 1.6 + 2.6 * k)
          opacity = 1
          pulse = 1 + 0.16 * Math.sin(Math.min(age, 1.0) * Math.PI * 3) * k + 0.06
        } else if (age < 0.5) {
          shake = Math.sin(age * 60) * 0.045 * (1 - age / 0.5)
        }
      }
    } else if (dimOthers) {
      if (highlighted) {
        target = 2.2 + (reduced ? 0 : Math.sin(now * 3) * 0.35)
        opacity = 1
        pulse = reduced ? 1 : 1 + Math.sin(now * 3) * 0.035
      } else {
        target = 0.45
        opacity = 0.2
      }
    } else {
      target = 1
      opacity = 0.62
    }
    cur.current += (target - cur.current) * Math.min(1, dt * 10)
    mat.color.copy(base).multiplyScalar(cur.current)
    mat.opacity = opacity
    mesh.scale.setScalar(pulse)
    mesh.position.x = def.center[0] + shake
  })

  return (
    <mesh
      ref={ref}
      geometry={def.geo}
      position={def.center}
      userData={{ part: def.id, prio: 1 }}
      {...(hand ?? {})}
    >
      <primitive object={mat} attach="material" />
    </mesh>
  )
}

/**
 * Chunky hologram human with every organ as its own mesh. Facing +z, feet at y = 0, about 5 units tall.
 * Skin is one translucent merged shell. Pointer events are handled per part (see choosePart).
 */
export default function HumanFigure({ mode, highlight = [], spin = false, reduced = false, showMuscles = false, scale = 1, children }: HumanFigureProps) {
  const group = useRef<THREE.Group>(null)
  const model = useMemo(() => humanModel(), [])
  const skinMat = useMemo(() => tintedHolo(SKIN_TINT, 0.5, false), [])
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
  const dimOthers = mode === 'visual'
  const muscles = showMuscles || highlight.includes('muscles')
  const skinHand = useMemo(() => (mode === 'lab' ? pointerHandlers(useFx.getState().setHover, () => useFx.getState().pick) : null), [mode])

  useFrame((state, dt) => {
    const g = group.current
    if (g) {
      if (mode === 'visual') {
        g.rotation.y = reduced ? 0 : Math.sin(state.clock.elapsedTime * 0.6) * 0.5
      } else if (spin && !reduced) {
        const hovering = mode === 'lab' && useFx.getState().hover !== null
        speed.current += ((hovering ? 0 : 1) - speed.current) * Math.min(1, dt * 6)
        g.rotation.y += dt * 0.32 * speed.current
      }
    }
    let target = mode === 'visual' ? (highlight.length === 0 ? 0.9 : 0.4) : 0.8
    let op = mode === 'visual' ? (highlight.length === 0 ? 0.55 : 0.22) : 0.42
    if (mode === 'lab') {
      const fx = useFx.getState()
      if (fx.hover === 'skin' || fx.lit.includes('skin')) {
        target = 2
        op = 0.8
      }
      if (fx.flash?.id === 'skin') {
        if (fx.flash.n !== skinFlashN.current) {
          skinFlashN.current = fx.flash.n
          skinFlashT.current = state.clock.elapsedTime
        }
        const age = state.clock.elapsedTime - skinFlashT.current
        if (fx.flash.ok && age < 1.3) {
          target = Math.max(target, 1.6 + 2.6 * (1 - age / 1.3))
          op = 0.85
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
      <mesh geometry={model.skin}>
        <primitive object={depthMat} attach="material" />
      </mesh>
      <mesh geometry={model.skin} userData={{ part: 'skin', prio: 0 }} {...(skinHand ?? {})}>
        <primitive object={skinMat} attach="material" />
      </mesh>
      {muscles ? (
        <mesh geometry={model.muscles}>
          <primitive object={muscleMat} attach="material" />
        </mesh>
      ) : null}
      {ORGAN_LIST.filter((o) => o.id !== 'skin').map((o) => {
        const def = model.organs.get(o.id)!
        return <OrganMesh key={o.id} def={def} mode={mode} highlighted={highlight.includes(o.id)} dimOthers={dimOthers} reduced={reduced} />
      })}
      {children}
    </group>
  )
}
