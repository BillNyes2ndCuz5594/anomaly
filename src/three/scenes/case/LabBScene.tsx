import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three/webgpu'
import { STILL } from '../../../lib/flags'
import { useFx } from '../../../state/session'
import { animalParts, plantParts, type PartGeo } from '../../models/creatures'
import { FitRig, LabEnvironment, Pedestal, useReduced, useTier } from './common'
import type { Box } from '../../fit'
import PartMesh from './PartMesh'
import { PAIR_TINTS } from './pairTints'
import { StageLights, SubjectStand } from './briefingLabStage'
import { partTint } from './briefingStage'

export const ANIMAL_POS: [number, number, number] = [-3.4, 0, 0]
export const PLANT_POS: [number, number, number] = [3.4, 0, 0]

/** Pickable parts and their pick priority. Inner structures win over the covering that wraps them. */
const PICK: Record<string, number> = { skeleton: 1, skin: 0, stem: 0, bark: 1 }

const lodFor = (tier: string): number => (tier === 'low' ? 0.6 : 1)

function worldCenter(side: 'a' | 'p', id: string, lod: number): THREE.Vector3 | null {
  const parts = side === 'a' ? animalParts(lod) : plantParts(lod)
  const p = parts.find((x) => x.id === id)
  if (!p) return null
  const o = side === 'a' ? ANIMAL_POS : PLANT_POS
  return new THREE.Vector3(o[0] + p.center[0], o[1] + p.center[1], o[2] + p.center[2])
}

const tmpPoint = new THREE.Vector3()

function Bridge({ ids, tint }: { ids: [string, string]; tint: string }) {
  const reduced = useReduced()
  const packet = useRef<THREE.Mesh>(null)
  const lod = lodFor(useTier())
  const { geo, curve } = useMemo(() => {
    const a = worldCenter('a', ids[0].slice(2), lod) ?? new THREE.Vector3()
    const b = worldCenter('p', ids[1].slice(2), lod) ?? new THREE.Vector3()
    const mid = a.clone().add(b).multiplyScalar(0.5)
    mid.y += 1.1
    mid.z += 1.0
    const c = new THREE.QuadraticBezierCurve3(a, mid, b)
    return { geo: new THREE.TubeGeometry(c, 40, 0.045, 6, false), curve: c }
  }, [ids, lod])
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
    const t = reduced || STILL ? 0.35 : (state.clock.elapsedTime * 0.5) % 1
    const p = packet.current
    if (p) p.position.copy(curve.getPoint(t, tmpPoint))
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
  const lod = lodFor(useTier())
  const parts: PartGeo[] = side === 'a' ? animalParts(lod) : plantParts(lod)
  return (
    <>
      {parts.map((p) => {
        const pick = p.id in PICK
        return (
          <PartMesh
            key={p.id}
            part={p}
            fxId={`${side}:${p.id}`}
            prio={PICK[p.id] ?? 0}
            pickable={pick}
            tint={partTint(side, p.id)}
            baseOpacity={pick ? 0.6 : 0.5}
          />
        )
      })}
    </>
  )
}

// Both models with their pedestals: animal at x -3.4, plant at x 3.4, roots down to about -1.4.
// The margin sits a little above the default 0.08: leaf tips and the animal's sway once reached 0.9 percent past the frame in the wide phone landscape.
const VIEW = { box: { min: [-5.9, -1.5, -2.4], max: [5.7, 3.7, 2.4] } as Box, elevation: 0.18, margin: 0.115 }

export default function LabBScene() {
  const reduced = useReduced()
  const left = useRef<THREE.Group>(null)
  const right = useRef<THREE.Group>(null)
  useFrame((state) => {
    const bob = reduced || STILL ? 0 : Math.sin(state.clock.elapsedTime * 1.1) * 0.05
    if (left.current) left.current.position.y = bob
    if (right.current) right.current.position.y = reduced || STILL ? 0 : Math.sin(state.clock.elapsedTime * 1.1 + 1.5) * 0.05
  })
  return (
    <>
      <LabEnvironment floorY={-1.55} ring={false} />
      <StageLights reduced={reduced} preset="lab-b" />
      <FitRig view={VIEW} />
      <group position={ANIMAL_POS}>
        <SubjectStand radius={1.55} column />
        <Pedestal radius={2.5} />
      </group>
      <group position={PLANT_POS}>
        <SubjectStand radius={2.05} y={-1.42} />
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
