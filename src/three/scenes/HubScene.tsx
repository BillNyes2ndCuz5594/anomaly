import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { STILL } from '../../lib/flags'
import { resolveTier, TIER_CONFIG } from '../../state/quality'
import { useRuntime } from '../../state/runtime'
import { useGame } from '../../state/store'
import { Backdrop, ConsoleRing, ContactShadow, DeckLights, DeckPlate, Dust, GridFloor } from './common'
import { FloorPool, SubjectLights, VolumeColumn } from './grade'
import { useWidthFit } from './case/common'
import Drone from './hub/Drone'
import MapTable, { TABLE_RADIUS, TABLE_TOP_Y } from './hub/MapTable'
import { sceneCalm } from './hub/markerMotion'
import Markers from './hub/Markers'

const FINAL = { x: 0, y: 8.2, z: 9.2 }
const START = { x: 8, y: 10, z: 15 }
const LOOK = { x: 0, y: 1.3, z: 0.4 }
const DRONE_POS: [number, number, number] = [-2.15, 2.85, 2.2]

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

export default function HubScene() {
  const calm = sceneCalm(useGame((s) => s.settings.reducedMotion), STILL)
  const quality = useGame((s) => s.settings.quality)
  const autoTier = useRuntime((s) => s.autoTier)
  const tier = resolveTier(quality, autoTier)
  const cfg = TIER_CONFIG[tier]
  const rich = tier !== 'low'
  const start = useRef(performance.now())
  // Keep the whole map table in view on a tall narrow screen (phone held upright).
  const fit = useWidthFit(TABLE_RADIUS + 0.7, 11.2, 66, 0.04)

  useFrame((state, dt) => {
    const cam = state.camera
    const t = (performance.now() - start.current) / 1000
    const k = calm ? 1 : easeOutCubic(Math.min(1, t / 2.4))
    // Gentle pointer parallax once the intro has settled.
    const px = calm ? 0 : state.pointer.x * 0.35 * k
    const py = calm ? 0 : state.pointer.y * 0.18 * k
    const back = fit.current
    const x = LOOK.x + (START.x + (FINAL.x - START.x) * k + px - LOOK.x) * back
    const y = LOOK.y + (START.y + (FINAL.y - START.y) * k + py - LOOK.y) * back
    const z = LOOK.z + (START.z + (FINAL.z - START.z) * k - LOOK.z) * back
    const follow = calm ? 1 : 1 - Math.exp(-dt * 7)
    cam.position.x += (x - cam.position.x) * follow
    cam.position.y += (y - cam.position.y) * follow
    cam.position.z += (z - cam.position.z) * follow
    cam.lookAt(LOOK.x, LOOK.y, LOOK.z)
    const fog = state.scene.fog as { density: number } | null
    if (fog) fog.density = 0.02 / back
  })

  return (
    <>
      <fogExp2 attach="fog" args={['#070c17', 0.02]} />
      <DeckLights />
      <SubjectLights strength={rich ? 1 : 0.75} />
      <pointLight position={[0.4, TABLE_TOP_Y + 4.2, 2.4]} intensity={rich ? 10 : 6} color="#d7f6ff" distance={11} decay={2} />
      <pointLight position={[-4.2, 3.4, -3.2]} intensity={rich ? 7 : 4} color="#7ee7ff" distance={12} decay={2} />
      <Backdrop clip="swamp" />
      <DeckPlate />
      <GridFloor fade={32} />
      <FloorPool position={[0, 0.02, 0]} radius={6.2} opacity={0.5} />
      <FloorPool position={[DRONE_POS[0], 0.02, DRONE_POS[2]]} radius={2.2} inner="rgba(180,220,255,0.16)" opacity={0.4} />
      <ConsoleRing radius={13} count={16} arc={Math.PI * 1.1} />
      <MapTable reduced={calm} />
      {rich ? <VolumeColumn position={[0.15, TABLE_TOP_Y + 1.35, -0.15]} radius={1.15} height={2.5} calm={calm} /> : null}
      <Markers reduced={calm} />
      <Drone reduced={calm} position={DRONE_POS} scale={1} />
      {cfg.contactShadow ? (
        <>
          <ContactShadow position={[0, 0.012, 0]} radius={5.4} opacity={0.85} />
          <ContactShadow position={[DRONE_POS[0], 0.012, DRONE_POS[2]]} radius={1.1} opacity={0.6} />
        </>
      ) : null}
      <Dust tier={tier} spread={[22, 7, 22]} baseY={0.3} />
    </>
  )
}
