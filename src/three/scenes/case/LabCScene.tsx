import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three/webgpu'
import { useFx } from '../../../state/session'
import { pointsBox } from '../../fit'
import { specimenOutline, specimenRing } from '../../models/specimenBox'
import { STILL, STILL_YAW } from '../../../lib/flags'
import { FitRig, LabEnvironment, Pedestal, useReduced } from './common'
import Specimen from './Specimen'

/** Thin scan ring that travels up the specimen each time a new one is loaded. */
function ScanRing({ id }: { id: string }) {
  const ref = useRef<THREE.Mesh>(null)
  const t0 = useRef<number | null>(null)
  const mat = useMemo(() => {
    const m = new THREE.MeshBasicNodeMaterial()
    m.color.set('#3ee6ff').multiplyScalar(2.2)
    m.transparent = true
    m.blending = THREE.AdditiveBlending
    m.depthWrite = false
    return m
  }, [])
  useEffect(() => () => mat.dispose(), [mat])
  useFrame((state) => {
    const m = ref.current
    if (!m) return
    if (t0.current === null) t0.current = state.clock.elapsedTime
    const a = (state.clock.elapsedTime - t0.current) / 1.4
    m.visible = a < 1
    m.position.y = 0.1 + a * 3.0
    mat.opacity = Math.sin(Math.min(1, a) * Math.PI) * 0.9
  })
  return (
    <mesh ref={ref} rotation={[Math.PI / 2, 0, 0]} key={id}>
      <torusGeometry args={[specimenRing(id, FIT) * 0.85, 0.02, 6, 64]} />
      <primitive object={mat} attach="material" />
    </mesh>
  )
}

const FIT = 4.2
/** Lab C shows the specimen swaying through a wide arc (side profile to head on) instead of a full spin, so the camera can fit the real silhouette. */
const YAW = -0.7
const SWAY = 0.95

export default function LabCScene() {
  const reduced = useReduced()
  const id = useFx((s) => s.specimen) ?? 'manatee'
  const content = useRef<THREE.Group>(null)
  const ring = specimenRing(id, FIT)
  const view = useMemo(() => {
    const points = specimenOutline(id, FIT, STILL ? STILL_YAW : YAW, STILL ? 0.02 : SWAY)
    return { box: pointsBox(points), points, elevation: 0.3, margin: 0.16 }
  }, [id])
  return (
    <>
      <LabEnvironment />
      <pointLight position={[3, 5, 5]} intensity={22} color="#fff2dd" distance={20} decay={2} />
      <pointLight position={[-4, 3, 3]} intensity={10} color="#8fdcff" distance={20} decay={2} />
      <FitRig view={view} measure={content} />
      <group ref={content}>
        <Pedestal radius={ring} />
        <Specimen key={id} id={id} fit={FIT} yaw={YAW} sway={SWAY} reduced={reduced} pop />
      </group>
      <ScanRing key={`scan-${id}`} id={id} />
    </>
  )
}
