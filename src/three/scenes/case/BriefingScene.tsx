import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three/webgpu'
import { STILL } from '../../../lib/flags'
import { humanModel } from '../../models/human'
import { specimenBox } from '../../models/specimenBox'
import { sweepYaw, translateBox, unionBox, type Box } from '../../fit'
import { FitRig, LabEnvironment, Pedestal, useReduced } from './common'
import HumanFigure from './HumanFigure'
import Specimen from './Specimen'
import { BriefingTable, StageLights } from './briefingLabStage'
import { scanFade, scanHeight, scanPhase } from './briefingStage'

/**
 * Scanner line on the front lip of the table. It stays low, in front of the feet,
 * so it never cuts the body or the manatee.
 */
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
    return { core: make(0.9, 2.2), glow: make(0.04, 1) }
  }, [])
  useEffect(
    () => () => {
      core.dispose()
      glow.dispose()
    },
    [core, glow],
  )
  useFrame((state) => {
    const p = scanPhase(state.clock.elapsedTime, STILL || reduced)
    const fade = scanFade(p)
    if (bar.current) bar.current.position.y = scanHeight(p)
    core.opacity = 0.9 * fade
    glow.opacity = 0.05 * fade
  })
  return (
    <group ref={bar} position={[0.15, 0.2, 2.36]} userData={{ noFit: true }}>
      <mesh>
        <boxGeometry args={[10.8, 0.045, 0.28]} />
        <primitive object={glow} attach="material" />
      </mesh>
      <mesh>
        <boxGeometry args={[10.8, 0.012, 0.02]} />
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
    return { box: unionBox(human, spec, translateBox(ring(1.95), [HUMAN_X, 0, 0]), translateBox(ring(2.75), [SPEC_X, 0, 0])), elevation: 0.2 }
  }, [])
  return (
    <>
      <LabEnvironment floorY={-0.16} />
      <StageLights reduced={reduced} preset="briefing" />
      <FitRig view={view} measure={content} from={[5, 3, 4]} />
      <BriefingTable />
      <group ref={content}>
        <group position={[HUMAN_X, 0, 0]}>
          <Pedestal radius={1.95} />
          <HumanFigure mode="briefing" spin reduced={reduced} scale={HUMAN_SCALE} />
        </group>
        <group position={[SPEC_X, 0, 0]}>
          <Pedestal radius={2.75} />
          <Specimen id="manatee" fit={SPEC_FIT} mode="lit" spin reduced={reduced} />
        </group>
      </group>
      <ScannerSweep reduced={reduced} />
    </>
  )
}
