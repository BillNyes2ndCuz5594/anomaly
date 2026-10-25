import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three/webgpu'
import { CameraRig, LabEnvironment, Pedestal, useReduced } from './common'
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
    if (bar.current) bar.current.position.y = 0.1 + k * 5.0
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

export default function BriefingScene() {
  const reduced = useReduced()
  return (
    <>
      <LabEnvironment />
      <pointLight position={[3, 5, 5]} intensity={16} color="#fff2dd" distance={20} decay={2} />
      <CameraRig pos={[0, 3.3, 13.4]} look={[0, 1.95, 0]} from={[5, 3, 4]} />
      <group position={[-2.4, 0, 0]}>
        <Pedestal radius={1.9} />
        <HumanFigure mode="briefing" spin reduced={reduced} scale={0.95} />
      </group>
      <group position={[2.7, 0, 0]}>
        <Pedestal radius={2.4} />
        <Specimen id="manatee" fit={3.6} mode="holo" spin reduced={reduced} />
      </group>
      <ScannerSweep reduced={reduced} />
    </>
  )
}
