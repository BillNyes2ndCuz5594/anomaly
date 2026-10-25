import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three/webgpu'
import {
  atan,
  color,
  float,
  fract,
  fwidth,
  length,
  max,
  min,
  oneMinus,
  positionLocal,
  pow,
  saturate,
  sin,
  smoothstep,
  step,
  time,
  uv,
  vec3,
} from 'three/tsl'
import { FLORIDA_LONLAT, lonLatToXZ, MAP_PINGS } from '../../data/florida'
import { createHologramMaterial, HOLO_CYAN } from '../../materials/hologram'

export const TABLE_RADIUS = 3.7
export const TABLE_TOP_Y = 1.0
const TAU = Math.PI * 2

/** Radar face of the table: faint cartesian grid, range rings, bezel ticks, rotating sweep. */
function RadarFace() {
  const mat = useMemo(() => {
    const p = positionLocal.xy.div(TABLE_RADIUS)
    const r = length(p)
    const ang = atan(p.y, p.x).div(TAU).add(0.5)

    const ringAt = (c: number, w = 1.2) => oneMinus(min(r.sub(c).abs().div(fwidth(r).mul(w)), float(1)))
    const rings = max(max(ringAt(0.34, 0.8).mul(0.35), ringAt(0.67, 0.8).mul(0.35)), ringAt(0.965, 1.6).mul(1.1))

    const q = p.mul(TABLE_RADIUS * 1.6)
    const gd = fract(q.sub(0.5)).sub(0.5).abs().div(fwidth(q))
    const grid = oneMinus(min(min(gd.x, gd.y), float(1))).mul(0.14)

    const tick = step(0.7, fract(ang.mul(120))).mul(step(0.9, r)).mul(step(r, 0.945)).mul(0.9)
    const bigTick = step(0.93, fract(ang.mul(12))).mul(step(0.86, r)).mul(step(r, 0.945)).mul(1.2)

    // Sweep: a trailing wedge behind a bright leading line.
    const a = fract(ang.sub(time.mul(0.1)))
    const sweep = pow(oneMinus(a), float(10)).mul(0.14).mul(step(r, 0.955))

    const inside = oneMinus(smoothstep(0.965, 0.98, r))
    const glow = float(0.04).add(grid).add(rings).add(tick).add(bigTick).add(sweep)
    const m = new THREE.MeshBasicNodeMaterial()
    m.colorNode = color(HOLO_CYAN).mul(glow.mul(1.5))
    m.opacityNode = saturate(glow.mul(1.4)).mul(inside)
    m.transparent = true
    m.blending = THREE.AdditiveBlending
    m.depthWrite = false
    return m
  }, [])
  useEffect(() => () => mat.dispose(), [mat])
  return (
    <mesh position={[0, TABLE_TOP_Y + 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[TABLE_RADIUS, 96]} />
      <primitive object={mat} attach="material" />
    </mesh>
  )
}

/** Expanding ring ping on the map, one per city. Pure TSL, no per-frame JS. */
function Ping({ x, z, seed, hot }: { x: number; z: number; seed: number; hot?: boolean }) {
  const mat = useMemo(() => {
    const d = length(uv().sub(0.5)).mul(2)
    const t = fract(time.mul(0.35).add(seed))
    const ring = oneMinus(min(d.sub(t).abs().div(0.07), float(1))).mul(oneMinus(t))
    const dot = oneMinus(smoothstep(0.05, 0.12, d))
    const m = new THREE.MeshBasicNodeMaterial()
    const c = color(hot ? '#ffb547' : HOLO_CYAN)
    m.colorNode = c.mul(ring.add(dot).mul(2))
    m.opacityNode = saturate(ring.add(dot))
    m.transparent = true
    m.blending = THREE.AdditiveBlending
    m.depthWrite = false
    return m
  }, [seed, hot])
  useEffect(() => () => mat.dispose(), [mat])
  return (
    <mesh position={[x, TABLE_TOP_Y + 0.3, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[hot ? 0.9 : 0.6, hot ? 0.9 : 0.6]} />
      <primitive object={mat} attach="material" />
    </mesh>
  )
}

/** Stylized Florida: solid slab, hologram skin floating just above, glowing outline, city pings. */
function Florida() {
  const { slab, skin, outline } = useMemo(() => {
    const shape = new THREE.Shape()
    FLORIDA_LONLAT.forEach(([lon, lat], i) => {
      const [x, z] = lonLatToXZ(lon, lat)
      if (i === 0) shape.moveTo(x, -z)
      else shape.lineTo(x, -z)
    })
    shape.closePath()
    const slabGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.02, bevelSegments: 2 })
    const skinGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.2, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.01, bevelSegments: 1 })
    slabGeo.rotateX(-Math.PI / 2)
    skinGeo.rotateX(-Math.PI / 2)
    const pts = shape.getPoints().map((v) => new THREE.Vector3(v.x, 0, -v.y))
    pts.push(pts[0].clone())
    const outlineGeo = new THREE.BufferGeometry().setFromPoints(pts)
    return { slab: slabGeo, skin: skinGeo, outline: outlineGeo }
  }, [])
  const holo = useMemo(
    () => createHologramMaterial({ opacity: 0.55, intensity: 0.6, scanDensity: 38, scanSpeed: 0.12, fresnelPower: 1.6, sweep: 0.6 }),
    [],
  )
  const line = useMemo(() => {
    const m = new THREE.LineBasicNodeMaterial()
    m.colorNode = vec3(0.24, 0.9, 1).mul(sin(time.mul(1.2)).mul(0.25).add(2.2))
    return m
  }, [])
  const outlineLine = useMemo(() => new THREE.Line(outline, line), [outline, line])
  useEffect(
    () => () => {
      slab.dispose()
      skin.dispose()
      outline.dispose()
      holo.dispose()
      line.dispose()
    },
    [slab, skin, outline, holo, line],
  )
  return (
    <group position={[0, TABLE_TOP_Y, 0]}>
      <mesh geometry={slab} position={[0, 0.02, 0]}>
        <meshStandardMaterial color="#0e2a40" roughness={0.45} metalness={0.4} emissive="#0a4660" emissiveIntensity={0.7} />
      </mesh>
      <mesh geometry={skin} position={[0, 0.2, 0]}>
        <primitive object={holo} attach="material" />
      </mesh>
      <primitive object={outlineLine} position={[0, 0.41, 0]} />
      {MAP_PINGS.map((c, i) => {
        const [x, z] = lonLatToXZ(c.lon, c.lat)
        return <Ping key={c.name} x={x} z={z} seed={i * 0.17} hot={c.name === 'Fort Pierce'} />
      })}
    </group>
  )
}

const PLANET_ANGLE = 2.55

/** Orbiting planet with a ring, and a small moon. A hint of the space cases. */
function Planet({ reduced }: { reduced: boolean }) {
  const orbit = useRef<THREE.Group>(null)
  const moon = useRef<THREE.Group>(null)
  const planetMat = useMemo(
    () => createHologramMaterial({ color: '#ffb547', opacity: 0.9, intensity: 1.1, scanDensity: 28, fresnelPower: 1.8 }),
    [],
  )
  const ringMat = useMemo(
    () => createHologramMaterial({ color: '#ffd9a0', opacity: 0.7, intensity: 0.9, scanDensity: 6, fresnelPower: 0.8, sweep: 0 }),
    [],
  )
  const moonMat = useMemo(
    () => createHologramMaterial({ color: HOLO_CYAN, opacity: 0.9, intensity: 1.2, scanDensity: 34, fresnelPower: 1.6 }),
    [],
  )
  const trail = useMemo(() => createHologramMaterial({ opacity: 0.5, intensity: 0.7, scanDensity: 3, sweep: 0 }), [])
  useFrame((state, dt) => {
    if (reduced) return
    // The planet drifts along a short arc in the upper left sky, clear of the case labels and the panel.
    if (orbit.current) orbit.current.rotation.y = PLANET_ANGLE + Math.sin(state.clock.elapsedTime * 0.18) * 0.16
    if (moon.current) moon.current.rotation.y += dt * 0.7
  })
  return (
    <group position={[0, TABLE_TOP_Y + 1.35, -0.4]} rotation={[0.1, 0, -0.08]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[TABLE_RADIUS - 0.6, 0.012, 6, 128]} />
        <primitive object={trail} attach="material" />
      </mesh>
      <group ref={orbit} rotation={[0, PLANET_ANGLE, 0]}>
        <group position={[TABLE_RADIUS - 0.6, 0, 0]}>
          <mesh>
            <sphereGeometry args={[0.3, 32, 20]} />
            <primitive object={planetMat} attach="material" />
          </mesh>
          <mesh rotation={[1.3, 0.0, -0.3]}>
            <ringGeometry args={[0.4, 0.62, 64]} />
            <primitive object={ringMat} attach="material" />
          </mesh>
          <group ref={moon} rotation={[0, reduced ? 1 : 0, 0]}>
            <mesh position={[0.95, 0.12, 0]}>
              <sphereGeometry args={[0.1, 20, 14]} />
              <primitive object={moonMat} attach="material" />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  )
}

export default function MapTable({ reduced }: { reduced: boolean }) {
  const trim = useMemo(() => {
    const m = new THREE.MeshBasicNodeMaterial()
    m.colorNode = color(HOLO_CYAN).mul(1.5)
    return m
  }, [])
  const amberTrim = useMemo(() => {
    const m = new THREE.MeshBasicNodeMaterial()
    m.colorNode = color('#ffb547').mul(2.2)
    return m
  }, [])
  useEffect(
    () => () => {
      trim.dispose()
      amberTrim.dispose()
    },
    [trim, amberTrim],
  )
  return (
    <group>
      {/* pedestal */}
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[1.5, 2.0, 1.0, 48]} />
        <meshStandardMaterial color="#0f1c33" roughness={0.45} metalness={0.7} />
      </mesh>
      <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.05, 0.03, 8, 96]} />
        <primitive object={trim} attach="material" />
      </mesh>
      <mesh position={[0, 0.55, 0]}>
        <cylinderGeometry args={[1.62, 1.62, 0.05, 48]} />
        <primitive object={amberTrim} attach="material" />
      </mesh>
      {/* top plate */}
      <mesh position={[0, TABLE_TOP_Y - 0.1, 0]}>
        <cylinderGeometry args={[TABLE_RADIUS + 0.12, TABLE_RADIUS - 0.2, 0.2, 96]} />
        <meshStandardMaterial color="#12233d" roughness={0.4} metalness={0.75} />
      </mesh>
      <mesh position={[0, TABLE_TOP_Y + 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[TABLE_RADIUS, 96]} />
        <meshStandardMaterial color="#071426" roughness={0.3} metalness={0.5} />
      </mesh>
      <mesh position={[0, TABLE_TOP_Y + 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[TABLE_RADIUS + 0.05, 0.035, 8, 128]} />
        <primitive object={trim} attach="material" />
      </mesh>
      <RadarFace />
      <Florida />
      <Planet reduced={reduced} />
    </group>
  )
}
