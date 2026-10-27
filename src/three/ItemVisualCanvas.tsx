import { Canvas, useThree } from '@react-three/fiber'
import { useCallback, useMemo, useRef } from 'react'
import type * as THREE from 'three/webgpu'
import { STILL, STILL_YAW } from '../lib/flags'
import { FitCamera } from './FitCamera'
import { pointsBox, sweepYaw, translatePoints, unionBox, type Box, type V3 } from './fit'
import { DISPLAY_YAW, specimenOutline, specimenRing } from './models/specimenBox'
import type { Visual } from '../content/schema'
import { resolveTier, dprForTier } from '../state/quality'
import { useRuntime } from '../state/runtime'
import { useGame } from '../state/store'
import { createRenderer } from './renderer'
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

function OrganVisual({ highlight, low }: { highlight: string[]; low: boolean }) {
  const reduced = useGame((s) => s.settings.reducedMotion)
  const content = useRef<THREE.Group>(null)
  // The whole body at every point of its sway, plus the base ring.
  const box = useMemo(() => unionBox(sweepYaw(humanModel(low).box, STILL ? 0.4 : low ? 0.2 : SWAY_BODY, 24, STILL ? 0.3 : 0), ringBox(RING)), [low])
  const view = useMemo(() => ({ box, elevation: 0.14 }), [box])
  return (
    <>
      <FitCamera view={view} measure={content} />
      <group ref={content}>
        <StagePedestal radius={RING} low={low} />
        <HumanFigure mode="visual" highlight={highlight} reduced={reduced} />
      </group>
    </>
  )
}

// Animal at x -3.4 (about 4.6 wide, 3 tall), plant at x 3.4 (about 3 wide, from roots at -1.3 up to 3.6).
const PLANT_ANIMAL_VIEW = { box: { min: [-6.0, -1.4, -1.0], max: [5.2, 3.7, 1.0] } as Box, elevation: 0.1 }
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

function SpecimenVisual({ ids, low }: { ids: string[]; low: boolean }) {
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
      <FitCamera view={view} measure={content} />
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

function PlantAnimalVisual({ show }: { show: string[] }) {
  const content = useRef<THREE.Group>(null)
  return (
    <>
      <FitCamera view={PLANT_ANIMAL_VIEW} measure={content} />
      <group ref={content}>
      <group position={[-3.4, 0, 0]}>
        {animalParts().map((p) => (
          <PartMesh key={p.id} part={p} fxId={`a:${p.id}`} highlight={show.includes(p.id)} baseOpacity={0.5} />
        ))}
      </group>
      <group position={[3.4, 0, 0]}>
        {plantParts().map((p) => (
          <PartMesh key={p.id} part={p} fxId={`p:${p.id}`} highlight={show.includes(p.id)} baseOpacity={0.5} />
        ))}
      </group>
      </group>
    </>
  )
}

/** The shared small canvas for item art. One renderer, content swaps with the item. */
export default function ItemVisualCanvas({ visual }: { visual: Visual }) {
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
      {visual.kind === 'plantanimal' ? <color attach="background" args={['#091222']} /> : <StageBackdrop />}
      {visual.kind === 'specimen' ? <SpecimenLights /> : <Lights />}
      {visual.kind === 'organ' ? <OrganVisual highlight={visual.highlight} low={tier === 'low'} /> : null}
      {visual.kind === 'specimen' ? <SpecimenVisual ids={visual.ids} low={tier === 'low'} /> : null}
      {visual.kind === 'plantanimal' ? <PlantAnimalVisual show={visual.show} /> : null}
    </Canvas>
  )
}
