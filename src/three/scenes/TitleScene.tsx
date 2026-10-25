import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three/webgpu'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import {
  abs,
  color,
  float,
  fract,
  hash,
  instanceIndex,
  normalLocal,
  step,
  positionGeometry,
  positionWorld,
  pow,
  saturate,
  sin,
  smoothstep,
  time,
} from 'three/tsl'
import { resolveTier, TIER_CONFIG } from '../../state/quality'
import { useRuntime } from '../../state/runtime'
import { useGame } from '../../state/store'
import { layoutWord } from '../data/letters'
import { createHologramMaterial } from '../materials/hologram'
import { Backdrop, ConsoleRing, ContactShadow, DeckLights, DeckPlate, Dust, GridFloor, makeRadialTexture } from './common'

const CUBE = 0.33
const LOGO_BASE_Y = 1.05

function LogoLetters() {
  const { geo, mat, voxels } = useMemo(() => {
    const voxels = layoutWord('ANOMALY', 1, 2)
    const geo = new RoundedBoxGeometry(1, 1, 1, 3, 0.1)

    const m = new THREE.MeshStandardNodeMaterial()
    m.color = new THREE.Color('#091526')
    m.roughness = 0.38
    m.metalness = 0.55
    // Glowing cube edges: bright where two box axes are near their extremes.
    const a = abs(positionGeometry).mul(2)
    const ex = smoothstep(0.74, 0.93, a.x)
    const ey = smoothstep(0.74, 0.93, a.y)
    const ez = smoothstep(0.74, 0.93, a.z)
    const edge = saturate(ex.mul(ey).add(ey.mul(ez)).add(ex.mul(ez)))
    // A bright band that travels across the whole word.
    const band = pow(fract(positionWorld.x.mul(0.055).sub(time.mul(0.12))), float(26))
    const seed = hash(instanceIndex)
    const pulse = float(0.82).add(sin(time.mul(1.4).add(seed.mul(6.283))).mul(0.18))
    // Front faces carry a solid glow so the letters read as shapes, not just outlines.
    const front = step(0.85, normalLocal.z).mul(float(0.42).add(sin(time.mul(0.9).add(seed.mul(6.283))).mul(0.06)))
    const face = float(0.08).add(front)
    m.emissiveNode = color('#3ee6ff').mul(edge.mul(2.6).add(face).add(band.mul(1.8)).mul(pulse))
    return { geo, mat: m, voxels }
  }, [])

  const ref = useRef<THREE.InstancedMesh>(null)
  useEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const m4 = new THREE.Matrix4()
    const gap = 0.95
    voxels.forEach((v, i) => {
      m4.compose(
        new THREE.Vector3(v.x * CUBE, v.y * CUBE, v.z * CUBE),
        new THREE.Quaternion(),
        new THREE.Vector3(CUBE * gap, CUBE * gap, CUBE * gap * 1.9),
      )
      mesh.setMatrixAt(i, m4)
    })
    mesh.instanceMatrix.needsUpdate = true
  }, [voxels])
  useEffect(
    () => () => {
      geo.dispose()
      mat.dispose()
    },
    [geo, mat],
  )
  return <instancedMesh ref={ref} args={[geo, mat, voxels.length]} frustumCulled={false} />
}

function LogoGlow({ y }: { y: number }) {
  const tex = useMemo(() => makeRadialTexture('rgba(62,230,255,0.22)', 'rgba(62,230,255,0)'), [])
  const mat = useMemo(() => {
    const m = new THREE.MeshBasicNodeMaterial()
    m.map = tex
    m.transparent = true
    m.blending = THREE.AdditiveBlending
    m.depthWrite = false
    m.opacity = 0.8
    return m
  }, [tex])
  return (
    <mesh position={[0, y, -0.9]}>
      <planeGeometry args={[20, 7]} />
      <primitive object={mat} attach="material" />
    </mesh>
  )
}

function HoloRings() {
  const a = useRef<THREE.Mesh>(null)
  const b = useRef<THREE.Mesh>(null)
  const reduced = useGame((s) => s.settings.reducedMotion)
  const mats = useMemo(
    () => [
      createHologramMaterial({ opacity: 0.8, intensity: 1.2, scanDensity: 10, fresnelPower: 1.4 }),
      createHologramMaterial({ color: '#ffb547', opacity: 0.7, intensity: 1.0, scanDensity: 14, fresnelPower: 1.4 }),
    ],
    [],
  )
  useFrame((_, dt) => {
    if (reduced) return
    if (a.current) a.current.rotation.z += dt * 0.12
    if (b.current) b.current.rotation.z -= dt * 0.08
  })
  return (
    <group position={[0, LOGO_BASE_Y + 1.3, -2.2]}>
      <mesh ref={a} rotation={[0, 0, 0]}>
        <torusGeometry args={[5.6, 0.03, 8, 160]} />
        <primitive object={mats[0]} attach="material" />
      </mesh>
      <mesh ref={b}>
        <torusGeometry args={[6.3, 0.022, 8, 160, Math.PI * 1.4]} />
        <primitive object={mats[1]} attach="material" />
      </mesh>
    </group>
  )
}

export default function TitleScene() {
  const reduced = useGame((s) => s.settings.reducedMotion)
  const quality = useGame((s) => s.settings.quality)
  const autoTier = useRuntime((s) => s.autoTier)
  const tier = resolveTier(quality, autoTier)
  const start = useRef(performance.now())

  useFrame((state) => {
    const t = (performance.now() - start.current) / 1000
    const cam = state.camera
    const intro = reduced ? 1 : 1 - Math.pow(1 - Math.min(1, t / 3), 3)
    const orbit = reduced ? 0.1 : Math.sin(t * 0.11) * 0.32
    const radius = 16 + (1 - intro) * 7
    const height = 2.2 + Math.sin(t * 0.07) * (reduced ? 0 : 0.5) + (1 - intro) * 2
    cam.position.set(Math.sin(orbit) * radius, height, Math.cos(orbit) * radius)
    cam.lookAt(0, LOGO_BASE_Y + 1.0, 0)
  })

  return (
    <>
      <fogExp2 attach="fog" args={['#070c17', 0.018]} />
      <DeckLights />
      <Backdrop />
      <DeckPlate />
      <GridFloor fade={34} />
      <ConsoleRing radius={17} count={20} arc={Math.PI * 1.3} />
      <group position={[0, LOGO_BASE_Y, 0]}>
        <LogoLetters />
      </group>
      <LogoGlow y={LOGO_BASE_Y + 1.3} />
      <HoloRings />
      {TIER_CONFIG[tier].contactShadow ? <ContactShadow position={[0, 0.01, 0]} radius={9} opacity={0.6} /> : null}
      <Dust tier={tier} spread={[34, 10, 34]} baseY={0.2} />
    </>
  )
}
