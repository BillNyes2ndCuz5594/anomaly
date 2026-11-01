import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three/webgpu'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { tintedHolo } from '../../materials/tinted'
import { STILL } from '../../../lib/flags'
import { makeRadialTexture } from '../common'
import { CameraRig, LabEnvironment, Pedestal, useReduced, useTier } from './common'

// Evidence locker: a wall of cubbies, each holding a hologram canister with a sample floating inside.
// A scan beam sweeps across the wall. Canisters flare as it passes. Okabe-Ito tints, one per theme.
const COLS = 6
const ROWS = 4
const CELL_W = 1.8
const CELL_H = 1.3
const WALL_Z = -2.2
const BASE_Y = 0.55
const TINTS = ['#3ee6ff', '#E69F00', '#009E73', '#CC79A7']
const WALL_W = COLS * CELL_W
const WALL_H = ROWS * CELL_H

interface Cell {
  x: number
  y: number
  tint: string
  shape: number
}

function SampleShape({ shape }: { shape: number }) {
  switch (shape % 4) {
    case 0:
      return <icosahedronGeometry args={[0.24, 0]} />
    case 1:
      return <octahedronGeometry args={[0.28, 0]} />
    case 2:
      return <torusGeometry args={[0.2, 0.07, 8, 16]} />
    default:
      return <dodecahedronGeometry args={[0.22, 0]} />
  }
}

const tmpM = new THREE.Matrix4()
const tmpP = new THREE.Vector3()
const tmpQ = new THREE.Quaternion()
const tmpS = new THREE.Vector3()

function Locker({ reduced }: { reduced: boolean }) {
  const cells = useMemo<Cell[]>(() => {
    const out: Cell[] = []
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c
        out.push({
          x: (c - (COLS - 1) / 2) * CELL_W,
          y: BASE_Y + (r + 0.5) * CELL_H,
          tint: TINTS[(c + r * 3) % TINTS.length],
          shape: i * 7 + r,
        })
      }
    }
    return out
  }, [])

  const { shell, inner, trim, beamCore, beamGlow } = useMemo(() => {
    const shell = tintedHolo('#3ee6ff', 0.55)
    const inner = cells.map((c) => tintedHolo(c.tint, 0.6))
    const trim = new THREE.MeshBasicNodeMaterial()
    trim.color.set('#3ee6ff').multiplyScalar(1.8)
    const make = (op: number, mul: number) => {
      const m = new THREE.MeshBasicNodeMaterial()
      m.color.set('#ffb547').multiplyScalar(mul)
      m.opacity = op
      m.transparent = true
      m.blending = THREE.AdditiveBlending
      m.depthWrite = false
      m.side = THREE.DoubleSide
      return m
    }
    return { shell, inner, trim, beamCore: make(0.95, 2.4), beamGlow: make(0.018, 1) }
  }, [cells])
  useEffect(
    () => () => {
      shell.dispose()
      inner.forEach((m) => m.dispose())
      trim.dispose()
      beamCore.dispose()
      beamGlow.dispose()
    },
    [shell, inner, trim, beamCore, beamGlow],
  )

  // Draw call budget: shelves, dividers and glow strips merge into two meshes; the 24 canister shells
  // and 48 caps are two instanced meshes. Only the 24 samples keep their own (per cell tinted) material.
  const { frameGeo, stripGeo, shellGeo, capGeo } = useMemo(() => {
    const boxAt = (w: number, h: number, d: number, x: number, y: number, z: number) => new THREE.BoxGeometry(w, h, d).translate(x, y, z)
    const frame = [
      ...Array.from({ length: ROWS + 1 }, (_, r) => boxAt(WALL_W + 0.4, 0.14, 1.1, 0, BASE_Y + r * CELL_H, WALL_Z + 0.3)),
      ...Array.from({ length: COLS + 1 }, (_, c) => boxAt(0.14, WALL_H, 1.1, (c - COLS / 2) * CELL_W, BASE_Y + WALL_H / 2, WALL_Z + 0.3)),
    ]
    const strips = Array.from({ length: ROWS }, (_, r) => boxAt(WALL_W, 0.03, 0.03, 0, BASE_Y + (r + 1) * CELL_H - 0.09, WALL_Z + 0.82))
    const frameGeo = mergeGeometries(frame)!
    const stripGeo = mergeGeometries(strips)!
    frame.forEach((g) => g.dispose())
    strips.forEach((g) => g.dispose())
    return { frameGeo, stripGeo, shellGeo: new THREE.CylinderGeometry(0.4, 0.4, 0.78, 20, 1, true), capGeo: new THREE.CylinderGeometry(0.45, 0.45, 0.04, 20) }
  }, [])
  useEffect(
    () => () => {
      frameGeo.dispose()
      stripGeo.dispose()
      shellGeo.dispose()
      capGeo.dispose()
    },
    [frameGeo, stripGeo, shellGeo, capGeo],
  )
  const shellMesh = useRef<THREE.InstancedMesh>(null)
  const capMesh = useRef<THREE.InstancedMesh>(null)
  const frameMat = useMemo(() => new THREE.MeshStandardNodeMaterial({ color: '#17294a', roughness: 0.45, metalness: 0.6 }), [])
  useEffect(() => () => frameMat.dispose(), [frameMat])
  const samples = useRef<(THREE.Mesh | null)[]>([])
  const beam = useRef<THREE.Group>(null)
  const heat = useRef<number[]>(cells.map(() => 0))

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    const bx = reduced ? 1.1 : Math.sin(t * 0.55) * (WALL_W / 2 + 0.2)
    if (beam.current) beam.current.position.x = bx
    cells.forEach((c, i) => {
      // Flare rises quickly as the beam arrives and cools slowly after it passes.
      const near = reduced ? 0 : Math.exp(-Math.pow((c.x - bx) / 0.75, 2))
      const h = heat.current[i]
      heat.current[i] = near > h ? near : h + (near - h) * Math.min(1, dt * 1.2)
      const k = heat.current[i]
      const sc = 1 + k * 0.1
      const cx = c.x
      const cy = c.y - 0.35
      const cz = WALL_Z + 0.5
      if (shellMesh.current) {
        tmpM.compose(tmpP.set(cx, cy, cz), tmpQ, tmpS.setScalar(sc))
        shellMesh.current.setMatrixAt(i, tmpM)
      }
      if (capMesh.current) {
        tmpM.compose(tmpP.set(cx, cy + 0.4 * sc, cz), tmpQ, tmpS.setScalar(sc))
        capMesh.current.setMatrixAt(i * 2, tmpM)
        tmpM.compose(tmpP.set(cx, cy - 0.4 * sc, cz), tmpQ, tmpS.setScalar(sc))
        capMesh.current.setMatrixAt(i * 2 + 1, tmpM)
      }
      const s = samples.current[i]
      if (s) {
        s.scale.setScalar(sc)
        if (!reduced) {
          s.rotation.y += dt * (0.5 + k * 3)
          s.position.y = Math.sin(t * 1.2 + i) * 0.05
        }
      }
      const m = inner[i]
      m.opacity = 0.5 + k * 0.5
      m.color.set(c.tint).multiplyScalar(1 + k * 1.6)
    })
    if (shellMesh.current) shellMesh.current.instanceMatrix.needsUpdate = true
    if (capMesh.current) capMesh.current.instanceMatrix.needsUpdate = true
  })

  return (
    <group>
      {/* Back wall and frame */}
      <mesh position={[0, BASE_Y + WALL_H / 2, WALL_Z - 0.2]}>
        <boxGeometry args={[WALL_W + 0.4, WALL_H + 0.2, 0.2]} />
        <meshStandardMaterial color="#0a1424" roughness={0.6} metalness={0.5} />
      </mesh>
      <mesh geometry={frameGeo} material={frameMat} />
      {/* Thin glow strips under each shelf */}
      <mesh geometry={stripGeo}>
        <primitive object={trim} attach="material" />
      </mesh>

      <instancedMesh ref={shellMesh} args={[shellGeo, shell, cells.length]} frustumCulled={false} />
      <instancedMesh ref={capMesh} args={[capGeo, trim, cells.length * 2]} frustumCulled={false} />
      {cells.map((c, i) => (
        <group key={i} position={[c.x, c.y - 0.35, WALL_Z + 0.5]}>
          <mesh
            ref={(m) => {
              samples.current[i] = m
            }}
          >
            <SampleShape shape={c.shape} />
            <primitive object={inner[i]} attach="material" />
          </mesh>
        </group>
      ))}

      {/* Scan beam: a thin vertical sheet with bright front and back edges. */}
      <group ref={beam} position={[0, BASE_Y + WALL_H / 2, WALL_Z + 1.5]}>
        <mesh>
          <boxGeometry args={[0.05, WALL_H + 0.6, 2.4]} />
          <primitive object={beamGlow} attach="material" />
        </mesh>
        <mesh position={[0, 0, 1.2]}>
          <boxGeometry args={[0.05, WALL_H + 0.6, 0.04]} />
          <primitive object={beamCore} attach="material" />
        </mesh>
        <mesh position={[0, 0, -1.2]}>
          <boxGeometry args={[0.05, WALL_H + 0.6, 0.04]} />
          <primitive object={beamCore} attach="material" />
        </mesh>
      </group>
    </group>
  )
}

const SHARDS: { pos: [number, number, number]; rot: [number, number, number]; s: number }[] = [
  { pos: [0.62, -0.62, 0.1], rot: [0.2, 0, -0.5], s: 0.34 },
  { pos: [-0.58, -0.66, 0.2], rot: [-0.15, 0.6, 0.55], s: 0.3 },
  { pos: [0.1, -0.7, 0.62], rot: [0.6, 0.2, 0.15], s: 0.28 },
  { pos: [-0.2, -0.68, -0.6], rot: [-0.55, 0, -0.2], s: 0.32 },
  { pos: [0.5, -0.66, -0.45], rot: [-0.4, 0.3, -0.6], s: 0.24 },
]
const MOTES = 18

/** Frozen residue: a pale ice crystal cluster with an amber core, a glow, an orbit ring and rising frost motes. */
function ScanSample({ reduced }: { reduced: boolean }) {
  const tier = useTier()
  const full = tier !== 'low'
  const still = reduced || STILL
  const { ice, core, ringMat, moteMat, glowMat, glowTex, coreGeo, ringGeo, moteGeo, moteData } = useMemo(() => {
    const ice = tintedHolo('#9fefff', 0.55)
    const add = (c: string, op: number) => {
      const m = new THREE.MeshBasicNodeMaterial()
      m.color.set(c)
      m.opacity = op
      m.transparent = true
      m.blending = THREE.AdditiveBlending
      m.depthWrite = false
      return m
    }
    const glowTex = makeRadialTexture('rgba(207,238,255,0.9)', 'rgba(62,230,255,0)')
    const glowMat = new THREE.SpriteNodeMaterial({ map: glowTex, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending })
    const moteData = Array.from({ length: MOTES }, (_, i) => ({
      a: i * 2.4,
      r: 0.5 + ((i * 37) % 11) / 11,
      y: ((i * 53) % 17) / 17,
      v: 0.12 + ((i * 29) % 7) / 40,
    }))
    return {
      ice,
      core: add('#ffb547', 0.75),
      ringMat: add('#3ee6ff', 0.55),
      moteMat: add('#cfeeff', 0.7),
      glowMat,
      glowTex,
      coreGeo: new THREE.OctahedronGeometry(0.26, 0),
      ringGeo: new THREE.TorusGeometry(1.1, 0.01, 6, 64),
      moteGeo: new THREE.OctahedronGeometry(0.025, 0),
      moteData,
    }
  }, [])
  useEffect(
    () => () => {
      ice.dispose()
      core.dispose()
      ringMat.dispose()
      moteMat.dispose()
      glowMat.dispose()
      glowTex.dispose()
      coreGeo.dispose()
      ringGeo.dispose()
      moteGeo.dispose()
    },
    [ice, core, ringMat, moteMat, glowMat, glowTex, coreGeo, ringGeo, moteGeo],
  )
  const spin = useRef<THREE.Group>(null)
  const ring = useRef<THREE.Mesh>(null)
  const motes = useRef<THREE.InstancedMesh>(null)
  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    if (still) {
      core.opacity = 0.75
    } else {
      if (spin.current) {
        spin.current.rotation.y += dt * 0.25
        spin.current.position.y = 1.5 + Math.sin(t * 1.3) * 0.08
      }
      if (ring.current) ring.current.rotation.z += dt * 0.3
      core.opacity = 0.725 + 0.175 * Math.sin(t * 1.8)
    }
    const m = motes.current
    if (!m) return
    moteData.forEach((d, i) => {
      const k = still ? d.y : (d.y + t * d.v * 0.2) % 1
      const a = d.a + (still ? 0 : t * 0.2)
      tmpM.compose(tmpP.set(Math.cos(a) * d.r, k * 3.2 - 1.4, Math.sin(a) * d.r), tmpQ, tmpS.setScalar(1))
      m.setMatrixAt(i, tmpM)
    })
    m.instanceMatrix.needsUpdate = true
  })
  return (
    <group>
      <group ref={spin} position={[0, 1.5, 0]}>
        <mesh rotation={[0.3, 0, 0.15]} scale={[1, 1.5, 1]} material={ice}>
          <octahedronGeometry args={[0.7, 0]} />
        </mesh>
        {SHARDS.map((sh, i) => (
          <mesh key={i} position={sh.pos} rotation={sh.rot} scale={[sh.s, sh.s * 2.2, sh.s]} material={ice}>
            <octahedronGeometry args={[1, 0]} />
          </mesh>
        ))}
        <mesh geometry={coreGeo} material={core} scale={[1, 1.4, 1]} rotation={[0.3, 0, 0.15]} />
      </group>
      {full && (
        <>
          <sprite position={[0, 1.5, -1]} scale={[3, 3, 1]} material={glowMat} />
          <instancedMesh ref={motes} args={[moteGeo, moteMat, MOTES]} frustumCulled={false} position={[0, 1.4, 0]} />
        </>
      )}
      <mesh ref={ring} geometry={ringGeo} material={ringMat} position={[0, 1.5, 0]} rotation={[1.1, 0.3, 0]} />
    </group>
  )
}

export default function ColdScene() {
  const reduced = useReduced()
  return (
    <>
      <LabEnvironment ring={false} />
      <pointLight position={[0, 5, 6]} intensity={18} color="#bfe9ff" distance={24} decay={2} />
      <CameraRig pos={[0, 3.6, 14.6]} look={[0, 3.0, 0]} from={[-4, 2, 4]} />
      <Locker reduced={reduced} />
      <group position={[0, 0, 3.2]}>
        <Pedestal radius={1.5} tint="#3ee6ff" />
        <ScanSample reduced={reduced} />
      </group>
    </>
  )
}
