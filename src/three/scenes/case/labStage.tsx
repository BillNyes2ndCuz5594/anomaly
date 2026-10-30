import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three/webgpu'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { STILL } from '../../../lib/flags'
import { TIER_CONFIG } from '../../../state/quality'
import { ContactShadow } from '../common'
import { useTier } from './common'

/**
 * Exam-lamp and rim lights for Lab A and Lab C.
 * Low tier keeps a key and one rim. The lamp breathes only when motion is allowed.
 */
export function LabLamps({
  radius,
  subject,
  reduced,
}: {
  radius: number
  subject: 'figure' | 'specimen'
  reduced: boolean
}) {
  const low = useTier() === 'low'
  const lamp = useRef<THREE.PointLight>(null)
  const figure = subject === 'figure'
  const key = figure ? 3.4 : 16
  useFrame((state) => {
    const L = lamp.current
    if (!L) return
    const breathe = reduced || STILL ? 1 : 0.94 + Math.sin(state.clock.elapsedTime * 0.65) * 0.06
    L.intensity = key * breathe
  })
  const r = radius
  return (
    <>
      <pointLight
        ref={lamp}
        position={figure ? [r * 0.42, 4.6, r * 1.2] : [r * 0.3, r * 1.55, r * 1.25]}
        intensity={key}
        color="#fff1d6"
        distance={figure ? 14 : r * 8}
        decay={2}
      />
      <pointLight
        position={figure ? [0.96, 0.85, 1.12] : [r * 1.2, r * 0.45, r * 0.95]}
        intensity={figure ? 5 : 8}
        color="#ffd19a"
        distance={figure ? 5.5 : r * 3.2}
        decay={2}
      />
      <pointLight
        position={figure ? [-r * 1.05, 4.4, -r * 1.15] : [-r * 0.15, r * 1.35, -r * 1.35]}
        intensity={low ? (figure ? 8 : 12) : figure ? 15 : 20}
        color="#8fe7ff"
        distance={figure ? 16 : r * 8}
        decay={2}
      />
      {low ? null : (
        <pointLight
          position={figure ? [r * 1.15, 2.5, -r * 0.95] : [r * 1.05, r * 0.45, -r * 0.7]}
          intensity={figure ? 5 : 8}
          color="#ffb25e"
          distance={figure ? 11 : r * 6}
          decay={2}
        />
      )}
    </>
  )
}

function addBox(out: THREE.BufferGeometry[], w: number, h: number, d: number, x: number, y: number, z: number) {
  out.push(new THREE.BoxGeometry(w, h, d).translate(x, y, z))
}

function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  if (parts.length === 1) return parts[0]
  const g = mergeGeometries(parts)
  if (!g) throw new Error('lab bench')
  for (const p of parts) p.dispose()
  return g
}

function flatTorus(radius: number, tube: number, segments: number, y: number): THREE.BufferGeometry {
  const g = new THREE.TorusGeometry(radius, tube, 8, segments)
  g.rotateX(-Math.PI / 2)
  g.translate(0, y, 0)
  return g
}

interface BenchGeos {
  metal: THREE.BufferGeometry
  cyan: THREE.BufferGeometry
  warm: THREE.BufferGeometry
}

/** Raised dais, lamp, vials and a rear scan frame. All of it stays outside the spinning body. */
function figureBench(): BenchGeos {
  const metal: THREE.BufferGeometry[] = []
  const cyan: THREE.BufferGeometry[] = []
  const warm: THREE.BufferGeometry[] = []
  const tableH = 0.12
  const tableY = -tableH / 2
  addBox(metal, 3.5, tableH, 2.55, 0, tableY, 0.12)
  // Front lip, so the top reads as a machined plate and not a flat card.
  addBox(metal, 3.5, 0.02, 0.04, 0, -0.01, 1.375)
  addBox(cyan, 3.15, 0.012, 0.018, 0, 0.008, 1.34)
  // Corner brackets, the same language as the HUD.
  for (const [x, z] of [
    [-1.62, 1.22],
    [1.62, 1.22],
    [-1.62, -1.02],
    [1.62, -1.02],
  ] as const) {
    const sx = x > 0 ? -1 : 1
    const sz = z > 0 ? -1 : 1
    addBox(cyan, 0.22, 0.016, 0.016, x + sx * 0.08, 0.012, z)
    addBox(cyan, 0.016, 0.016, 0.22, x, 0.012, z + sz * 0.08)
  }
  // Vial rack, front left, outside the leg sweep so it cannot sit inside the hologram.
  addBox(metal, 0.5, 0.04, 0.26, -1.42, 0.02, 1.05)
  for (const x of [-1.56, -1.42, -1.28]) {
    metal.push(new THREE.CylinderGeometry(0.034, 0.038, 0.26, 8).translate(x, 0.17, 1.05))
    cyan.push(new THREE.CylinderGeometry(0.02, 0.02, 0.09, 8).translate(x, 0.24, 1.05))
  }
  // Exam lamp, front right. Base, post, arm and head share one line so nothing floats.
  addBox(metal, 0.32, 0.05, 0.24, 1.38, 0.025, 1.08)
  addBox(metal, 0.06, 0.72, 0.06, 1.46, 0.4, 1.12)
  addBox(metal, 0.48, 0.05, 0.05, 1.2, 0.74, 1.12)
  addBox(warm, 0.22, 0.1, 0.16, 0.96, 0.7, 1.12)
  // Rear frame, outside the arm sweep, behind the shoulders. No center rail: it read through the legs.
  addBox(metal, 0.07, 5.05, 0.07, -1.7, 2.52, -1.02)
  addBox(metal, 0.07, 5.05, 0.07, 1.7, 2.52, -1.02)
  addBox(metal, 3.47, 0.06, 0.06, 0, 5.02, -1.02)
  addBox(cyan, 0.02, 4.7, 0.02, -1.66, 2.5, -0.98)
  addBox(cyan, 0.02, 4.7, 0.02, 1.66, 2.5, -0.98)
  addBox(cyan, 3.2, 0.02, 0.02, 0, 4.98, -0.98)
  return { metal: merge(metal), cyan: merge(cyan), warm: merge(warm) }
}

/** Turntable the specimen stands on. Top is flush with the feet (y = 0). */
function specimenBench(radius: number, segments: number): BenchGeos {
  const h = 0.12
  const metal = [
    new THREE.CylinderGeometry(radius * 1.05, radius * 1.1, h, segments).translate(0, -h / 2, 0),
    flatTorus(radius * 0.98, 0.04, segments, 0.02),
  ]
  const cyan = [flatTorus(radius * 1.08, 0.012, segments, 0.015)]
  return { metal: merge(metal), cyan: merge(cyan), warm: new THREE.BufferGeometry() }
}

function useBenchMaterials() {
  const metal = useMemo(() => {
    const m = new THREE.MeshStandardNodeMaterial({ color: '#1a2944', roughness: 0.38, metalness: 0.7 })
    m.polygonOffset = true
    m.polygonOffsetFactor = -1
    m.polygonOffsetUnits = -1
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
  const warm = useMemo(() => {
    const m = new THREE.MeshStandardNodeMaterial({
      color: '#3a2a16',
      roughness: 0.4,
      metalness: 0.2,
      emissive: '#ffc98a',
      emissiveIntensity: 1.6,
    })
    m.toneMapped = false
    return m
  }, [])
  useEffect(
    () => () => {
      metal.dispose()
      cyan.dispose()
      warm.dispose()
    },
    [metal, cyan, warm],
  )
  return { metal, cyan, warm }
}

/** Forensic bench dressing. Marked noFit so the camera still frames the subject, not the props. */
export function LabBench({ kind, radius }: { kind: 'figure' | 'specimen'; radius: number }) {
  const tier = useTier()
  const low = tier === 'low'
  const mats = useBenchMaterials()
  const geos = useMemo(() => (kind === 'figure' ? figureBench() : specimenBench(radius, low ? 28 : 48)), [kind, radius, low])
  useEffect(
    () => () => {
      geos.metal.dispose()
      geos.cyan.dispose()
      geos.warm.dispose()
    },
    [geos],
  )
  const shadow = TIER_CONFIG[tier].contactShadow
  return (
    <group userData={{ noFit: true }}>
      <mesh geometry={geos.metal} material={mats.metal} />
      <mesh geometry={geos.cyan} material={mats.cyan} />
      {kind === 'figure' ? <mesh geometry={geos.warm} material={mats.warm} /> : null}
      {shadow ? (
        <ContactShadow position={[0, 0.012, kind === 'figure' ? 0.05 : 0]} radius={kind === 'figure' ? 1.45 : radius * 0.72} opacity={0.55} />
      ) : null}
    </group>
  )
}
