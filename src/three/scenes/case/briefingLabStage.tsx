import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three/webgpu'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { STILL } from '../../../lib/flags'
import { TIER_CONFIG } from '../../../state/quality'
import { ContactShadow } from '../common'
import { useTier } from './common'
import { lampScale } from './briefingStage'

function useStageMaterials() {
  const metal = useMemo(() => {
    const m = new THREE.MeshStandardNodeMaterial({ color: '#1a2944', roughness: 0.4, metalness: 0.68 })
    m.polygonOffset = true
    m.polygonOffsetFactor = 1
    m.polygonOffsetUnits = 1
    return m
  }, [])
  const cyan = useMemo(() => {
    const m = new THREE.MeshBasicNodeMaterial()
    m.color.set('#7aefff')
    m.transparent = true
    m.opacity = 0.9
    m.blending = THREE.AdditiveBlending
    m.depthWrite = false
    m.toneMapped = false
    return m
  }, [])
  useEffect(
    () => () => {
      metal.dispose()
      cyan.dispose()
    },
    [metal, cyan],
  )
  return { metal, cyan }
}

function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  if (parts.length === 1) return parts[0]
  const g = mergeGeometries(parts)
  if (!g) throw new Error('briefing bench')
  for (const p of parts) p.dispose()
  return g
}

/** Shared table under the briefing pair. Top is flush with the feet. Marked noFit so the camera still frames the subjects. */
export function BriefingTable() {
  const mats = useStageMaterials()
  const geos = useMemo(() => {
    const metal: THREE.BufferGeometry[] = []
    const cyan: THREE.BufferGeometry[] = []
    const w = 11.4
    const d = 4.6
    metal.push(new THREE.BoxGeometry(w, 0.1, d).translate(0.15, -0.05, 0.05))
    metal.push(new THREE.BoxGeometry(w, 0.02, 0.05).translate(0.15, 0.008, 2.32))
    cyan.push(new THREE.BoxGeometry(w - 0.4, 0.012, 0.016).translate(0.15, 0.02, 2.3))
    for (const [x, z] of [
      [-5.2, 2.05],
      [5.5, 2.05],
      [-5.2, -1.9],
      [5.5, -1.9],
    ] as const) {
      const sx = x > 0 ? -1 : 1
      const sz = z > 0 ? -1 : 1
      cyan.push(new THREE.BoxGeometry(0.28, 0.016, 0.016).translate(x + sx * 0.1, 0.02, z))
      cyan.push(new THREE.BoxGeometry(0.016, 0.016, 0.28).translate(x, 0.02, z + sz * 0.1))
    }
    return { metal: merge(metal), cyan: merge(cyan) }
  }, [])
  useEffect(
    () => () => {
      geos.metal.dispose()
      geos.cyan.dispose()
    },
    [geos],
  )
  const tier = useTier()
  return (
    <group userData={{ noFit: true }}>
      <mesh geometry={geos.metal} material={mats.metal} />
      <mesh geometry={geos.cyan} material={mats.cyan} />
      {TIER_CONFIG[tier].contactShadow ? (
        <>
          <ContactShadow position={[-2.9, 0.02, 0.05]} radius={1.35} opacity={0.5} />
          <ContactShadow position={[3.2, 0.02, 0.15]} radius={1.7} opacity={0.55} />
        </>
      ) : null}
    </group>
  )
}

/**
 * Cap under a Lab B subject. `column` drops a stem to the floor so the deer is not floating.
 * Oak roots already reach the floor, so they only get the cap.
 */
export function SubjectStand({ radius, column = false, y = 0 }: { radius: number; column?: boolean; y?: number }) {
  const low = useTier() === 'low'
  const mats = useStageMaterials()
  const geos = useMemo(() => {
    const seg = low ? 12 : 28
    const capH = 0.07
    const metal = [new THREE.CylinderGeometry(radius, radius * 1.05, capH, seg).translate(0, y - capH / 2, 0)]
    const lip = new THREE.TorusGeometry(radius * 0.98, 0.014, 6, seg)
    lip.rotateX(-Math.PI / 2)
    lip.translate(0, y - 0.004, 0)
    if (column) {
      const footY = -1.5
      const stemTop = y - capH
      const stemH = Math.max(0.2, stemTop - (footY + 0.08))
      metal.push(new THREE.CylinderGeometry(radius * 0.2, radius * 0.26, stemH, low ? 8 : 14).translate(0, footY + 0.08 + stemH / 2, 0))
      metal.push(new THREE.CylinderGeometry(radius * 0.7, radius * 0.78, 0.08, seg).translate(0, footY + 0.04, 0))
    }
    return { metal: merge(metal), cyan: lip }
  }, [radius, column, y, low])
  useEffect(
    () => () => {
      geos.metal.dispose()
      geos.cyan.dispose()
    },
    [geos],
  )
  return (
    <group userData={{ noFit: true }}>
      <mesh geometry={geos.metal} material={mats.metal} />
      <mesh geometry={geos.cyan} material={mats.cyan} />
    </group>
  )
}

/** Warm key, cool fill, cyan rim. The key holds still when motion is off. Low tier drops the amber kicker. */
export function StageLights({ reduced, preset }: { reduced: boolean; preset: 'briefing' | 'lab-b' }) {
  const low = useTier() === 'low'
  const key = useRef<THREE.PointLight>(null)
  const brief = preset === 'briefing'
  const base = brief ? 24 : 16
  useFrame((state) => {
    const L = key.current
    if (!L) return
    L.intensity = base * lampScale(state.clock.elapsedTime, reduced || STILL)
  })
  return (
    <>
      <pointLight ref={key} position={brief ? [1.4, 6.4, 6.2] : [0.2, 5.4, 6.2]} intensity={base} color="#fff1d6" distance={brief ? 28 : 24} decay={2} />
      <pointLight position={brief ? [-5.2, 3.4, 3.8] : [-4.4, 3.1, 4.2]} intensity={brief ? 11 : 8} color="#d5ecff" distance={22} decay={2} />
      <pointLight position={brief ? [0.2, 4.6, -6.4] : [0.1, 3.8, -5.2]} intensity={low ? 12 : brief ? 20 : 14} color="#7adfff" distance={26} decay={2} />
      {low ? null : <pointLight position={brief ? [6.2, 2.3, -1.8] : [4.6, 2.2, -2.4]} intensity={7} color="#ffb25e" distance={16} decay={2} />}
    </>
  )
}
