import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three/webgpu'
import { humanModel } from '../../models/human'
import { specimenBox } from '../../models/specimenBox'
import { sweepYaw, translateBox, unionBox, type Box } from '../../fit'
import { FitRig, LabEnvironment, Pedestal, useReduced } from './common'
import HumanFigure from './HumanFigure'
import Specimen from './Specimen'

/** Horizontal scanner bar that sweeps up and down across both subjects. */
function ScannerSweep({ reduced }: { reduced: boolean }) {
  const bar = useRef<THREE.Group>(null)
  const { core, glow } = useMemo(() => {
    const make = (op: number, mul: number) => {
      const m = new THREE.MeshBasicNodeMaterial()
      m.color.set('#ffb547').multiplyScalar(mul)
      m.opacity = op
      m.transparent = true
      m.blending = THREE.AdditiveBlending
      m.depthWrite = false
      m.side = THREE.DoubleSide
      return m
    }
    return { core: make(0.9, 2.2), glow: make(0.025, 1) }
  }, [])
  useEffect(
    () => () => {
      core.dispose()
      glow.dispose()
    },
    [core, glow],
  )
  useFrame((state) => {
    const t = reduced ? 0.4 : state.clock.elapsedTime
    const k = (Math.sin(t * 0.9) + 1) / 2
    if (bar.current) bar.current.position.y = 0.1 + k * 6.0
  })
  return (
    <group ref={bar}>
      <mesh>
        <boxGeometry args={[9.5, 0.04, 2.6]} />
        <primitive object={glow} attach="material" />
      </mesh>
      <mesh position={[0, 0, 1.3]}>
        <boxGeometry args={[9.5, 0.04, 0.04]} />
        <primitive object={core} attach="material" />
      </mesh>
      <mesh position={[0, 0, -1.3]}>
        <boxGeometry args={[9.5, 0.04, 0.04]} />
        <primitive object={core} attach="material" />
      </mesh>
    </group>
  )
}

const HUMAN_X = -2.9
const HUMAN_SCALE = 0.95
const SPEC_X = 3.2
const SPEC_FIT = 4.6
const ring = (r: number): Box => ({ min: [-r, 0, -r], max: [r, 0.06, r] })

export default function BriefingScene() {
  const reduced = useReduced()
  const content = useRef<THREE.Group>(null)
  const view = useMemo(() => {
    const hb = sweepYaw(humanModel().box, Math.PI, 36)
    const human = translateBox({ min: hb.min.map((v) => v * HUMAN_SCALE) as Box['min'], max: hb.max.map((v) => v * HUMAN_SCALE) as Box['max'] }, [HUMAN_X, 0, 0])
    const spec = translateBox(sweepYaw(specimenBox('manatee', SPEC_FIT), Math.PI, 36), [SPEC_X, 0, 0])
    return { box: unionBox(human, spec, translateBox(ring(1.95), [HUMAN_X, 0, 0]), translateBox(ring(2.75), [SPEC_X, 0, 0])), elevation: 0.18 }
  }, [])
  return (
    <>
      <LabEnvironment />
      <pointLight position={[3, 5, 5]} intensity={16} color="#fff2dd" distance={20} decay={2} />
      <FitRig view={view} measure={content} from={[5, 3, 4]} />
      <group ref={content}>
        <group position={[HUMAN_X, 0, 0]}>
          <Pedestal radius={1.95} />
          <HumanFigure mode="briefing" spin reduced={reduced} scale={HUMAN_SCALE} />
        </group>
        <group position={[SPEC_X, 0, 0]}>
          <Pedestal radius={2.75} />
          <Specimen id="manatee" fit={SPEC_FIT} mode="holo" spin reduced={reduced} />
        </group>
      </group>
      <ScannerSweep reduced={reduced} />
    </>
  )
}
