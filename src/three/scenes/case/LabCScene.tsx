import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three/webgpu'
import { useFx } from '../../../state/session'
import { pointsBox } from '../../fit'
import { specimenOutline, specimenRing } from '../../models/specimenBox'
import { STILL, STILL_YAW } from '../../../lib/flags'
import { FitRig, LabEnvironment, Pedestal, useReduced } from './common'
import { LabBench, LabLamps } from './labStage'
import Specimen from './Specimen'

/** Scan bar in front of the specimen. A full ring would pass through the body as it climbed. */
function ScanBar({ id, radius, reduced }: { id: string; radius: number; reduced: boolean }) {
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
  const span = Math.min(2.2, Math.max(0.9, radius * 0.85))
  useFrame((state) => {
    const m = ref.current
    if (!m) return
    if (reduced || STILL) {
      m.visible = false
      return
    }
    if (t0.current === null) t0.current = state.clock.elapsedTime
    const a = (state.clock.elapsedTime - t0.current) / 1.4
    m.visible = a < 1
    m.position.y = 0.12 + a * span
    mat.opacity = Math.sin(Math.min(1, a) * Math.PI) * 0.9
  })
  return (
    <mesh ref={ref} position={[0, 0.2, radius * 1.12]} key={id} userData={{ noFit: true }}>
      <boxGeometry args={[radius * 1.15, 0.02, 0.015]} />
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
      <LabEnvironment floorY={-0.12} />
      <LabLamps radius={ring} subject="specimen" reduced={reduced} />
      <FitRig view={view} measure={content} />
      <group ref={content}>
        <LabBench kind="specimen" radius={ring} />
        <Pedestal radius={ring} />
        <Specimen key={id} id={id} fit={FIT} yaw={YAW} sway={SWAY} reduced={reduced} pop />
      </group>
      <ScanBar key={`scan-${id}`} id={id} radius={ring} reduced={reduced} />
    </>
  )
}
