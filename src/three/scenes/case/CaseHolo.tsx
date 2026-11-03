import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three/webgpu'
import case00_1 from '../../../assets/holo/case-00-1.webp?url'
import case01_1 from '../../../assets/holo/case-01-1.webp?url'
import case02_1 from '../../../assets/holo/case-02-1.webp?url'
import case02_2 from '../../../assets/holo/case-02-2.webp?url'
import case04_1 from '../../../assets/holo/case-04-1.webp?url'
import case05_1 from '../../../assets/holo/case-05-1.webp?url'
import case06_1 from '../../../assets/holo/case-06-1.webp?url'
import case07_1 from '../../../assets/holo/case-07-1.webp?url'
import case07_2 from '../../../assets/holo/case-07-2.webp?url'

const HOLO_MAP: Record<string, string> = {
  '00-1': case00_1,
  'case-00-1': case00_1,
  '01-1': case01_1,
  'case-01-1': case01_1,
  '02-1': case02_1,
  'case-02-1': case02_1,
  '02-2': case02_2,
  'case-02-2': case02_2,
  '04-1': case04_1,
  'case-04-1': case04_1,
  '05-1': case05_1,
  'case-05-1': case05_1,
  '06-1': case06_1,
  'case-06-1': case06_1,
  '07-1': case07_1,
  'case-07-1': case07_1,
  '07-2': case07_2,
  'case-07-2': case07_2,
}

const BASE_Y = 0.95

export default function CaseHolo({ caseId, reduced }: { caseId: string; reduced: boolean }) {
  const url = HOLO_MAP[caseId]
  const meshRef = useRef<THREE.Mesh>(null)
  const born = useRef<number | null>(null)

  const texture = useMemo(() => {
    if (!url) return null
    const tex = new THREE.TextureLoader().load(url)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [url])

  const mat = useMemo(() => {
    if (!texture) return null
    const m = new THREE.MeshBasicNodeMaterial()
    m.map = texture
    m.transparent = true
    m.blending = THREE.AdditiveBlending
    m.depthWrite = false
    m.toneMapped = false
    m.side = THREE.DoubleSide
    m.opacity = reduced ? 1 : 0
    return m
  }, [texture, reduced])

  useEffect(() => {
    born.current = null
  }, [caseId])

  useEffect(() => {
    return () => {
      texture?.dispose()
      mat?.dispose()
    }
  }, [texture, mat])

  useFrame((state) => {
    const mesh = meshRef.current
    if (!mesh) return
    const m = mesh.material as THREE.MeshBasicNodeMaterial
    if (reduced) {
      mesh.position.y = BASE_Y
      m.opacity = 1
      return
    }
    if (born.current === null) {
      born.current = state.clock.elapsedTime
    }
    const age = state.clock.elapsedTime - born.current
    m.opacity = Math.min(1, age / 0.6)
    mesh.position.y = BASE_Y + Math.sin(state.clock.elapsedTime * 1.2) * 0.03
  })

  if (!url || !mat) return null

  return (
    <mesh ref={meshRef} position={[0, BASE_Y, 0]} userData={{ noFit: true }}>
      <planeGeometry args={[1.3, 1.3]} />
      <primitive object={mat} attach="material" />
    </mesh>
  )
}
