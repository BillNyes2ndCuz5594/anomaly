import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three/webgpu'
import { depthOnlyMaterial, litSpecimen, tintedHolo } from '../../materials/tinted'
import { specimenGeo } from '../../models/creatures'

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
}

/** One low poly specimen, grounded at y = 0. Lit and flat shaded, or as a cyan hologram. */
export default function Specimen({ id, fit = 3, spin = false, reduced = false, mode = 'lit', yaw = -0.45, pop = false }: SpecimenProps) {
  const g = useMemo(() => specimenGeo(id), [id])
  const mat = useMemo(() => (mode === 'lit' ? litSpecimen() : tintedHolo('#3ee6ff', 0.9, false)), [mode])
  const depthMat = useMemo(() => (mode === 'holo' ? depthOnlyMaterial() : null), [mode])
  useEffect(() => () => mat.dispose(), [mat])
  useEffect(() => () => depthMat?.dispose(), [depthMat])
  const group = useRef<THREE.Group>(null)
  const born = useRef<number | null>(null)
  const k = fit / Math.max(g.size[0], g.size[1] * 1.15, g.size[2])

  useFrame((state, dt) => {
    const gr = group.current
    if (!gr) return
    if (born.current === null) born.current = state.clock.elapsedTime
    if (spin && !reduced) gr.rotation.y += dt * 0.55
    else if (!spin) gr.rotation.y = yaw
    if (pop && !reduced) {
      const a = Math.min(1, (state.clock.elapsedTime - born.current) / 0.55)
      const e = 1 - Math.pow(1 - a, 3)
      gr.scale.setScalar(k * (0.2 + 0.8 * e) * (a < 1 ? 1 + Math.sin(a * Math.PI) * 0.08 : 1))
    } else gr.scale.setScalar(k)
  })

  return (
    <group ref={group} rotation={[0, yaw, 0]} scale={k}>
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
