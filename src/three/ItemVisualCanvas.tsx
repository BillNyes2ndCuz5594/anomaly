import { Canvas, useThree } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import type * as THREE from 'three/webgpu'
import { STILL, STILL_YAW } from '../lib/flags'
import { FitCamera } from './FitCamera'
import { pointsBox, sweepYaw, unionBox, type Box } from './fit'
import { DISPLAY_YAW, placeEvidence, shapeReach, specimenRing } from './models/specimenBox'
import { hasHero, heroIfReady, loadHero, onHeroReady } from './models/heroSpecimens'
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

// Animal at x -3.0 (x -1.8 to 2.6 around it, 3.5 tall, feet at 0), plant at x 3.0 (x -2.3 to 2.1, roots down to -1.24 and
// crown up to 3.25). Both hologram pairs stand on one shared baseline: a pedestal top just under the root tips.
const PA_TOP = -1.27
const PA_RING = 2.3
const AX = 3.0
const PA_VIEW = { box: { min: [-5.3, -1.42, -2.0], max: [5.3, 3.7, 2.0] } as Box, elevation: 0.3 }
const FIT = 3.0

/** Honest relative sizes and facing. Once every scan has loaded, lengths come from the scans; before that, the proxy. */
function evidenceFor(ids: string[], scans: boolean) {
  const base = STILL ? STILL_YAW : SPECIMEN_YAW
  const reachOf = (id: string): number => {
    const h = scans ? heroIfReady(id) : undefined
    if (!h) return shapeReach(id)
    const b = h.geo.boundingBox ?? (h.geo.computeBoundingBox(), h.geo.boundingBox!)
    return Math.max(b.max.x - b.min.x, b.max.z - b.min.z)
  }
  return placeEvidence(ids, FIT, base, STILL ? 0.02 : SWAY_SPECIMEN, reachOf)
}

function SpecimenVisual({ ids, low }: { ids: string[]; low: boolean }) {
  const reduced = useGame((s) => s.settings.reducedMotion)
  const content = useRef<THREE.Group>(null)
  // A stage that is close to square (phones, tablets, big screens with a tall stage) looks down a little more, so the
  // pedestals and animals use more of its height instead of leaving a dark band above and below.
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height))
  const elevation = aspect < 1.9 ? 0.42 : 0.28
  const heroIds = useMemo(() => (low ? [] : ids.filter(hasHero)), [ids, low])
  useEffect(() => {
    heroIds.forEach((id) => void loadHero(id))
  }, [heroIds])
  const scans = useSyncExternalStore(onHeroReady, () => heroIds.length > 0 && heroIds.every((id) => !!heroIfReady(id)))
  const { placed, points } = useMemo(() => evidenceFor(ids, scans), [ids, scans])
  const view = useMemo(() => ({ box: pointsBox(points), points, elevation, margin: 0.14 }), [points, elevation])
  return (
    <>
      <FitCamera view={view} measure={content} />
      <group ref={content}>
        {placed.map((s) => (
          <group key={s.id} position={[s.x, 0, 0]}>
            <StagePedestal radius={specimenRing(s.id, s.fit)} low={low} />
            <group rotation={[0, s.flip, 0]}>
              <Specimen id={s.id} fit={s.fit} sway={SWAY_SPECIMEN} yaw={SPECIMEN_YAW} reduced={reduced} />
            </group>
          </group>
        ))}
      </group>
    </>
  )
}

function PlantAnimalVisual({ show, low }: { show: string[]; low: boolean }) {
  const content = useRef<THREE.Group>(null)
  return (
    <>
      <FitCamera view={PA_VIEW} measure={content} />
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
      <StageBackdrop />
      {visual.kind === 'organ' ? <Lights /> : <SpecimenLights />}
      {visual.kind === 'organ' ? <OrganVisual highlight={visual.highlight} low={tier === 'low'} /> : null}
      {visual.kind === 'specimen' ? <SpecimenVisual ids={visual.ids} low={tier === 'low'} /> : null}
      {visual.kind === 'plantanimal' ? <PlantAnimalVisual show={visual.show} low={tier === 'low'} /> : null}
    </Canvas>
  )
}
