import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three/webgpu'
import { STILL, STILL_YAW } from '../lib/flags'
import { FitCamera } from './FitCamera'
import { pointsBox, sweepYaw, translatePoints, unionBox, type Box, type V3 } from './fit'
import { DISPLAY_YAW, specimenOutline, specimenRing } from './models/specimenBox'
import type { Visual } from '../content/schema'
import { resolveTier, dprForTier } from '../state/quality'
import { useRuntime } from '../state/runtime'
import { useGame } from '../state/store'
import { createRenderer } from './renderer'
import { hasHero, loadHero } from './models/heroSpecimens'
import { visualToken, prepareNextHold } from './paintHold'
import { animalParts, plantParts } from './models/creatures'
import { humanModel } from './models/human'
import { StageBackdrop, StagePedestal } from './scenes/case/stageSet'
import HumanFigure from './scenes/case/HumanFigure'
import PartMesh from './scenes/case/PartMesh'
import Specimen from './scenes/case/Specimen'

function Lights() {
  return (
    <>
      <hemisphereLight args={['#8fc2ff', '#0a1220', 0.9]} />
      <directionalLight position={[4, 8, 6]} intensity={1.6} color="#dff3ff" />
      <pointLight position={[-5, 3, 4]} intensity={14} color="#ffb547" distance={24} decay={2} />
    </>
  )
}

/** Clean studio light for animals: warm key, soft sky fill, cool rim from behind (the same cyan as the holograms). */
function SpecimenLights() {
  return (
    <>
      <hemisphereLight args={['#b4c8e4', '#22344a', 0.9]} />
      <directionalLight position={[3.5, 7.5, 6.5]} intensity={2.4} color="#fff0dc" />
      <directionalLight position={[-6, 3, -5]} intensity={2.0} color="#4fe6ff" />
      <directionalLight position={[6, 2.5, -5]} intensity={0.9} color="#6fdcff" />
      <pointLight position={[-4, 2, 5]} intensity={6} color="#ffd9b0" distance={24} decay={2} />
    </>
  )
}

const RING = 2.15
const ringBox = (r: number): Box => ({ min: [-r, 0, -r], max: [r, 0.06, r] })
const SWAY_BODY = 0.5
const SWAY_SPECIMEN = 0.3
const SPECIMEN_YAW = DISPLAY_YAW

function OrganVisual({ highlight, low, enabledRef }: { highlight: string[]; low: boolean; enabledRef: { current: boolean } }) {
  const reduced = useGame((s) => s.settings.reducedMotion)
  const content = useRef<THREE.Group>(null)
  // The whole body at every point of its sway, plus the base ring.
  const box = useMemo(() => unionBox(sweepYaw(humanModel(low).box, STILL ? 0.4 : low ? 0.2 : SWAY_BODY, 24, STILL ? 0.3 : 0), ringBox(RING)), [low])
  const view = useMemo(() => ({ box, elevation: 0.14 }), [box])
  return (
    <>
      <FitCamera view={view} measure={content} enabledRef={enabledRef} />
      <group ref={content}>
        <StagePedestal radius={RING} low={low} />
        <HumanFigure mode="visual" highlight={highlight} reduced={reduced} />
      </group>
    </>
  )
}

// Animal at x -3.0 (x -1.8 to 2.6 around it, 3.5 tall, feet at 0), plant at x 3.0 (x -2.3 to 2.1, roots down to -1.24 and
// crown up to 3.25). Both hologram pairs stand on one shared baseline: a pedestal top just under the root tips.
const PA_TOP = -1.27
const PA_RING = 2.3
const AX = 3.0
const PA_VIEW = { box: { min: [-5.3, -1.42, -2.0], max: [5.3, 3.7, 2.0] } as Box, elevation: 0.3 }
const FIT = 3.0

/** Centers of a row of specimens. Spaced by the real horizontal reach of each silhouette (legs, antennae, tails, base ring) so neighbours never touch. */
function rowX(ids: string[]): number[] {
  const yaw = STILL ? STILL_YAW : SPECIMEN_YAW
  const sway = STILL ? 0.02 : SWAY_SPECIMEN
  const ext = ids.map((id) => {
    const xs = specimenOutline(id, FIT, yaw, sway).map((p) => p[0])
    return { l: -Math.min(...xs), r: Math.max(...xs) }
  })
  const xs: number[] = []
  let x = 0
  ext.forEach((e, i) => {
    if (i > 0) x += ext[i - 1].r + e.l + 0.5
    xs.push(x)
  })
  const mid = (xs[0] - ext[0].l + xs[xs.length - 1] + ext[ext.length - 1].r) / 2
  return xs.map((v) => v - mid)
}

function SpecimenVisual({ ids, low, enabledRef }: { ids: string[]; low: boolean; enabledRef: { current: boolean } }) {
  const reduced = useGame((s) => s.settings.reducedMotion)
  const content = useRef<THREE.Group>(null)
  // A stage that is close to square (phones, tablets, big screens with a tall stage) looks down a little more, so the
  // pedestals and animals use more of its height instead of leaving a dark band above and below.
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height))
  const elevation = aspect < 1.9 ? 0.42 : 0.28
  const view = useMemo(() => {
    const xs = rowX(ids)
    const pts: V3[] = ids.flatMap((id, i) => translatePoints(specimenOutline(id, FIT, STILL ? STILL_YAW : SPECIMEN_YAW, STILL ? 0.02 : SWAY_SPECIMEN), [xs[i], 0, 0]))
    return { box: pointsBox(pts), points: pts, elevation, margin: 0.14 }
  }, [ids, elevation])
  const xs = useMemo(() => rowX(ids), [ids])
  return (
    <>
      <FitCamera view={view} measure={content} enabledRef={enabledRef} />
      <group ref={content}>
        {ids.map((id, i) => (
          <group key={id} position={[xs[i], 0, 0]}>
            <StagePedestal radius={specimenRing(id, FIT)} low={low} />
            <Specimen id={id} fit={FIT} sway={SWAY_SPECIMEN} yaw={SPECIMEN_YAW} reduced={reduced} />
          </group>
        ))}
      </group>
    </>
  )
}

function PlantAnimalVisual({ show, low, enabledRef }: { show: string[]; low: boolean; enabledRef: { current: boolean } }) {
  const content = useRef<THREE.Group>(null)
  return (
    <>
      <FitCamera view={PA_VIEW} measure={content} enabledRef={enabledRef} />
      <group ref={content}>
        <group position={[-AX + 0.42, PA_TOP - 0.036, 0]}>
          <StagePedestal radius={PA_RING} low={low} />
        </group>
        <group position={[AX - 0.12, PA_TOP - 0.036, 0]}>
          <StagePedestal radius={PA_RING} low={low} />
        </group>
        <group position={[-AX, PA_TOP + 0.03, 0]}>
          {animalParts().map((p) => (
            <PartMesh key={p.id} part={p} fxId={`a:${p.id}`} highlight={show.includes(p.id)} baseOpacity={0.5} />
          ))}
        </group>
        <group position={[AX, 0, 0]}>
          {plantParts().map((p) => (
            <PartMesh key={p.id} part={p} fxId={`p:${p.id}`} highlight={show.includes(p.id)} baseOpacity={0.5} />
          ))}
        </group>
      </group>
    </>
  )
}

type Slot = 'a' | 'b'

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | undefined> {
  return new Promise((resolve) => {
    const t = window.setTimeout(() => resolve(undefined), ms)
    p.then(
      (v) => {
        window.clearTimeout(t)
        resolve(v)
      },
      () => {
        window.clearTimeout(t)
        resolve(undefined)
      },
    )
  })
}

function hasMesh(obj: THREE.Object3D | null): boolean {
  if (!obj) return false
  let found = false
  obj.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) found = true
  })
  return found
}

/** One specimen (or organ, or plant and animal) plus the lights it was compiled with. */
function SlotScene({ visual, low, enabledRef }: { visual: Visual; low: boolean; enabledRef: { current: boolean } }) {
  return (
    <>
      {visual.kind === 'organ' ? <Lights /> : <SpecimenLights />}
      {visual.kind === 'organ' ? <OrganVisual highlight={visual.highlight} low={low} enabledRef={enabledRef} /> : null}
      {visual.kind === 'specimen' ? <SpecimenVisual ids={visual.ids} low={low} enabledRef={enabledRef} /> : null}
      {visual.kind === 'plantanimal' ? <PlantAnimalVisual show={visual.show} low={low} enabledRef={enabledRef} /> : null}
    </>
  )
}

/** Match the drawing buffer to the stage. The canvas element otherwise stays at the 300 by 150 default. */
function StageSize() {
  const setSize = useThree((s) => s.setSize)
  const gl = useThree((s) => s.gl)
  useFrame(() => {
    const stage = gl.domElement.closest('.visual-3d')
    if (!(stage instanceof HTMLElement)) return
    const w = Math.round(stage.clientWidth)
    const h = Math.round(stage.clientHeight)
    if (w < 2 || h < 2) return
    const box = gl.domElement.getBoundingClientRect()
    if (Math.abs(box.width - w) < 2 && Math.abs(box.height - h) < 2) return
    setSize(w, h)
  })
  return null
}

/**
 * Two slots on one renderer. The slot on screen keeps drawing. The other slot is compiled
 * (hero textures first, then compileAsync) and is shown only after that compile finishes.
 * Swapping earlier presents a cleared frame while the new shaders are still building.
 */
function HeldSlots({ visual, upcoming, low }: { visual: Visual; upcoming: Visual | null; low: boolean }) {
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const scene = useThree((s) => s.scene)
  const [slotA, setSlotA] = useState<Visual>(visual)
  const [slotB, setSlotB] = useState<Visual | null>(null)
  const [front, setFront] = useState<Slot>('a')
  const frontRef = useRef<Slot>('a')
  const slotARef = useRef(slotA)
  const slotBRef = useRef(slotB)
  const groupA = useRef<THREE.Group>(null)
  const groupB = useRef<THREE.Group>(null)
  const tokenA = useRef(visualToken(visual))
  const tokenB = useRef('')
  const activeA = useRef(true)
  const activeB = useRef(false)
  const compiling = useRef(false)
  const compiled = useRef<{ token: string; slot: Slot } | null>(null)
  const queue = useRef<Promise<void>>(Promise.resolve())
  const gen = useRef(0)
  const lowRef = useRef(low)
  lowRef.current = low
  slotARef.current = slotA
  slotBRef.current = slotB
  tokenA.current = visualToken(slotA)
  if (slotB) tokenB.current = visualToken(slotB)
  activeA.current = front === 'a'
  activeB.current = front === 'b'
  const liveToken = visualToken(visual)
  const upcomingToken = upcoming ? visualToken(upcoming) : ''

  const applyFront = () => {
    if (groupA.current) groupA.current.visible = frontRef.current === 'a'
    if (groupB.current) groupB.current.visible = frontRef.current === 'b'
  }

  // While compileAsync yields, the frame loop would otherwise draw the unfinished slot.
  useFrame(() => {
    if (compiling.current) applyFront()
  })

  const show = (slot: Slot) => {
    frontRef.current = slot
    activeA.current = slot === 'a'
    activeB.current = slot === 'b'
    compiling.current = false
    applyFront()
    setFront(slot)
    try {
      gl.render(scene, camera)
    } catch {
      // The running loop presents the compiled slot on the next frame.
    }
  }

  async function warm(next: Visual) {
    if (lowRef.current || next.kind !== 'specimen') return
    const ids = next.ids.filter((id) => hasHero(id))
    if (!ids.length) return
    await withTimeout(Promise.all(ids.map((id) => loadHero(id))), 8000)
  }

  async function mount(slot: Slot, next: Visual, token: string, dead: () => boolean) {
    const bag = slot === 'a' ? tokenA : tokenB
    const current = slot === 'a' ? slotARef.current : slotBRef.current
    if (!current || visualToken(current) !== token) {
      if (slot === 'a') setSlotA(next)
      else setSlotB(next)
      bag.current = ''
    }
    for (let i = 0; i < 180; i++) {
      if (dead()) return false
      const g = slot === 'a' ? groupA.current : groupB.current
      const marked = slot === 'a' ? tokenA.current : tokenB.current
      if (marked === token && hasMesh(g)) return true
      await nextFrame()
    }
    return false
  }

  async function compileGroup(g: THREE.Object3D) {
    await prepareNextHold(
      gl as any,
      scene,
      camera,
      g,
      THREE.WebGLRenderTarget as any,
      (c) => { compiling.current = c },
      applyFront
    )
  }

  const enqueue = (task: () => Promise<void>) => {
    const run = queue.current.then(task, task)
    queue.current = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  useEffect(() => {
    const mine = ++gen.current
    const next = visual
    const token = liveToken
    void enqueue(async () => {
      const dead = () => mine !== gen.current
      const frontVis = frontRef.current === 'a' ? slotARef.current : slotBRef.current
      if (frontVis && visualToken(frontVis) === token) return
      const hit = compiled.current
      if (hit && hit.token === token) {
        const vis = hit.slot === 'a' ? slotARef.current : slotBRef.current
        if (vis && visualToken(vis) === token) {
          show(hit.slot)
          return
        }
      }
      await warm(next)
      if (dead()) return
      const slot: Slot = frontRef.current === 'a' ? 'b' : 'a'
      const ok = await mount(slot, next, token, dead)
      if (!ok || dead()) return
      const g = slot === 'a' ? groupA.current : groupB.current
      if (!g) return
      await compileGroup(g)
      if (dead()) return
      compiled.current = { token, slot }
      show(slot)
    })
    return () => {
      gen.current += 1
    }
    // show, mount, and compileGroup close over refs and the renderer. liveToken is the swap signal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveToken])

  useEffect(() => {
    if (low || !upcoming || !upcomingToken) return
    let dead = false
    const next = upcoming
    const token = upcomingToken
    void enqueue(async () => {
      if (dead || lowRef.current) return
      const frontVis = frontRef.current === 'a' ? slotARef.current : slotBRef.current
      if (frontVis && visualToken(frontVis) === token) return
      if (compiled.current?.token === token) return
      await warm(next)
      if (dead) return
      const slot: Slot = frontRef.current === 'a' ? 'b' : 'a'
      const ok = await mount(slot, next, token, () => dead)
      if (!ok || dead) return
      const g = slot === 'a' ? groupA.current : groupB.current
      if (!g || dead) return
      await compileGroup(g)
      if (dead) return
      compiled.current = { token, slot }
    })
    return () => {
      dead = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upcomingToken, low])

  return (
    <>
      <group ref={groupA} visible={front === 'a'}>
        <SlotScene visual={slotA} low={low} enabledRef={activeA} />
      </group>
      {slotB ? (
        <group ref={groupB} visible={front === 'b'}>
          <SlotScene visual={slotB} low={low} enabledRef={activeB} />
        </group>
      ) : null}
    </>
  )
}

/** The shared small canvas for item art. One renderer. The visible slot stays up until the next one has compiled. */
export default function ItemVisualCanvas({ visual, upcoming = null }: { visual: Visual; upcoming?: Visual | null }) {
  const quality = useGame((s) => s.settings.quality)
  const autoTier = useRuntime((s) => s.autoTier)
  const tier = resolveTier(quality, autoTier)
  const tierRef = useRef(tier)
  // These canvases are small, so Low tier still gets a sharp image: up to 2x pixels and edge smoothing.
  const dpr = tier === 'low' ? Math.max(dprForTier(tier, window.devicePixelRatio), Math.min(window.devicePixelRatio || 1, 2)) : dprForTier(tier, window.devicePixelRatio)
  const gl = useCallback((props: Record<string, unknown>) => createRenderer(props, tierRef.current, () => {}, tierRef.current === 'low'), [])
  const camera = useMemo(() => ({ fov: 35, near: 0.1, far: 120, position: [0, 3, 12] as [number, number, number] }), [])

  return (
    <Canvas gl={gl as never} dpr={dpr} camera={camera} frameloop="always" aria-hidden="true" style={{ position: 'absolute', inset: 0 }}>
      <StageSize />
      <StageBackdrop />
      <HeldSlots visual={visual} upcoming={upcoming ?? null} low={tier === 'low'} />
    </Canvas>
  )
}
