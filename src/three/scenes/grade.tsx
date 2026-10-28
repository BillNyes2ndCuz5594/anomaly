import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three/webgpu'
import { color, float, length, oneMinus, positionLocal, saturate, sin, smoothstep, time, uv } from 'three/tsl'
import { makeRadialTexture } from './common'

/**
 * Key from the upper front, cool rim from behind. Sits on top of the shared deck fill
 * so the logo, table and drone pick up a direction instead of a flat wash.
 */
export function SubjectLights({ strength = 1 }: { strength?: number }) {
  return (
    <>
      <directionalLight position={[3.4, 8.2, 6.6]} intensity={1.35 * strength} color="#f3f6ff" />
      <directionalLight position={[-7.2, 3.1, -6.4]} intensity={0.85 * strength} color="#6adfff" />
    </>
  )
}

/** Soft pool on the deck so the floor under a subject is not an empty gradient. */
export function FloorPool({
  position,
  radius = 6,
  inner = 'rgba(62,230,255,0.22)',
  opacity = 0.55,
}: {
  position: [number, number, number]
  radius?: number
  inner?: string
  opacity?: number
}) {
  const tex = useMemo(() => makeRadialTexture(inner, 'rgba(62,230,255,0)'), [inner])
  const mat = useMemo(() => {
    const m = new THREE.MeshBasicNodeMaterial()
    m.map = tex
    m.transparent = true
    m.depthWrite = false
    m.blending = THREE.AdditiveBlending
    m.opacity = opacity
    return m
  }, [tex, opacity])
  useEffect(
    () => () => {
      tex.dispose()
      mat.dispose()
    },
    [tex, mat],
  )
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]} renderOrder={-1}>
      <circleGeometry args={[radius, 48]} />
      <primitive object={mat} attach="material" />
    </mesh>
  )
}

/** Wide horizon band behind the title, so the upper frame is air and not a flat void. Skipped on low. */
export function SkyBand({ calm }: { calm: boolean }) {
  const mat = useMemo(() => {
    const m = new THREE.MeshBasicNodeMaterial()
    const v = uv().y
    const band = smoothstep(0.02, 0.42, v).mul(oneMinus(smoothstep(0.48, 0.96, v)))
    const breathe = calm ? float(1) : float(0.9).add(sin(time.mul(0.12)).mul(0.1))
    m.colorNode = color('#1a4d62').mul(band.mul(breathe).mul(0.85))
    m.opacityNode = saturate(band.mul(0.42))
    m.transparent = true
    m.depthWrite = false
    m.fog = false
    m.blending = THREE.AdditiveBlending
    return m
  }, [calm])
  useEffect(() => () => mat.dispose(), [mat])
  return (
    <mesh position={[0, 5.4, -18]} renderOrder={-2}>
      <planeGeometry args={[52, 16]} />
      <primitive object={mat} attach="material" />
    </mesh>
  )
}

/** Small night body and a soft glow, parked in the empty upper sky. The ring is medium and up. */
export function NightBody({
  position,
  calm,
  rich,
}: {
  position: [number, number, number]
  calm: boolean
  rich: boolean
}) {
  const spin = useRef<THREE.Group>(null)
  const glow = useRef<THREE.Mesh>(null)
  const tex = useMemo(() => makeRadialTexture('rgba(186,230,255,0.55)', 'rgba(186,230,255,0)'), [])
  const glowMat = useMemo(() => {
    const m = new THREE.MeshBasicNodeMaterial()
    m.map = tex
    m.transparent = true
    m.depthWrite = false
    m.fog = false
    m.blending = THREE.AdditiveBlending
    m.opacity = rich ? 0.42 : 0.32
    return m
  }, [tex, rich])
  useEffect(
    () => () => {
      tex.dispose()
      glowMat.dispose()
    },
    [tex, glowMat],
  )
  useFrame(({ camera }, dt) => {
    if (spin.current && !calm) spin.current.rotation.y += dt * 0.04
    if (glow.current) glow.current.quaternion.copy(camera.quaternion)
  })
  return (
    <group position={position}>
      <mesh ref={glow} scale={[rich ? 3.4 : 2.4, rich ? 3.4 : 2.4, 1]}>
        <planeGeometry args={[1, 1]} />
        <primitive object={glowMat} attach="material" />
      </mesh>
      <group ref={spin}>
        <mesh>
          <sphereGeometry args={[0.55, 24, 16]} />
          <meshStandardMaterial color="#d5dde6" roughness={0.82} metalness={0.08} />
        </mesh>
        {rich ? (
          <mesh rotation={[1.15, 0.15, 0.35]}>
            <ringGeometry args={[0.82, 1.08, 40]} />
            <meshBasicMaterial color="#9fd4ea" transparent opacity={0.45} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        ) : null}
      </group>
    </group>
  )
}

/** Faint column over the map table so the hologram has height, not only a disc. Medium and up. */
export function VolumeColumn({
  position,
  radius,
  height,
  calm,
}: {
  position: [number, number, number]
  radius: number
  height: number
  calm: boolean
}) {
  const mat = useMemo(() => {
    const m = new THREE.MeshBasicNodeMaterial()
    const y = saturate(positionLocal.y.add(height * 0.5).div(height))
    const radial = length(positionLocal.xz).div(radius)
    const body = oneMinus(smoothstep(0.15, 1, radial)).mul(oneMinus(smoothstep(0.05, 0.92, y)))
    const breathe = calm ? float(0.65) : float(0.5).add(sin(time.mul(0.65)).mul(0.15))
    m.colorNode = color('#3ee6ff').mul(body.mul(breathe).mul(1.3))
    m.opacityNode = saturate(body.mul(0.22))
    m.transparent = true
    m.depthWrite = false
    m.blending = THREE.AdditiveBlending
    m.side = THREE.DoubleSide
    return m
  }, [calm, height, radius])
  useEffect(() => () => mat.dispose(), [mat])
  return (
    <mesh position={position}>
      <cylinderGeometry args={[radius, radius * 0.72, height, 20, 1, true]} />
      <primitive object={mat} attach="material" />
    </mesh>
  )
}
