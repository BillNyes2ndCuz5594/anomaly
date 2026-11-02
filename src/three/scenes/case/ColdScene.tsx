import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three/webgpu'
import { color, exp, float, fract, positionWorld, smoothstep, uniform } from 'three/tsl'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { tintedHolo } from '../../materials/tinted'
import { useRuntime } from '../../../state/runtime'
import { useSession } from '../../../state/session'
import { useMotionMode } from '../../../ui/useMotionMode'
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

/** The canister that slides out of its cubby on "Open the evidence" (row 2, column 3). */
const TARGET = 2 * COLS + 3
const PULL_OUT = 0.3
const PULL_MS = 500
const LOCK_MS = 450
const DRIFT_S = 6
/** World units per scanline. Matches the 4 px pitch of .veil-scanlines at the locker camera distance. */
const LINE_PITCH = 0.07
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

/**
 * Thin cyan scanlines for the cubby frame and back wall, same pitch and color as .veil-scanlines (rgb 180 245 255).
 * `off` drifts the lines on a 6 s cycle (a whole number of lines, so the loop is seamless), `beam` brightens them
 * as the scan beam passes, `lock` brightens everything for the evidence handoff. Static when off, beam and lock are 0.
 */
function makeScanlines() {
  const u = { off: uniform(0), beam: uniform(0), sweep: uniform(0), lock: uniform(0), base: uniform(0.35) }
  const f = fract(positionWorld.y.div(LINE_PITCH).add(u.off))
  const line = smoothstep(float(0), float(0.1), f).mul(smoothstep(float(0.34), float(0.24), f))
  const near = exp(positionWorld.x.sub(u.beam).div(0.9).pow(2).negate())
  const glow = u.base.add(near.mul(u.sweep).mul(0.9)).add(u.lock.mul(1.1))
  return { u, node: color('#b4f5ff').mul(line).mul(glow) }
}

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
  const mode = useMotionMode()
  const full = mode === 'full'
  const initialPull = useRef(useRuntime.getState().coldPull)
  const lock = useRef(0)
  const pull = useRef(0)
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
  const { lines, frameMat, backMat } = useMemo(() => {
    const lines = makeScanlines()
    const frameMat = new THREE.MeshStandardNodeMaterial({ color: '#17294a', roughness: 0.45, metalness: 0.6 })
    frameMat.emissiveNode = lines.node
    const backMat = new THREE.MeshStandardNodeMaterial({ color: '#0a1424', roughness: 0.6, metalness: 0.5 })
    backMat.emissiveNode = lines.node.mul(0.7)
    return { lines, frameMat, backMat }
  }, [])
  useEffect(
    () => () => {
      frameMat.dispose()
      backMat.dispose()
    },
    [frameMat, backMat],
  )
  const samples = useRef<(THREE.Mesh | null)[]>([])
  const groups = useRef<(THREE.Group | null)[]>([])
  const beam = useRef<THREE.Group>(null)
  const heat = useRef<number[]>(cells.map(() => 0))

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    const bx = reduced ? 1.1 : Math.sin(t * 0.55) * (WALL_W / 2 + 0.2)
    if (beam.current) beam.current.position.x = bx
    // Scanlines: drift and beam brightening only in full motion. Fade shows static lines. Still shows them dim and fixed.
    lines.u.off.value = full ? ((t % DRIFT_S) / DRIFT_S) * 8 : 0
    lines.u.beam.value = bx
    lines.u.sweep.value = full ? 1 : 0
    const pulled = useRuntime.getState().coldPull !== initialPull.current
    if (pulled && mode !== 'still') {
      lock.current = Math.min(1, lock.current + dt / (LOCK_MS / 1000))
      if (full) pull.current = Math.min(1, pull.current + dt / (PULL_MS / 1000))
    }
    const lockK = easeOutCubic(lock.current)
    lines.u.lock.value = lockK
    const out = easeOutCubic(pull.current) * PULL_OUT
    cells.forEach((c, i) => {
      // Flare rises quickly as the beam arrives and cools slowly after it passes. The pulled canister glows with the lock.
      const beamNear = reduced ? 0 : Math.exp(-Math.pow((c.x - bx) / 0.75, 2))
      const near = i === TARGET ? Math.max(beamNear, lockK) : beamNear
      const h = heat.current[i]
      heat.current[i] = near > h ? near : h + (near - h) * Math.min(1, dt * 1.2)
      const k = heat.current[i]
      const sc = 1 + k * 0.1
      const cx = c.x
      const cy = c.y - 0.35
      const cz = WALL_Z + 0.5 + (i === TARGET ? out : 0)
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
      const grp = groups.current[i]
      if (grp) grp.position.z = cz
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
      <mesh position={[0, BASE_Y + WALL_H / 2, WALL_Z - 0.2]} material={backMat}>
        <boxGeometry args={[WALL_W + 0.4, WALL_H + 0.2, 0.2]} />
      </mesh>
      <mesh geometry={frameGeo} material={frameMat} />
      {/* Thin glow strips under each shelf */}
      <mesh geometry={stripGeo}>
        <primitive object={trim} attach="material" />
      </mesh>

      <instancedMesh ref={shellMesh} args={[shellGeo, shell, cells.length]} frustumCulled={false} />
      <instancedMesh ref={capMesh} args={[capGeo, trim, cells.length * 2]} frustumCulled={false} />
      {cells.map((c, i) => (
        <group
          key={i}
          position={[c.x, c.y - 0.35, WALL_Z + 0.5]}
          ref={(g) => {
            groups.current[i] = g
          }}
        >
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
const AMBER = new THREE.Color('#ffb547')
const CYAN = new THREE.Color('#3ee6ff')
const ICE_CLEAR = new THREE.Color('#6fd8ff')
const ICE_FROSTED = new THREE.Color('#eaf8ff')
const WRONG_MS = 600
const RIGHT_MS = 450
const FADE_FX_MS = 250
const FROST_STEP_MS = 450
const fallPos = new THREE.Vector3()

/**
 * Frozen residue: a pale ice crystal cluster with an amber core, a glow, an orbit ring and rising frost motes.
 * With `live` it reacts to the runtime coreFx event: wrong answers spike the amber core and wobble the ring, right
 * answers glint cyan, drop one step of frost and shake one ice shard loose. fade swaps the color and fades it back in
 * 250 ms with no shard. still changes the frost step instantly and never flares.
 */
function ScanSample({ live = false }: { live?: boolean }) {
  const tier = useTier()
  const mode = useMotionMode()
  const full = tier !== 'low'
  const still = mode === 'still'
  const correct = useSession((s) => s.answers.filter((a) => a.correct).length)
  const total = useSession((s) => s.items.length)
  // Frost coverage: 1 at the first item, one step less per right answer. Only the live (Evidence) core follows it.
  const frostTarget = live ? Math.max(0, 1 - correct / Math.max(1, total)) : 1
  const { ice, core, ringMat, moteMat, glowMat, glowTex, coreGeo, ringGeo, moteGeo, moteData, shardMat } = useMemo(() => {
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
      shardMat: tintedHolo('#cfeeff', 0.55),
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
      shardMat.dispose()
      coreGeo.dispose()
      ringGeo.dispose()
      moteGeo.dispose()
    },
    [ice, core, ringMat, moteMat, glowMat, glowTex, shardMat, coreGeo, ringGeo, moteGeo],
  )
  const spin = useRef<THREE.Group>(null)
  const ring = useRef<THREE.Mesh>(null)
  const motes = useRef<THREE.InstancedMesh>(null)
  const shards = useRef<(THREE.Mesh | null)[]>([])
  const fall = useRef<THREE.Mesh>(null)
  // Per instance reaction state. `seen` starts at the event count on mount so an old answer never replays.
  const fx = useRef({ seen: useRuntime.getState().coreFx?.n ?? 0, t: -1, ok: true, frost: frostTarget, attached: Math.ceil(frostTarget * SHARDS.length - 0.001), shard: -1, fallT: -1, vy: 0, fallInit: false })

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    const f = fx.current
    if (live) {
      const e = useRuntime.getState().coreFx
      if (e && e.n !== f.seen) {
        f.seen = e.n
        if (!still) {
          f.t = 0
          f.ok = e.ok
          if (e.ok && mode === 'full' && f.attached > 0) {
            // One ice shard comes loose per right answer: the highest one still attached.
            f.attached -= 1
            f.shard = f.attached
            f.fallT = 0
            f.vy = 0
            f.fallInit = true
          }
        }
      }
    }
    if (f.t >= 0) f.t += dt * 1000
    const dur = mode === 'fade' ? FADE_FX_MS : f.ok ? RIGHT_MS : WRONG_MS
    const env = f.t >= 0 && f.t < dur ? Math.pow(1 - f.t / dur, 2) : 0
    if (f.t >= dur) f.t = -1

    // Frost coverage follows the right answer count: instant in still, 450 ms in full, 250 ms in fade.
    const rate = still ? 1 : dt / ((mode === 'fade' ? FADE_FX_MS : FROST_STEP_MS) / 1000)
    f.frost += Math.max(-rate, Math.min(rate, frostTarget - f.frost))
    if (live) {
      ice.color.copy(ICE_CLEAR).lerp(ICE_FROSTED, f.frost)
      ice.opacity = 0.4 + 0.3 * f.frost
    }

    if (still) {
      core.opacity = 0.75
    } else {
      if (spin.current) {
        spin.current.rotation.y += dt * 0.25
        spin.current.position.y = 1.5 + Math.sin(t * 1.3) * 0.08
      }
      core.opacity = 0.725 + 0.175 * Math.sin(t * 1.8)
    }
    // Reaction. Amber spike and ring wobble on a wrong answer, cyan glint on a right one.
    core.color.copy(AMBER)
    ringMat.color.copy(CYAN)
    glowMat.opacity = 0.3
    let wobble = 0
    if (env > 0 && !still) {
      if (mode === 'fade') {
        core.color.lerp(f.ok ? CYAN : AMBER, env).multiplyScalar(1 + env * 0.4)
      } else if (f.ok) {
        core.color.lerp(CYAN, env).multiplyScalar(1 + env * 1.6)
        ringMat.color.multiplyScalar(1 + env * 3)
        glowMat.opacity = 0.3 + env * 0.45
      } else {
        core.color.multiplyScalar(1 + env * 3.2)
        core.opacity = Math.min(1, core.opacity + env * 0.4)
        wobble = Math.sin((f.t / 1000) * 46) * 0.2 * env
      }
    }
    if (ring.current) {
      if (!still) ring.current.rotation.z += dt * 0.3
      ring.current.rotation.x = 1.1 + wobble
    }
    // Attached shards follow the frost step in full motion. The detached one falls away with the pull of gravity.
    if (live && mode === 'full') {
      shards.current.forEach((m, i) => {
        if (m) m.visible = i < f.attached
      })
    }
    const fm = fall.current
    if (fm) {
      if (f.fallT >= 0 && f.shard >= 0 && spin.current) {
        f.fallT += dt
        f.vy -= dt * 4.5
        const sh = SHARDS[f.shard]
        if (f.fallInit) {
          f.fallInit = false
          fallPos.set(sh.pos[0], sh.pos[1], sh.pos[2]).applyQuaternion(spin.current.quaternion).add(spin.current.position)
          fm.position.copy(fallPos)
          fm.rotation.set(sh.rot[0], sh.rot[1], sh.rot[2])
        }
        fm.position.y += f.vy * dt
        fm.rotation.x += dt * 2.2
        const life = Math.min(1, f.fallT / 1.2)
        fm.visible = life < 1
        shardMat.opacity = 0.55 * (1 - life)
        fm.scale.set(sh.s, sh.s * 2.2, sh.s)
        if (life >= 1) f.fallT = -1
      } else {
        fm.visible = false
      }
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
          <mesh
            key={i}
            ref={(m) => {
              shards.current[i] = m
            }}
            position={sh.pos}
            rotation={sh.rot}
            scale={[sh.s, sh.s * 2.2, sh.s]}
            material={ice}
          >
            <octahedronGeometry args={[1, 0]} />
          </mesh>
        ))}
        <mesh geometry={coreGeo} material={core} scale={[1, 1.4, 1]} rotation={[0.3, 0, 0.15]} />
      </group>
      {live ? (
        <mesh ref={fall} visible={false} material={shardMat}>
          <octahedronGeometry args={[1, 0]} />
        </mesh>
      ) : null}
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

/**
 * The residue core, small, at the left of the stage, raised so it clears the item picture panel for the cold Evidence step. The stage is already
 * inset by caseInset (0 on the items step), so the core is placed from the visible width at its depth.
 */
export function EvidenceCore() {
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height))
  const halfW = Math.tan((20 * Math.PI) / 180) * 9 * aspect
  const x = -Math.min(halfW * 0.62, 6.2)
  return (
    <group position={[x, 1.4, 3]} scale={0.5}>
      <ScanSample live />
    </group>
  )
}

export default function ColdScene() {
  const reduced = useReduced()
  // "Open the evidence" pulls the target canister and dollies the camera in. Full motion only (fade glows, still does nothing).
  const mode = useMotionMode()
  const initialPull = useRef(useRuntime.getState().coldPull)
  const pulled = useRuntime((s) => s.coldPull !== initialPull.current)
  const dolly = mode === 'full' && pulled
  return (
    <>
      <LabEnvironment ring={false} />
      <pointLight position={[0, 5, 6]} intensity={18} color="#bfe9ff" distance={24} decay={2} />
      <CameraRig pos={dolly ? [0, 3.4, 13.2] : [0, 3.6, 14.6]} look={[0, 3.0, 0]} from={[-4, 2, 4]} />
      <Locker reduced={reduced} />
      <group position={[0, 0, 3.2]}>
        <Pedestal radius={1.5} tint="#3ee6ff" />
        <ScanSample />
      </group>
    </>
  )
}
