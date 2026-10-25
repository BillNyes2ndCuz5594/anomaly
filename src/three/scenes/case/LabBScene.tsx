import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three/webgpu'
import { useFx } from '../../../state/session'
import { animalParts, plantParts, type PartGeo } from '../../models/creatures'
import { CameraRig, LabEnvironment, Pedestal, useReduced } from './common'
import PartMesh from './PartMesh'
import { PAIR_TINTS } from './pairTints'

export const ANIMAL_POS: [number, number, number] = [-3.4, 0, 0]
export const PLANT_POS: [number, number, number] = [3.4, 0, 0]

/** Pickable parts and their pick priority. Inner structures win over the covering that wraps them. */
const PICK: Record<string, number> = { skeleton: 1, skin: 0, stem: 0, bark: 1 }

function worldCenter(side: 'a' | 'p', id: string): THREE.Vector3 | null {
  const parts = side === 'a' ? animalParts() : plantParts()
  const p = parts.find((x) => x.id === id)
  if (!p) return null
  const o = side === 'a' ? ANIMAL_POS : PLANT_POS
  return new THREE.Vector3(o[0] + p.center[0], o[1] + p.center[1], o[2] + p.center[2])
}

function Bridge({ ids, tint }: { ids: [string, string]; tint: string }) {
  const packet = useRef<THREE.Mesh>(null)
  const { geo, curve } = useMemo(() => {
    const a = worldCenter('a', ids[0].slice(2)) ?? new THREE.Vector3()
    const b = worldCenter('p', ids[1].slice(2)) ?? new THREE.Vector3()
    const mid = a.clone().add(b).multiplyScalar(0.5)
    mid.y += 1.1
    mid.z += 1.0
    const c = new THREE.QuadraticBezierCurve3(a, mid, b)
    return { geo: new THREE.TubeGeometry(c, 40, 0.045, 6, false), curve: c }
  }, [ids])
  const mat = useMemo(() => {
    const m = new THREE.MeshBasicNodeMaterial()
    m.color.set(tint).multiplyScalar(2.2)
    m.transparent = true
    m.blending = THREE.AdditiveBlending
    m.depthWrite = false
    m.opacity = 0.9
    return m
  }, [tint])
  useEffect(
    () => () => {
      geo.dispose()
      mat.dispose()
    },
    [geo, mat],
  )
  useFrame((state) => {
    const t = (state.clock.elapsedTime * 0.5) % 1
    const p = packet.current
    if (p) p.position.copy(curve.getPoint(t))
  })
  return (
    <group>
      <mesh geometry={geo}>
        <primitive object={mat} attach="material" />
      </mesh>
      <mesh ref={packet}>
        <sphereGeometry args={[0.12, 10, 8]} />
        <primitive object={mat} attach="material" />
      </mesh>
    </group>
  )
}

function Bridges() {
  const bridges = useFx((s) => s.bridges)
  return (
    <>
      {bridges.map((b, i) => (
        <Bridge key={b.join('|')} ids={b} tint={PAIR_TINTS[i % PAIR_TINTS.length]} />
      ))}
    </>
  )
}

function ModelParts({ side }: { side: 'a' | 'p' }) {
  const parts: PartGeo[] = side === 'a' ? animalParts() : plantParts()
  return (
    <>
      {parts.map((p) => {
        const pick = p.id in PICK
        const tint = side === 'p' && !pick ? (p.id === 'leaf' ? '#009E73' : p.id === 'root' ? '#E69F00' : '#56B4E9') : '#56B4E9'
        return <PartMesh key={p.id} part={p} fxId={`${side}:${p.id}`} prio={PICK[p.id] ?? 0} pickable={pick} tint={tint} baseOpacity={pick ? 0.6 : 0.4} />
      })}
    </>
  )
}

export default function LabBScene() {
  const reduced = useReduced()
  const left = useRef<THREE.Group>(null)
  const right = useRef<THREE.Group>(null)
  useFrame((state) => {
    if (reduced) return
    const t = state.clock.elapsedTime
    if (left.current) left.current.position.y = Math.sin(t * 1.1) * 0.05
    if (right.current) right.current.position.y = Math.sin(t * 1.1 + 1.5) * 0.05
  })
  return (
    <>
      <LabEnvironment floorY={-1.55} ring={false} />
      <CameraRig pos={[0, 2.4, 14.2]} look={[0, 1.2, 0]} />
      <group position={ANIMAL_POS}>
        <Pedestal radius={2.5} />
      </group>
      <group position={PLANT_POS}>
        <Pedestal radius={2.3} tint="#9ff0c0" />
      </group>
      <group ref={left} position={ANIMAL_POS}>
        <ModelParts side="a" />
      </group>
      <group ref={right} position={PLANT_POS}>
        <ModelParts side="p" />
      </group>
      <Bridges />
    </>
  )
}
