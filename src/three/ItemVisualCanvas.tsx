import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useCallback, useMemo, useRef } from 'react'
import type * as THREE from 'three/webgpu'
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

/** Fits a w by h box centered on (cx, cy) into the view, whatever the canvas aspect. */
function FitCamera({ cx, cy, w, h }: { cx: number; cy: number; w: number; h: number }) {
  const size = useThree((s) => s.size)
  useFrame((state) => {
    const cam = state.camera as THREE.PerspectiveCamera
    const tan = Math.tan((cam.fov * Math.PI) / 360)
    const aspect = size.width / Math.max(1, size.height)
    const dist = Math.max(h / 2 / tan, w / 2 / (tan * aspect)) * 1.06
    cam.position.set(cx, cy + dist * 0.1, dist)
    cam.lookAt(cx, cy, 0)
  })
  return null
}

function Lights() {
  return (
    <>
      <hemisphereLight args={['#8fc2ff', '#0a1220', 0.9]} />
      <directionalLight position={[4, 8, 6]} intensity={1.6} color="#dff3ff" />
      <pointLight position={[-5, 3, 4]} intensity={14} color="#ffb547" distance={24} decay={2} />
    </>
  )
}

function OrganVisual({ highlight }: { highlight: string[] }) {
  const { cy, h } = useMemo(() => {
    const m = humanModel()
    const ys = highlight.filter((id) => m.organs.has(id)).map((id) => m.organs.get(id)!.center[1])
    if (highlight.length === 0 || highlight.includes('muscles') || ys.length === 0) return { cy: 2.55, h: 5.6 }
    const lo = Math.min(...ys)
    const hi = Math.max(...ys)
    return { cy: (lo + hi) / 2, h: Math.max(4.6, hi - lo + 3) }
  }, [highlight])
  const reduced = useGame((s) => s.settings.reducedMotion)
  return (
    <>
      <FitCamera cx={0} cy={cy} w={h * 0.8} h={h} />
      <Pedestal radius={2} />
      <HumanFigure mode="visual" highlight={highlight} reduced={reduced} />
    </>
  )
}

const SPACING = 3.6

function SpecimenVisual({ ids }: { ids: string[] }) {
  const reduced = useGame((s) => s.settings.reducedMotion)
  const n = ids.length
  return (
    <>
      <FitCamera cx={0} cy={1.3} w={n * SPACING} h={3.4} />
      {ids.map((id, i) => (
        <group key={id} position={[(i - (n - 1) / 2) * SPACING, 0, 0]}>
          <Pedestal radius={1.4} />
          <Specimen id={id} fit={2.7} spin reduced={reduced} />
        </group>
      ))}
    </>
  )
}

function PlantAnimalVisual({ show }: { show: string[] }) {
  return (
    <>
      <FitCamera cx={0} cy={1.1} w={12.6} h={5.9} />
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
