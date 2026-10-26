import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three/webgpu'
import { depthOnlyMaterial, litSpecimen, tintedHolo } from '../../materials/tinted'
import { STILL, STILL_YAW } from '../../../lib/flags'
import { specimenGeo } from '../../models/creatures'
import { SPECIMEN_LOOK } from '../../materials/detailMaps'
import { useTier } from './common'
import { specimenScale } from '../../models/specimenBox'

export interface SpecimenProps {
  id: string
  /** Largest dimension in world units after scaling. */
  fit?: number
  spin?: boolean
  reduced?: boolean
  mode?: 'lit' | 'holo'
  /** Resting yaw when not spinning. */
  yaw?: number
  /** Pops in from zero scale when mounted. */
  pop?: boolean
  /** Sways by this many radians around `yaw` instead of spinning. */
  sway?: number
}

/** One low poly specimen, grounded at y = 0. Lit and flat shaded, or as a cyan hologram. */
export default function Specimen({ id, fit = 3, spin = false, reduced = false, mode = 'lit', yaw = -0.45, pop = false, sway = 0 }: SpecimenProps) {
  const tier = useTier()
  const low = tier === 'low'
  const g = useMemo(() => specimenGeo(id, low ? 0.55 : 1), [id, low])
  const k = specimenScale(id, fit)
  // Low tier: fewer segments and no detail map, so it stays lighter than High.
  const mat = useMemo(() => (mode === 'lit' ? litSpecimen({ look: SPECIMEN_LOOK[id], detail: !low }) : tintedHolo('#3ee6ff', 0.9, false)), [mode, id, low])
  const depthMat = useMemo(() => (mode === 'holo' ? depthOnlyMaterial() : null), [mode])
  useEffect(() => () => mat.dispose(), [mat])
  useEffect(() => () => depthMat?.dispose(), [depthMat])
  const group = useRef<THREE.Group>(null)
  const born = useRef<number | null>(null)

  useFrame((state, dt) => {
    const gr = group.current
    if (!gr) return
    if (born.current === null) born.current = state.clock.elapsedTime
    if (STILL) gr.rotation.y = STILL_YAW
    else if (sway > 0) gr.rotation.y = yaw + (reduced ? 0 : Math.sin(state.clock.elapsedTime * 0.55) * sway)
    else if (spin && !reduced) gr.rotation.y += dt * 0.55
    else if (!spin) gr.rotation.y = yaw
    if (pop && !reduced) {
      const a = Math.min(1, (state.clock.elapsedTime - born.current) / 0.55)
      const e = 1 - Math.pow(1 - a, 3)
      gr.scale.setScalar(k * (0.2 + 0.8 * e) * (a < 1 ? 1 + Math.sin(a * Math.PI) * 0.08 : 1))
    } else gr.scale.setScalar(k)
  })

  return (
    <group ref={group} rotation={[0, STILL ? STILL_YAW : yaw, 0]} scale={k}>
      {depthMat ? (
        <mesh geometry={g.geo}>
          <primitive object={depthMat} attach="material" />
        </mesh>
      ) : null}
      <mesh geometry={g.geo}>
        <primitive object={mat} attach="material" />
      </mesh>
    </group>
  )
}
