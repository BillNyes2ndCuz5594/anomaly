import { Canvas } from '@react-three/fiber'
import { useCallback, useMemo, useRef } from 'react'
import type * as THREE from 'three/webgpu'
import { STILL, STILL_YAW } from '../lib/flags'
import { FitCamera } from './FitCamera'
import { sweepYaw, translateBox, unionBox, type Box } from './fit'
import { specimenBox } from './models/specimenBox'
import type { Visual } from '../content/schema'
import { resolveTier, dprForTier } from '../state/quality'
import { useRuntime } from '../state/runtime'
import { useGame } from '../state/store'
import { createRenderer } from './renderer'
import { animalParts, plantParts } from './models/creatures'
import { humanModel } from './models/human'
import { Pedestal } from './scenes/case/common'
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

const RING = 2.15
const ringBox = (r: number): Box => ({ min: [-r, 0, -r], max: [r, 0.06, r] })
const SWAY_BODY = 0.5
const SWAY_SPECIMEN = 0.3
const SPECIMEN_YAW = -0.55

function OrganVisual({ highlight }: { highlight: string[] }) {
  const reduced = useGame((s) => s.settings.reducedMotion)
  const content = useRef<THREE.Group>(null)
  // The whole body at every point of its sway, plus the base ring.
  const box = useMemo(() => unionBox(sweepYaw(humanModel().box, STILL ? 0.4 : SWAY_BODY, 24, STILL ? 0.3 : 0), ringBox(RING)), [])
  const view = useMemo(() => ({ box, elevation: 0.14 }), [box])
  return (
    <>
      <FitCamera view={view} measure={content} />
      <group ref={content}>
        <Pedestal radius={RING} />
        <HumanFigure mode="visual" highlight={highlight} reduced={reduced} />
      </group>
    </>
  )
}

// Animal at x -3.4 (about 4.6 wide, 3 tall), plant at x 3.4 (about 3 wide, from roots at -1.3 up to 3.6).
const PLANT_ANIMAL_VIEW = { box: { min: [-6.0, -1.4, -1.0], max: [5.2, 3.7, 1.0] } as Box, elevation: 0.1 }
const SPACING = 4.2
const FIT = 3.0

function SpecimenVisual({ ids }: { ids: string[] }) {
  const reduced = useGame((s) => s.settings.reducedMotion)
  const content = useRef<THREE.Group>(null)
  const n = ids.length
  const view = useMemo(() => {
    const parts = ids.map((id, i) => {
      const x = (i - (n - 1) / 2) * SPACING
      const sw = sweepYaw(specimenBox(id, FIT), STILL ? 0.02 : SWAY_SPECIMEN, 16, STILL ? STILL_YAW : SPECIMEN_YAW)
      return unionBox(translateBox(sw, [x, 0, 0]), translateBox(ringBox(1.6), [x, 0, 0]))
    })
    return { box: unionBox(...parts), elevation: 0.24 }
  }, [ids, n])
  return (
    <>
      <FitCamera view={view} measure={content} />
      <group ref={content}>
        {ids.map((id, i) => (
          <group key={id} position={[(i - (n - 1) / 2) * SPACING, 0, 0]}>
            <Pedestal radius={1.6} />
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
  const dpr = dprForTier(tier, window.devicePixelRatio)
  const gl = useCallback((props: Record<string, unknown>) => createRenderer(props, tierRef.current, () => {}), [])
  const camera = useMemo(() => ({ fov: 35, near: 0.1, far: 120, position: [0, 3, 12] as [number, number, number] }), [])

  return (
    <Canvas gl={gl as never} dpr={dpr} camera={camera} frameloop="always" aria-hidden="true" style={{ position: 'absolute', inset: 0 }}>
      <color attach="background" args={['#091222']} />
      <Lights />
      {visual.kind === 'organ' ? <OrganVisual highlight={visual.highlight} /> : null}
      {visual.kind === 'specimen' ? <SpecimenVisual ids={visual.ids} /> : null}
      {visual.kind === 'plantanimal' ? <PlantAnimalVisual show={visual.show} /> : null}
    </Canvas>
  )
}
