import { useEffect, useMemo } from 'react'
import * as THREE from 'three/webgpu'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import {
  abs,
  color,
  float,
  fract,
  fwidth,
  hash,
  instanceIndex,
  length,
  max,
  min,
  mix,
  normalize,
  mod,
  oneMinus,
  positionWorld,
  pow,
  saturate,
  sin,
  smoothstep,
  time,
  uv,
  vec2,
  vec3,
} from 'three/tsl'
import { TIER_CONFIG, type Tier } from '../../state/quality'

/** Soft radial gradient used for glows and contact shadows. */
export function makeRadialTexture(inner = 'rgba(0,0,0,0.85)', outer = 'rgba(0,0,0,0)'): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grad.addColorStop(0, inner)
  grad.addColorStop(1, outer)
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** Soft blob under an object. Only mounted on High and Ultra. */
export function ContactShadow({
  position,
  radius,
  opacity = 0.7,
}: {
  position: [number, number, number]
  radius: number
  opacity?: number
}) {
  const tex = useMemo(() => makeRadialTexture(), [])
  const mat = useMemo(() => {
    const m = new THREE.MeshBasicNodeMaterial()
    m.map = tex
    m.transparent = true
    m.depthWrite = false
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
      <planeGeometry args={[radius * 2, radius * 2]} />
      <primitive object={mat} attach="material" />
    </mesh>
  )
}

/** Subtle floor grid: thin cyan lines with major lines every 5 cells, fading with distance. */
export function GridFloor({
  y = 0,
  size = 80,
  fade = 22,
  intensity = 0.7,
  tint = '#3ee6ff',
}: {
  y?: number
  size?: number
  fade?: number
  intensity?: number
  tint?: string
}) {
  const mat = useMemo(() => {
    const p = positionWorld.xz
    // Anti-aliased lines: distance to the nearest grid line in cell units, divided by its screen derivative.
    const line = (scale: number, px: number) => {
      const q = p.div(scale)
      const d = abs(fract(q.sub(0.5)).sub(0.5))
      const aa = d.div(fwidth(q).mul(px))
      return oneMinus(min(min(aa.x, aa.y), float(1)))
    }
    const lines = max(line(1, 0.9).mul(0.28), line(5, 1.4).mul(0.9))
    const dist = length(p)
    const falloff = oneMinus(smoothstep(float(fade * 0.12), float(fade), dist))
    const pulse = float(0.8).add(sin(dist.mul(0.45).sub(time.mul(0.9))).mul(0.2))
    const m = new THREE.MeshBasicNodeMaterial()
    m.colorNode = color(tint).mul(lines.mul(falloff).mul(pulse).mul(intensity))
    m.opacityNode = saturate(lines.mul(falloff))
    m.transparent = true
    m.blending = THREE.AdditiveBlending
    m.depthWrite = false
    return m
  }, [fade, intensity, tint])
  useEffect(() => () => mat.dispose(), [mat])
  return (
    <mesh position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[size, size]} />
      <primitive object={mat} attach="material" />
    </mesh>
  )
}

/** Inside-out sky dome: navy gradient with a faint cyan haze at the horizon so silhouettes read. */
export function Backdrop() {
  const mat = useMemo(() => {
    const h = normalize(positionWorld).y
    const horizon = pow(oneMinus(saturate(abs(h).mul(2.2))), float(3))
    const base = mix(color('#0a1426'), color('#060a14'), saturate(h.mul(1.6)))
    const m = new THREE.MeshBasicNodeMaterial()
    m.colorNode = base.add(color('#1b6a86').mul(horizon.mul(0.3)))
    m.side = THREE.BackSide
    m.fog = false
    m.depthWrite = false
    return m
  }, [])
  useEffect(() => () => mat.dispose(), [mat])
  return (
    <mesh renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[90, 32, 16]} />
      <primitive object={mat} attach="material" />
    </mesh>
  )
}

/** Dark reflective-looking deck plate under everything. */
export function DeckPlate({ y = -0.02, radius = 40 }: { y?: number; radius?: number }) {
  return (
    <mesh position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[radius, 64]} />
      <meshStandardMaterial color="#0a1424" roughness={0.55} metalness={0.5} />
    </mesh>
  )
}

/** GPU-animated drifting dust motes: one instanced draw call, motion computed from the instance id. */
export function Dust({
  tier,
  spread = [26, 8, 26],
  baseY = 0,
  tint = '#9fefff',
  size = 0.05,
}: {
  tier: Tier
  spread?: [number, number, number]
  baseY?: number
  tint?: string
  size?: number
}) {
  const count = TIER_CONFIG[tier].particles
  const { geo, mat } = useMemo(() => {
    const id = instanceIndex.toFloat()
    const r1 = hash(instanceIndex)
    const r2 = hash(instanceIndex.add(7919))
    const r3 = hash(instanceIndex.add(15881))
    const r4 = hash(instanceIndex.add(30011))
    const r5 = hash(instanceIndex.add(65537))
    const [sx, sy, sz] = spread
    const rise = mod(r2.mul(sy).add(time.mul(float(0.05).add(r4.mul(0.12)))), float(sy))
    const px = r1.sub(0.5).mul(sx).add(sin(time.mul(0.15).add(id)).mul(0.6))
    const pz = r3.sub(0.5).mul(sz).add(sin(time.mul(0.12).add(id.mul(1.7))).mul(0.6))
    const pos = vec3(px, rise.add(baseY), pz)
    const m = new THREE.SpriteNodeMaterial()
    m.positionNode = pos
    m.scaleNode = vec2(float(size).mul(r5.mul(0.9).add(0.4)))
    const soft = oneMinus(smoothstep(0.0, 0.5, length(uv().sub(0.5))))
    const twinkle = float(0.55).add(sin(time.mul(r4.mul(2).add(0.6)).add(id)).mul(0.45))
    m.colorNode = color(tint).mul(1.6)
    m.opacityNode = pow(soft, float(2)).mul(twinkle).mul(0.9)
    m.transparent = true
    m.blending = THREE.AdditiveBlending
    m.depthWrite = false
    const g = new THREE.PlaneGeometry(1, 1)
    return { geo: g, mat: m }
  }, [spread, baseY, tint, size])
  useEffect(
    () => () => {
      geo.dispose()
      mat.dispose()
    },
    [geo, mat],
  )
  return <instancedMesh key={count} args={[geo, mat, count]} frustumCulled={false} />
}

/** Standard deck lighting: cool fill, cyan key, amber rim from behind. */
export function DeckLights({ rim = 1 }: { rim?: number }) {
  return (
    <>
      <hemisphereLight args={['#6aa8ff', '#0a1220', 0.75]} />
      <directionalLight position={[5, 9, 6]} intensity={1.5} color="#bfe9ff" />
      <pointLight position={[-7, 4, -6]} intensity={28 * rim} color="#ffb547" distance={28} decay={2} />
      <pointLight position={[7, 3, -5]} intensity={26 * rim} color="#3ee6ff" distance={28} decay={2} />
    </>
  )
}

/** Ring of dark console blocks with emissive trim. Bodies and trim are baked into two merged meshes (2 draw calls). */
export function ConsoleRing({ radius = 15, count = 18, arc = Math.PI * 1.25, tint = '#3ee6ff' }: {
  radius?: number
  count?: number
  arc?: number
  tint?: string
}) {
  const { bodyGeo, trimGeo, trim, body } = useMemo(() => {
    const rnd = (n: number) => {
      const x = Math.sin(n * 127.1) * 43758.5453
      return x - Math.floor(x)
    }
    const bodies: THREE.BufferGeometry[] = []
    const trims: THREE.BufferGeometry[] = []
    const m = new THREE.Matrix4()
    const start = -Math.PI / 2 - arc / 2
    for (let i = 0; i < count; i++) {
      const a = start + (i / (count - 1)) * arc
      const h = 0.9 + rnd(i + 1) * 2.4
      const w = 1.6 + rnd(i + 31) * 1.8
      const d = 1.4
      const place = new THREE.Matrix4().makeRotationY(-a + Math.PI / 2).setPosition(Math.cos(a) * radius, h / 2, Math.sin(a) * radius)
      bodies.push(new THREE.BoxGeometry(w, h, d).applyMatrix4(place))
      m.makeTranslation(0, h / 2 + 0.02, d / 2 - 0.05)
      trims.push(new THREE.BoxGeometry(w * 0.92, 0.05, 0.05).applyMatrix4(m.premultiply(place)))
    }
    const bodyGeo = mergeGeometries(bodies)!
    const trimGeo = mergeGeometries(trims)!
    bodies.forEach((g) => g.dispose())
    trims.forEach((g) => g.dispose())
    const trim = new THREE.MeshBasicNodeMaterial()
    trim.colorNode = color(tint).mul(2.2)
    const body = new THREE.MeshStandardNodeMaterial({ color: '#17294a', roughness: 0.45, metalness: 0.55 })
    return { bodyGeo, trimGeo, trim, body }
  }, [radius, count, arc, tint])
  useEffect(
    () => () => {
      bodyGeo.dispose()
      trimGeo.dispose()
      trim.dispose()
      body.dispose()
    },
    [bodyGeo, trimGeo, trim, body],
  )
  return (
    <group>
      <mesh geometry={bodyGeo} material={body} />
      <mesh geometry={trimGeo} material={trim} />
    </group>
  )
}
