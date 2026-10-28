import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three/webgpu'
import { STILL } from '../../../lib/flags'
import { useFx } from '../../../state/session'
import { humanModel, BODY_CENTER } from '../../models/human'
import { FitRig, LabEnvironment, Pedestal, useReduced } from './common'
import { sweepYaw, unionBox } from '../../fit'
import HumanFigure from './HumanFigure'
import { LabBench, LabLamps } from './labStage'

/** Short reticle on the organ that was just routed correctly. Small on purpose, so it never rings the arms. */
function OrganBeam({ reduced }: { reduced: boolean }) {
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
    const calm = reduced || STILL
    beamMat.opacity = 0.55 * k * Math.min(1, age * 8)
    ringMat.opacity = 0.85 * k
    ring.current?.scale.setScalar(calm ? 1 : 0.82 + Math.min(1, age * 3) * 0.18)
    const wobble = calm ? 1 : 1 + Math.sin(age * 6) * 0.04
    beam.current?.scale.set(wobble, 1, wobble)
  })

  return (
    <group ref={group} visible={false} userData={{ noFit: true }}>
      <mesh ref={beam} position={[0, 0.28, 0.16]}>
        <cylinderGeometry args={[0.012, 0.02, 0.62, 10, 1, true]} />
        <primitive object={beamMat} attach="material" />
      </mesh>
      <mesh ref={ring} position={[0, 0, 0.2]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.22, 0.012, 8, 32]} />
        <primitive object={ringMat} attach="material" />
      </mesh>
    </group>
  )
}

const RING = 2.15

export default function LabAScene() {
  const reduced = useReduced()
  const content = useRef<THREE.Group>(null)
  // The whole body at every turn angle plus the base ring.
  const view = useMemo(() => ({ box: unionBox(sweepYaw(humanModel().box, Math.PI, 36), { min: [-RING, 0, -RING], max: [RING, 0.06, RING] }), elevation: 0.16 }), [])
  return (
    <>
      <LabEnvironment floorY={-0.12} />
      <LabLamps radius={RING} subject="figure" reduced={reduced} />
      <FitRig view={view} measure={content} />
      <group ref={content}>
        <LabBench kind="figure" radius={RING} />
        <Pedestal radius={RING} />
        <HumanFigure mode="lab" spin reduced={reduced}>
          <OrganBeam reduced={reduced} />
        </HumanFigure>
      </group>
    </>
  )
}
