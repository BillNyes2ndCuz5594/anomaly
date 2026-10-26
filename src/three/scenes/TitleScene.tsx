import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three/webgpu'
import {
  abs,
  color,
  float,
  fract,
  normalLocal,
  oneMinus,
  positionGeometry,
  pow,
  smoothstep,
  time,
} from 'three/tsl'
import { resolveTier, TIER_CONFIG } from '../../state/quality'
import { useRuntime } from '../../state/runtime'
import { useGame } from '../../state/store'
import { layoutLogo } from '../data/logoShapes'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { createHologramMaterial } from '../materials/hologram'
import { useWidthFit } from './case/common'
import { Backdrop, ConsoleRing, ContactShadow, DeckLights, DeckPlate, Dust, GridFloor, makeRadialTexture } from './common'

const LOGO_BASE_Y = 1.05
const LOGO_H = 2.3

/** Beveled outline letters, merged into one mesh: dark metal body, glowing bevel edges, a slow light sweep. */
function LogoLetters({ reduced }: { reduced: boolean }) {
  const { geo, mat, width } = useMemo(() => {
    const { glyphs, width } = layoutLogo('ANOMALY')
    const parts = glyphs.map((g) => {
      const shape = new THREE.Shape(g.outline.map(([x, y]) => new THREE.Vector2(x, y)))
      for (const h of g.holes) shape.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))))
      const eg = new THREE.ExtrudeGeometry(shape, {
        depth: 0.16,
        bevelEnabled: true,
        bevelThickness: 0.02,
        bevelSize: 0.02,
        bevelSegments: 2,
        curveSegments: 4,
      })
      eg.translate(g.x, 0, -0.08)
      return eg
    })
    const geo = mergeGeometries(parts)!
    parts.forEach((g) => g.dispose())

    const m = new THREE.MeshStandardNodeMaterial()
    m.color = new THREE.Color('#0b1a2e')
    m.roughness = 0.3
    m.metalness = 0.7
    const nz = abs(normalLocal.z)
    const bevel = smoothstep(0.1, 0.4, nz).mul(oneMinus(smoothstep(0.82, 0.97, nz)))
    const front = smoothstep(0.9, 0.99, normalLocal.z)
    const sweepPos = positionGeometry.x.mul(0.17).add(positionGeometry.y.mul(0.22))
    const phase = reduced ? float(0.35) : time.mul(0.13)
    const band = pow(oneMinus(abs(fract(sweepPos.sub(phase)).sub(0.5)).mul(2)), float(14))
    const fill = float(0.26).add(positionGeometry.y.mul(0.22))
    const glow = bevel.mul(3.4).add(front.mul(fill)).add(band.mul(front.mul(1.2).add(bevel.mul(2.2)).add(0.15)))
    m.emissiveNode = color('#3ee6ff').mul(glow)
    return { geo, mat: m, width }
  }, [reduced])

  useEffect(
    () => () => {
      geo.dispose()
      mat.dispose()
    },
    [geo, mat],
  )
  const w = width * LOGO_H
  return (
    <group>
      <mesh geometry={geo} material={mat} scale={[LOGO_H, LOGO_H, LOGO_H * 1.4]} />
      <UnderlineBar width={w} y={-0.3} />
    </group>
  )
}

/** Thin amber rule with end ticks under the logo. */
function UnderlineBar({ width, y }: { width: number; y: number }) {
  const mat = useMemo(() => {
    const m = new THREE.MeshBasicNodeMaterial()
    m.colorNode = color('#ffb547').mul(2.4)
    return m
  }, [])
  useEffect(() => () => mat.dispose(), [mat])
  return (
    <group position={[0, y, 0]}>
      <mesh material={mat}>
        <boxGeometry args={[width, 0.035, 0.05]} />
      </mesh>
      <mesh material={mat} position={[-width / 2, 0.1, 0]}>
        <boxGeometry args={[0.035, 0.24, 0.05]} />
      </mesh>
      <mesh material={mat} position={[width / 2, 0.1, 0]}>
        <boxGeometry args={[0.035, 0.24, 0.05]} />
      </mesh>
    </group>
  )
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
  // The logo is wider than a phone held upright: widen the view and back the camera off until it fits.
  const logoHalf = useMemo(() => (layoutLogo('ANOMALY').width * LOGO_H) / 2, [])
  const fit = useWidthFit(logoHalf * 1.04, 16, 66, 0.2)

  useFrame((state) => {
    const t = (performance.now() - start.current) / 1000
    const cam = state.camera
    const intro = reduced ? 1 : 1 - Math.pow(1 - Math.min(1, t / 3), 3)
    const orbit = reduced ? 0.1 : Math.sin(t * 0.11) * 0.32
    const radius = 16 + (1 - intro) * 7
    const height = 2.2 + Math.sin(t * 0.07) * (reduced ? 0 : 0.5) + (1 - intro) * 2
    const k = fit.current
    const aimY = LOGO_BASE_Y + 1.0
    cam.position.set(Math.sin(orbit) * radius * k, aimY + (height - aimY) * k, Math.cos(orbit) * radius * k)
    cam.lookAt(0, aimY, 0)
    const fog = state.scene.fog as THREE.FogExp2 | null
    if (fog) fog.density = 0.018 / k
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
        <LogoLetters reduced={reduced} />
      </group>
      <LogoGlow y={LOGO_BASE_Y + 1.3} />
      <HoloRings />
      {TIER_CONFIG[tier].contactShadow ? <ContactShadow position={[0, 0.01, 0]} radius={9} opacity={0.6} /> : null}
      <Dust tier={tier} spread={[34, 10, 34]} baseY={0.2} />
    </>
  )
}
