import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three/webgpu'
import { STILL } from '../../lib/flags'
import { resolveTier, TIER_CONFIG } from '../../state/quality'
import { useRuntime } from '../../state/runtime'
import { prefersReducedMotion } from '../../state/settings'
import { useGame } from '../../state/store'
import { Backdrop, ConsoleRing, ContactShadow, DeckLights, DeckPlate, Dust, GridFloor } from './common'
import { FloorPool, SubjectLights, VolumeColumn } from './grade'
import { useWidthFit } from './case/sceneHelpers'
import Drone from './hub/Drone'
import MapTable, { TABLE_RADIUS, TABLE_TOP_Y } from './hub/MapTable'
import { markerNeedsPan, markerWorldPositions, panOffsetStep, PAN_FRACTION, sceneCalm } from './hub/markerMotion'
import Markers from './hub/Markers'

const FINAL = { x: 0, y: 8.2, z: 9.2 }
const START = { x: 8, y: 10, z: 15 }
const LOOK = { x: 0, y: 1.3, z: 0.4 }
const DRONE_POS: [number, number, number] = [-2.15, 2.85, 2.2]

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

export default function HubScene() {
  const { gl, scene, camera } = useThree()
  const warmup = useRef<Promise<unknown> | null>(null)
  useEffect(() => {
    let active = true
    let released = false
    const release = () => {
      if (!active || released) return
      released = true
      start.current = performance.now()
      useRuntime.getState().setHubReady(true)
    }
    useRuntime.getState().setHubReady(false)
    const timer = window.setTimeout(release, 1500)
    warmup.current ??= (gl as unknown as { compileAsync: (scene: unknown, camera: unknown) => Promise<void> })
      .compileAsync(scene, camera)
    void warmup.current.then(release, release)
    return () => {
      active = false
      window.clearTimeout(timer)
      useRuntime.getState().setHubReady(false)
    }
  }, [gl, scene, camera])
  const calm = sceneCalm(useGame((s) => s.settings.reducedMotion) || prefersReducedMotion(), STILL)
  const quality = useGame((s) => s.settings.quality)
  const autoTier = useRuntime((s) => s.autoTier)
  const tier = resolveTier(quality, autoTier)
  const cfg = TIER_CONFIG[tier]
  const rich = tier !== 'low'
  const [mountedAt] = useState(() => performance.now())
  const start = useRef(mountedAt)
  // Keep the whole map table in view on a tall narrow screen (phone held upright).
  const fit = useWidthFit(TABLE_RADIUS + 0.7, 11.2, 66, 0.04)

  const pan = useRef({ x: 0, y: 0, z: 0 })
  const targetPan = useRef({ x: 0, y: 0, z: 0 })
  const panningId = useRef<string | null>(null)
  const tmpProj = useRef(new THREE.Vector3())

  useFrame((state, dt) => {
    const cam = state.camera
    const focused = useRuntime.getState().focusedMarker
    const markerPos = focused ? markerWorldPositions.get(focused) : null
    if (!markerPos || !focused) {
      panningId.current = null
      targetPan.current.x = 0
      targetPan.current.y = 0
      targetPan.current.z = 0
    } else if (panningId.current !== focused) {
      tmpProj.current.copy(markerPos).project(cam)
      if (markerNeedsPan(tmpProj.current.x, tmpProj.current.y)) {
        panningId.current = focused
        targetPan.current.x = (markerPos.x - LOOK.x) * PAN_FRACTION
        targetPan.current.y = (markerPos.y - LOOK.y) * PAN_FRACTION
        targetPan.current.z = (markerPos.z - LOOK.z) * PAN_FRACTION
      } else {
        panningId.current = null
        targetPan.current.x = 0
        targetPan.current.y = 0
        targetPan.current.z = 0
      }
    }

    const t = (performance.now() - start.current) / 1000
    const k = calm ? 1 : easeOutCubic(Math.min(1, t / 2.4))
    // Gentle pointer parallax once the intro has settled.
    const px = calm ? 0 : state.pointer.x * 0.35 * k
    const py = calm ? 0 : state.pointer.y * 0.18 * k
    const back = fit.current
    const targetX = LOOK.x + (START.x + (FINAL.x - START.x) * k + px - LOOK.x) * back + targetPan.current.x
    const targetY = LOOK.y + (START.y + (FINAL.y - START.y) * k + py - LOOK.y) * back + targetPan.current.y
    const targetZ = LOOK.z + (START.z + (FINAL.z - START.z) * k - LOOK.z) * back + targetPan.current.z
    const follow = calm ? 1 : 1 - Math.exp(-dt * 7)
    cam.position.x += (targetX - cam.position.x) * follow
    cam.position.y += (targetY - cam.position.y) * follow
    cam.position.z += (targetZ - cam.position.z) * follow
    pan.current.x = panOffsetStep(pan.current.x, targetPan.current.x, dt, calm)
    pan.current.y = panOffsetStep(pan.current.y, targetPan.current.y, dt, calm)
    pan.current.z = panOffsetStep(pan.current.z, targetPan.current.z, dt, calm)
    cam.lookAt(LOOK.x + pan.current.x, LOOK.y + pan.current.y, LOOK.z + pan.current.z)
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
      <MapTable reduced={calm} rich={rich} />
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
