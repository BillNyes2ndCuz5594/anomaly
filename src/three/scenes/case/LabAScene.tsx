import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three/webgpu'
import { useFx } from '../../../state/session'
import { humanModel, BODY_CENTER } from '../../models/human'
import { CameraRig, LabEnvironment, Pedestal, useReduced } from './common'
import HumanFigure from './HumanFigure'

/** Light beam and expanding ring at the organ that was just routed correctly. */
function OrganBeam() {
  const group = useRef<THREE.Group>(null)
  const beam = useRef<THREE.Mesh>(null)
  const ring = useRef<THREE.Mesh>(null)
  const lastN = useRef(0)
  const t0 = useRef(-10)
  const model = useMemo(() => humanModel(), [])
  const { beamMat, ringMat } = useMemo(() => {
    const make = () => {
      const m = new THREE.MeshBasicNodeMaterial()
      m.color.set('#9ff0ff').multiplyScalar(2)
      m.transparent = true
      m.blending = THREE.AdditiveBlending
      m.depthWrite = false
      m.depthTest = false
      m.side = THREE.DoubleSide
      m.opacity = 0
      return m
    }
    return { beamMat: make(), ringMat: make() }
  }, [])
  useEffect(
    () => () => {
      beamMat.dispose()
      ringMat.dispose()
    },
    [beamMat, ringMat],
  )

  useFrame((state) => {
    const fx = useFx.getState().flash
    const now = state.clock.elapsedTime
    if (fx && fx.n !== lastN.current) {
      lastN.current = fx.n
      if (fx.ok) {
        t0.current = now
        const c = fx.id === 'skin' ? BODY_CENTER : (model.organs.get(fx.id)?.center ?? BODY_CENTER)
        group.current?.position.set(c[0], c[1], fx.id === 'skin' ? 0 : c[2])
      }
    }
    const age = now - t0.current
    const on = age >= 0 && age < 1.8
    if (group.current) group.current.visible = on
    if (!on) return
    const k = 1 - age / 1.8
    beamMat.opacity = 0.4 * k * Math.min(1, age * 8)
    ringMat.opacity = 0.9 * k
    ring.current?.scale.setScalar(0.4 + age * 1.6)
    beam.current?.scale.set(1 + Math.sin(age * 30) * 0.08, 1, 1 + Math.sin(age * 30) * 0.08)
  })

  return (
    <group ref={group} visible={false}>
      <mesh ref={beam}>
        <cylinderGeometry args={[0.035, 0.035, 9, 12, 1, true]} />
        <primitive object={beamMat} attach="material" />
      </mesh>
      <mesh ref={ring} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.6, 0.025, 6, 40]} />
        <primitive object={ringMat} attach="material" />
      </mesh>
    </group>
  )
}

export default function LabAScene() {
  const reduced = useReduced()
  return (
    <>
      <LabEnvironment />
      <CameraRig pos={[0, 3.2, 13.2]} look={[0, 1.6, 0]} />
      <Pedestal radius={2.1} />
      <HumanFigure mode="lab" spin reduced={reduced}>
        <OrganBeam />
      </HumanFigure>
    </>
  )
}
