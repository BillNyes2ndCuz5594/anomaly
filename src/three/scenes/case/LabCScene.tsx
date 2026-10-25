import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three/webgpu'
import { useFx } from '../../../state/session'
import { CameraRig, LabEnvironment, Pedestal, useReduced } from './common'
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
    m.position.y = 0.1 + a * 3.2
    mat.opacity = Math.sin(Math.min(1, a) * Math.PI) * 0.9
  })
  return (
    <mesh ref={ref} rotation={[Math.PI / 2, 0, 0]} key={id}>
      <torusGeometry args={[2.1, 0.02, 6, 64]} />
      <primitive object={mat} attach="material" />
    </mesh>
  )
}

export default function LabCScene() {
  const reduced = useReduced()
  const id = useFx((s) => s.specimen) ?? 'manatee'
  return (
    <>
      <LabEnvironment />
      <pointLight position={[3, 5, 5]} intensity={22} color="#fff2dd" distance={20} decay={2} />
      <pointLight position={[-4, 3, 3]} intensity={10} color="#8fdcff" distance={20} decay={2} />
      <CameraRig pos={[0, 2.8, 10.6]} look={[0, 0.55, 0]} />
      <Pedestal radius={2.5} />
      <Specimen key={id} id={id} fit={4.0} spin reduced={reduced} pop />
      <ScanRing key={`scan-${id}`} id={id} />
    </>
  )
}
