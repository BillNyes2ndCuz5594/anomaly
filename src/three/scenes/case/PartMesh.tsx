import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three/webgpu'
import { useFx } from '../../../state/session'
import { depthOnlyMaterial, tintedHolo } from '../../materials/tinted'
import type { PartGeo } from '../../models/creatures'
import { OAK_SCALE } from '../../models/creatures'
import { useLabBGeo } from '../../models/labScans'
import { pointerHandlers, useTier } from './common'

import { PAIR_TINTS } from './pairTints'
const pairColors = PAIR_TINTS.map((t) => new THREE.Color(t))
const AMBER = new THREE.Color('#ffb547')
const CYAN = new THREE.Color('#56B4E9')

/** shell: outer covering drawn with a depth pass. inner: structure inside a shell, drawn through it. */
const KIND: Record<string, 'shell' | 'inner'> = { skin: 'shell', bark: 'shell', skeleton: 'inner', stem: 'inner' }

export interface PartMeshProps {
  part: PartGeo
  /** Id used for picking and fx state, e.g. "a:skeleton". */
  fxId: string
  prio?: number
  pickable?: boolean
  /** visual mode: true bright, false dim, undefined means use lab behavior. */
  highlight?: boolean
  tint?: string
  baseOpacity?: number
}

/** One hologram part with hover, armed, matched and flash states driven by the fx store. */
export default function PartMesh({ part, fxId, prio = 0, pickable = false, highlight, tint, baseOpacity = 0.55 }: PartMeshProps) {
  const ref = useRef<THREE.Mesh>(null)
  const geo = useLabBGeo(part, OAK_SCALE, useTier() === 'low')
  const kind = KIND[part.id]
  const mat = useMemo(() => tintedHolo(tint ?? '#56B4E9', baseOpacity, kind !== 'shell', kind !== 'inner'), [tint, baseOpacity, kind])
  const depthMat = useMemo(() => (kind === 'shell' ? depthOnlyMaterial() : null), [kind])
  const baseColor = useMemo(() => new THREE.Color(tint ?? '#56B4E9'), [tint])
  const cur = useRef(1)
  const flashN = useRef(0)
  const flashT = useRef(-10)
  useEffect(() => () => mat.dispose(), [mat])
  useEffect(() => () => depthMat?.dispose(), [depthMat])
  const hand = useMemo(
    () => (pickable ? pointerHandlers(useFx.getState().setHover, () => useFx.getState().pick, (id) => id === fxId) : null),
    [pickable, fxId],
  )

  useFrame((state, dt) => {
    const mesh = ref.current
    if (!mesh) return
    const now = state.clock.elapsedTime
    let target = 1
    let opacity = baseOpacity
    let shake = 0
    const color = mat.color
    if (highlight !== undefined) {
      color.copy(highlight ? AMBER : CYAN)
      target = highlight ? 2.2 + Math.sin(now * 3) * 0.3 : 0.55
      opacity = highlight ? 0.95 : 0.3
    } else {
      const fx = useFx.getState()
      const bi = fx.bridges.findIndex((b) => b.includes(fxId))
      color.copy(baseColor)
      if (pickable) {
        target = 1.25 + Math.sin(now * 2.2) * 0.2
        opacity = 0.7
      }
      if (fx.flash && fx.flash.id === fxId && fx.flash.n !== flashN.current) {
        flashN.current = fx.flash.n
        flashT.current = now
      }
      const age = now - flashT.current
      if (bi >= 0) {
        color.copy(pairColors[bi % pairColors.length])
        target = 2 + (age < 1 ? (1 - age) * 2 : 0)
        opacity = 0.95
      } else if (fx.lit.includes(fxId)) {
        color.copy(AMBER)
        target = 2.4 + Math.sin(now * 6) * 0.3
        opacity = 0.95
      } else if (fx.hover === fxId) {
        target = 2.2
        opacity = 0.95
      }
      if (fx.flash && fx.flash.id === fxId && !fx.flash.ok && age < 0.5) shake = Math.sin(age * 60) * 0.05 * (1 - age / 0.5)
    }
    cur.current += (target - cur.current) * Math.min(1, dt * 10)
    color.multiplyScalar(cur.current)
    mat.opacity = opacity
    mesh.position.x = part.center[0] + shake
  })

  return (
    <>
      {depthMat ? (
        <mesh geometry={geo} position={part.center}>
          <primitive object={depthMat} attach="material" />
        </mesh>
      ) : null}
      <mesh ref={ref} geometry={geo} position={part.center} userData={pickable ? { part: fxId, prio } : {}} {...(hand ?? {})}>
        <primitive object={mat} attach="material" />
      </mesh>
    </>
  )
}
