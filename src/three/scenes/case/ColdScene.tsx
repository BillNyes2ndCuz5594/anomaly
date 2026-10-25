import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three/webgpu'
import { tintedHolo } from '../../materials/tinted'
import { CameraRig, LabEnvironment, Pedestal, useReduced } from './common'

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

  const canisters = useRef<(THREE.Group | null)[]>([])
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
      const g = canisters.current[i]
      if (g) g.scale.setScalar(1 + k * 0.1)
      const s = samples.current[i]
      if (s) {
        if (!reduced) {
          s.rotation.y += dt * (0.5 + k * 3)
          s.position.y = Math.sin(t * 1.2 + i) * 0.05
        }
      }
      const m = inner[i]
      m.opacity = 0.5 + k * 0.5
      m.color.set(c.tint).multiplyScalar(1 + k * 1.6)
    })
  })

  const shelfY = (r: number) => BASE_Y + r * CELL_H
  return (
    <group>
      {/* Back wall and frame */}
      <mesh position={[0, BASE_Y + WALL_H / 2, WALL_Z - 0.2]}>
        <boxGeometry args={[WALL_W + 0.4, WALL_H + 0.2, 0.2]} />
        <meshStandardMaterial color="#0a1424" roughness={0.6} metalness={0.5} />
      </mesh>
      {Array.from({ length: ROWS + 1 }, (_, r) => (
        <mesh key={`s${r}`} position={[0, shelfY(r), WALL_Z + 0.3]}>
          <boxGeometry args={[WALL_W + 0.4, 0.14, 1.1]} />
          <meshStandardMaterial color="#17294a" roughness={0.45} metalness={0.6} />
        </mesh>
      ))}
      {Array.from({ length: COLS + 1 }, (_, c) => (
        <mesh key={`d${c}`} position={[(c - COLS / 2) * CELL_W, BASE_Y + WALL_H / 2, WALL_Z + 0.3]}>
          <boxGeometry args={[0.14, WALL_H, 1.1]} />
          <meshStandardMaterial color="#17294a" roughness={0.45} metalness={0.6} />
        </mesh>
      ))}
      {/* Thin glow strips under each shelf */}
      {Array.from({ length: ROWS }, (_, r) => (
        <mesh key={`g${r}`} position={[0, shelfY(r + 1) - 0.09, WALL_Z + 0.82]}>
          <boxGeometry args={[WALL_W, 0.03, 0.03]} />
          <primitive object={trim} attach="material" />
        </mesh>
      ))}

      {cells.map((c, i) => (
        <group key={i} position={[c.x, c.y - 0.35, WALL_Z + 0.5]}>
          <group
            ref={(g) => {
              canisters.current[i] = g
            }}
          >
            <mesh>
              <cylinderGeometry args={[0.4, 0.4, 0.78, 20, 1, true]} />
              <primitive object={shell} attach="material" />
            </mesh>
            <mesh position={[0, 0.4, 0]}>
              <cylinderGeometry args={[0.45, 0.45, 0.04, 20]} />
              <primitive object={trim} attach="material" />
            </mesh>
            <mesh position={[0, -0.4, 0]}>
              <cylinderGeometry args={[0.45, 0.45, 0.04, 20]} />
              <primitive object={trim} attach="material" />
            </mesh>
            <mesh
              position={[0, 0, 0]}
              ref={(m) => {
                samples.current[i] = m
              }}
            >
              <SampleShape shape={c.shape} />
              <primitive object={inner[i]} attach="material" />
            </mesh>
          </group>
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

/** The sample under the scanner: a slowly turning crystal over the projector ring. */
function ScanSample({ reduced }: { reduced: boolean }) {
  const mat = useMemo(() => tintedHolo('#ffb547', 0.8), [])
  const ref = useRef<THREE.Mesh>(null)
  useEffect(() => () => mat.dispose(), [mat])
  useFrame((state, dt) => {
    if (!ref.current) return
    if (!reduced) ref.current.rotation.y += dt * 0.7
    ref.current.position.y = 1.5 + (reduced ? 0 : Math.sin(state.clock.elapsedTime * 1.3) * 0.08)
  })
  return (
    <mesh ref={ref} position={[0, 1.5, 0]} rotation={[0.3, 0, 0.15]} scale={[1, 1.5, 1]}>
      <octahedronGeometry args={[0.7, 0]} />
      <primitive object={mat} attach="material" />
    </mesh>
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
        <Pedestal radius={1.5} tint="#ffb547" />
        <ScanSample reduced={reduced} />
      </group>
    </>
  )
}
