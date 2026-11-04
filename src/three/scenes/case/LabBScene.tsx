import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three/webgpu'
import { STILL } from '../../../lib/flags'
import { useFx } from '../../../state/session'
import { animalParts, plantParts, type PartGeo } from '../../models/creatures'
import { FitRig, LabEnvironment, Pedestal } from './common'
import { useReduced, useTier } from './sceneHelpers'
import type { Box } from '../../fit'
import PartMesh from './PartMesh'
import { PAIR_TINTS } from './pairTints'
import { useMotionMode } from '../../../ui/useMotionMode'
import { StageLights, SubjectStand } from './briefingLabStage'
import { partTint } from './briefingStage'

const ANIMAL_POS: [number, number, number] = [-3.4, 0, 0]
const PLANT_POS: [number, number, number] = [3.4, 0, 0]

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

/** L2: the arc draws from the animal end to the plant end over 500 ms with 6 sparks flying off its head. */
const ARC_S = 0.5
const SPARKS = 6
const sparkGeo = new THREE.SphereGeometry(0.05, 6, 4)
const sparkSeed = Array.from({ length: SPARKS }, (_, i) => {
  const a = i * 2.399 + 0.6
  return { dx: Math.cos(a), dy: Math.sin(a), lag: i / SPARKS }
})

function Bridge({ ids, tint }: { ids: [string, string]; tint: string }) {
  const reduced = useReduced()
  const arcs = useMotionMode() === 'full' && !STILL
  const packet = useRef<THREE.Mesh>(null)
  const sparks = useRef<THREE.Group>(null)
  const born = useRef<number | null>(null)
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
    if (arcs) {
      if (born.current === null) born.current = state.clock.elapsedTime
      const a = Math.min(1, (state.clock.elapsedTime - born.current) / ARC_S)
      const total = geo.index ? geo.index.count : 0
      geo.setDrawRange(0, a >= 1 ? Infinity : Math.floor((total * a) / 3) * 3)
      const g = sparks.current
      if (g) {
        g.visible = a < 1
        if (a < 1) {
          g.children.forEach((c, i) => {
            const s = sparkSeed[i]
            const k = Math.max(0, a - s.lag * 0.35)
            curve.getPoint(Math.min(1, a), tmpPoint)
            c.position.set(tmpPoint.x + s.dx * 0.55 * k, tmpPoint.y + s.dy * 0.55 * k, tmpPoint.z)
            c.scale.setScalar(Math.max(0.01, 1 - k * 1.4))
          })
        }
      }
    }
    const t = reduced || STILL ? 0.35 : (state.clock.elapsedTime * 0.5) % 1
    const p = packet.current
    if (p) p.position.copy(curve.getPoint(t, tmpPoint))
  })
  return (
    <group>
      <mesh geometry={geo}>
        <primitive object={mat} attach="material" />
      </mesh>
      {arcs ? (
        <group ref={sparks}>
          {sparkSeed.map((_, i) => (
            <mesh key={i} geometry={sparkGeo}>
              <primitive object={mat} attach="material" />
            </mesh>
          ))}
        </group>
      ) : null}
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
