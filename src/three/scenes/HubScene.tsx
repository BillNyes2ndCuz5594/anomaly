import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { resolveTier, TIER_CONFIG } from '../../state/quality'
import { useRuntime } from '../../state/runtime'
import { useGame } from '../../state/store'
import { Backdrop, ConsoleRing, ContactShadow, DeckLights, DeckPlate, Dust, GridFloor } from './common'
import { useWidthFit } from './case/common'
import Drone from './hub/Drone'
import MapTable, { TABLE_RADIUS, TABLE_TOP_Y } from './hub/MapTable'
import Markers from './hub/Markers'

const FINAL = { x: 0, y: 8.2, z: 9.2 }
const START = { x: 8, y: 10, z: 15 }
const LOOK = { x: 0, y: 1.3, z: 0.4 }
const DRONE_POS: [number, number, number] = [-2.15, 2.85, 2.2]

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

export default function HubScene() {
  const reduced = useGame((s) => s.settings.reducedMotion)
  const quality = useGame((s) => s.settings.quality)
  const autoTier = useRuntime((s) => s.autoTier)
  const tier = resolveTier(quality, autoTier)
  const cfg = TIER_CONFIG[tier]
  const start = useRef(performance.now())
  // Keep the whole map table in view on a tall narrow screen (phone held upright).
  const fit = useWidthFit(TABLE_RADIUS + 0.7, 11.2, 66, 0.04)

  useFrame((state, dt) => {
    const cam = state.camera
    const t = (performance.now() - start.current) / 1000
    const k = reduced ? 1 : easeOutCubic(Math.min(1, t / 2.4))
    // Gentle pointer parallax once the intro has settled.
    const px = reduced ? 0 : state.pointer.x * 0.45 * k
    const py = reduced ? 0 : state.pointer.y * 0.25 * k
    const back = fit.current
    const x = LOOK.x + (START.x + (FINAL.x - START.x) * k + px - LOOK.x) * back
    const y = LOOK.y + (START.y + (FINAL.y - START.y) * k + py - LOOK.y) * back
    const z = LOOK.z + (START.z + (FINAL.z - START.z) * k - LOOK.z) * back
    const follow = reduced ? 1 : 1 - Math.exp(-dt * 7)
    cam.position.x += (x - cam.position.x) * follow
    cam.position.y += (y - cam.position.y) * follow
    cam.position.z += (z - cam.position.z) * follow
    cam.lookAt(LOOK.x, LOOK.y, LOOK.z)
    const fog = state.scene.fog as { density: number } | null
    if (fog) fog.density = 0.016 / back
  })

  return (
    <>
      <fogExp2 attach="fog" args={['#070c17', 0.016]} />
      <DeckLights />
      <pointLight position={[0, TABLE_TOP_Y + 3.4, 0.5]} intensity={8} color="#3ee6ff" distance={9} decay={2} />
      <pointLight position={[-3.5, 3.2, 4.5]} intensity={5} color="#ffd9a0" distance={9} decay={2} />
      <Backdrop clip="swamp" />
      <DeckPlate />
      <GridFloor fade={32} />
      <ConsoleRing radius={13} count={16} arc={Math.PI * 1.1} />
      <MapTable reduced={reduced} />
      <Markers reduced={reduced} />
      <Drone reduced={reduced} position={DRONE_POS} scale={1} />
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
