import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three/webgpu'
import type { Category } from '../../../content/schema'
import { STILL } from '../../../lib/flags'
import { useFx, useSession } from '../../../state/session'
import { pedestalIds, type GenericLab } from '../../../screens/case/labGenericData'
import type { Box } from '../../fit'
import { tintedHolo } from '../../materials/tinted'
import type { LoopClip } from '../loopClips'
import { FitRig, LabEnvironment, Pedestal } from './common'
import { useReduced, useTier } from './sceneHelpers'
import CaseHolo from './CaseHolo'
import { LabBench, LabLamps } from './labStage'
import { StagePedestal } from './stageSet'

/**
 * Generic Field Lab: a dais with the current card as a hologram slab, and one low pedestal per bin, right card or
 * slot in an arc in front of it. Names stay in the HUD. A pedestal glows when hovered here or when its HUD button
 * is hovered or focused, and stays lit once a card is placed on it. A correct placement draws a short light trail
 * from the slab to the pedestal. Low tier: no trail, no motes. Reduced motion and ?still=1: static.
 */

const DAIS = 1.15
const ARC_R = 2.75
const SLAB_Y = 1.05
const PED_R = 0.42
const CYAN = '#3ee6ff'
const LIT = '#2fe3b0'

const CLIP: Record<Category, LoopClip> = { nature: 'swamp', earth: 'water', physical: 'cells', life: 'canopy' }

/** Pedestal positions on a front arc, left to right (slot 1 on the left). */
function pedestalLayout(n: number): [number, number, number][] {
  const out: [number, number, number][] = []
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1)
    const a = Math.PI * (0.92 - t * 0.84)
    out.push([Math.cos(a) * ARC_R, 0, Math.sin(a) * ARC_R * 0.62])
  }
  return out
}

const tmp = new THREE.Vector3()

function Slab({ reduced }: { reduced: boolean }) {
  const card = useFx((s) => s.card)
  const group = useRef<THREE.Group>(null)
  const born = useRef<number | null>(null)
  const { mat, edgeMat, edges } = useMemo(() => {
    const mat = tintedHolo('#ffb547', 0.85)
    const edgeMat = new THREE.LineBasicNodeMaterial()
    edgeMat.color.set('#ffd08a').multiplyScalar(1.6)
    edgeMat.transparent = true
    edgeMat.blending = THREE.AdditiveBlending
    edgeMat.depthWrite = false
    const box = new THREE.BoxGeometry(1.25, 0.82, 0.06)
    const edges = new THREE.EdgesGeometry(box)
    box.dispose()
    return { mat, edgeMat, edges }
  }, [])
  useEffect(
    () => () => {
      mat.dispose()
      edgeMat.dispose()
      edges.dispose()
    },
    [mat, edgeMat, edges],
  )
  useEffect(() => {
    born.current = null
  }, [card])
  useFrame((state) => {
    const g = group.current
    if (!g) return
    // Nothing left to place: the slab goes away.
    g.visible = card !== null
    const calm = reduced || STILL
    if (born.current === null) born.current = state.clock.elapsedTime
    const age = state.clock.elapsedTime - born.current
    const pop = calm ? 1 : 0.7 + 0.3 * (1 - Math.pow(1 - Math.min(1, age / 0.32), 3))
    g.scale.setScalar(pop)
    g.position.y = SLAB_Y + (calm ? 0 : Math.sin(state.clock.elapsedTime * 1.2) * 0.05)
    g.rotation.y = calm ? -0.12 : Math.sin(state.clock.elapsedTime * 0.5) * 0.22
  })
  return (
    <group ref={group} position={[0, SLAB_Y, 0]} rotation={[-0.08, 0, 0]}>
      <mesh>
        <boxGeometry args={[1.25, 0.82, 0.06]} />
        <primitive object={mat} attach="material" />
      </mesh>
      <lineSegments geometry={edges}>
        <primitive object={edgeMat} attach="material" />
      </lineSegments>
    </group>
  )
}

function Bin({ id, pos, low, reduced }: { id: string; pos: [number, number, number]; low: boolean; reduced: boolean }) {
  const ring = useRef<THREE.Mesh>(null)
  const lastN = useRef(0)
  const pulse = useRef(-10)
  const mat = useMemo(() => {
    const m = new THREE.MeshBasicNodeMaterial()
    m.color.set(CYAN)
    m.transparent = true
    m.opacity = 0.3
    m.blending = THREE.AdditiveBlending
    m.depthWrite = false
    m.side = THREE.DoubleSide
    return m
  }, [])
  useEffect(() => () => mat.dispose(), [mat])
  const lit = useFx((s) => s.lit.includes(id))
  useFrame((state, dt) => {
    const fx = useFx.getState()
    const now = state.clock.elapsedTime
    if (fx.flash && fx.flash.n !== lastN.current) {
      lastN.current = fx.flash.n
      if (fx.flash.id === id) pulse.current = now
    }
    const hot = fx.hover === id
    const age = now - pulse.current
    const flash = age >= 0 && age < 0.6 ? 1 - age / 0.6 : 0
    const target = (hot ? 0.95 : lit ? 0.7 : 0.3) + flash * 0.5
    const calm = reduced || STILL
    const r = ring.current
    if (!r) return
    // Through the mesh, so the material made in useMemo is never written from here.
    const m = r.material as THREE.MeshBasicNodeMaterial
    m.opacity = calm ? target : m.opacity + (target - m.opacity) * Math.min(1, dt * 10)
    m.color.set(lit && !hot ? LIT : CYAN)
    r.scale.setScalar(1 + (calm ? 0 : flash * 0.25) + (hot ? 0.06 : 0))
  })
  const pick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    useFx.getState().pick?.(id)
  }
  return (
    <group position={pos}>
      <StagePedestal radius={PED_R} low={low} />
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[PED_R * 0.78, PED_R * 1.02, low ? 28 : 48]} />
        <primitive object={mat} attach="material" />
      </mesh>
      {/* Generous invisible hit target. Order slots ignore the pick (the HUD handler decides). */}
      <mesh
        position={[0, 0.3, 0]}
        visible={false}
        userData={{ noFit: true }}
        onPointerOver={(e) => {
          e.stopPropagation()
          useFx.getState().setHover(id)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          useFx.getState().setHover(null)
          document.body.style.cursor = ''
        }}
        onClick={pick}
      >
        <cylinderGeometry args={[PED_R * 1.15, PED_R * 1.15, 0.7, 10]} />
        <meshBasicMaterial />
      </mesh>
    </group>
  )
}

/** One light trail at a time: a tube from the slab to the pedestal that draws in over 450 ms, then fades. */
function Trail({ ids, layout }: { ids: string[]; layout: [number, number, number][] }) {
  const mesh = useRef<THREE.Mesh>(null)
  const lastN = useRef(useFx.getState().flash?.n ?? 0)
  const born = useRef(-10)
  const mat = useMemo(() => {
    const m = new THREE.MeshBasicNodeMaterial()
    m.color.set('#9ff0ff').multiplyScalar(2.2)
    m.transparent = true
    m.blending = THREE.AdditiveBlending
    m.depthWrite = false
    m.opacity = 0
    return m
  }, [])
  const geo = useRef<THREE.TubeGeometry | null>(null)
  useEffect(
    () => () => {
      mat.dispose()
      geo.current?.dispose()
    },
    [mat],
  )
  useFrame((state) => {
    const m = mesh.current
    if (!m) return
    const fx = useFx.getState().flash
    const now = state.clock.elapsedTime
    if (fx && fx.n !== lastN.current) {
      lastN.current = fx.n
      const i = ids.indexOf(fx.id)
      if (fx.ok && i >= 0) {
        const p = layout[i]
        const a = new THREE.Vector3(0, SLAB_Y - 0.3, 0.05)
        const b = new THREE.Vector3(p[0], 0.12, p[2])
        const mid = a.clone().add(b).multiplyScalar(0.5)
        mid.y += 0.9
        mid.z += 0.4
        geo.current?.dispose()
        geo.current = new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, b), 32, 0.03, 6, false)
        m.geometry = geo.current
        born.current = now
      }
    }
    const age = now - born.current
    const on = age >= 0 && age < 1.2 && geo.current !== null
    m.visible = on
    if (!on || !geo.current) return
    const k = Math.min(1, age / 0.45)
    const total = geo.current.index ? geo.current.index.count : 0
    geo.current.setDrawRange(0, k >= 1 ? Infinity : Math.floor((total * k) / 3) * 3)
    ;(m.material as THREE.MeshBasicNodeMaterial).opacity = 0.9 * (age < 0.6 ? 1 : 1 - (age - 0.6) / 0.6)
  })
  return (
    <mesh ref={mesh} visible={false} userData={{ noFit: true }}>
      <primitive object={mat} attach="material" />
    </mesh>
  )
}

/** Faint motes rising over the lit pedestals. One instanced draw for all of them. */
function Motes({ ids, layout }: { ids: string[]; layout: [number, number, number][] }) {
  const PER = 6
  const mesh = useRef<THREE.InstancedMesh>(null)
  const mat = useMemo(() => {
    const m = new THREE.MeshBasicNodeMaterial()
    m.color.set(LIT).multiplyScalar(1.8)
    m.transparent = true
    m.opacity = 0.7
    m.blending = THREE.AdditiveBlending
    m.depthWrite = false
    return m
  }, [])
  const geo = useMemo(() => new THREE.SphereGeometry(0.025, 5, 4), [])
  useEffect(
    () => () => {
      mat.dispose()
      geo.dispose()
    },
    [mat, geo],
  )
  const m4 = useMemo(() => new THREE.Matrix4(), [])
  useFrame((state) => {
    const im = mesh.current
    if (!im) return
    const lit = useFx.getState().lit
    const t = state.clock.elapsedTime
    let n = 0
    ids.forEach((id, i) => {
      if (!lit.includes(id)) return
      const p = layout[i]
      for (let k = 0; k < PER; k++) {
        const ph = (t * 0.35 + k / PER) % 1
        const ang = k * 2.4 + i
        tmp.set(p[0] + Math.cos(ang) * PED_R * 0.6, 0.1 + ph * 0.9, p[2] + Math.sin(ang) * PED_R * 0.6)
        m4.makeScale(1 - ph, 1 - ph, 1 - ph).setPosition(tmp)
        im.setMatrixAt(n++, m4)
      }
    })
    im.count = n
    im.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={mesh} args={[geo, mat, ids.length * PER]} frustumCulled={false} userData={{ noFit: true }} />
}

export default function LabGenericScene() {
  const reduced = useReduced()
  const low = useTier() === 'low'
  const caseDef = useSession((s) => s.caseDef)
  const card = useFx((s) => s.card)
  const lab = caseDef && caseDef.lab.kind !== 'vitals' ? (caseDef.lab as GenericLab) : null
  const ids = useMemo(() => (lab ? pedestalIds(lab) : []), [lab])
  const layout = useMemo(() => pedestalLayout(ids.length), [ids.length])
  const content = useRef<THREE.Group>(null)
  const view = useMemo(() => {
    const box: Box = { min: [-ARC_R - PED_R - 0.1, -0.12, -DAIS - 0.1], max: [ARC_R + PED_R + 0.1, SLAB_Y + 0.55, ARC_R * 0.62 + PED_R + 0.2] }
    return { box, elevation: 0.32, margin: 0.1 }
  }, [])
  const calm = reduced || STILL
  if (!lab) return null
  return (
    <>
      <LabEnvironment floorY={-0.12} clip={CLIP[caseDef?.category ?? 'physical']} />
      <LabLamps radius={DAIS * 1.6} subject="specimen" reduced={reduced} />
      <FitRig view={view} measure={content} />
      <group ref={content}>
        <LabBench kind="specimen" radius={DAIS} />
        <Pedestal radius={DAIS * 1.12} />
        <Slab reduced={reduced} />
        {card === null && caseDef ? (
          <CaseHolo caseId={((caseDef as { case?: { id: string } }).case?.id) ?? caseDef.id} reduced={calm} />
        ) : null}
        {ids.map((id, i) => (
          <Bin key={id} id={id} pos={layout[i]} low={low} reduced={reduced} />
        ))}
      </group>
      {!low && !calm ? <Trail ids={ids} layout={layout} /> : null}
      {!low && !calm ? <Motes ids={ids} layout={layout} /> : null}
    </>
  )
}
