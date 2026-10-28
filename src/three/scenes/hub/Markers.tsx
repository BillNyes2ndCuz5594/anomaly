import { Billboard } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import * as THREE from 'three/webgpu'
import { color, uniform, float, oneMinus, positionLocal, saturate, sin, smoothstep, time, uv, length } from 'three/tsl'
import { STILL } from '../../../lib/flags'
import { navigate } from '../../../lib/router'
import { useReviewDue } from '../../../state/due'
import { useRuntime } from '../../../state/runtime'
import { lonLatToXZ } from '../../data/florida'
import { makeLabelTexture } from '../../labels'
import { TABLE_TOP_Y } from './MapTable'
import { markerGlowMul, markerHitRadius, markerPressed, markerScale, sceneCalm, setMarkerPressed, subscribeMarkerPressed } from './markerMotion'

const tmpScale = new THREE.Vector3()
const tmpHit = new THREE.Vector3()

interface MarkerProps {
  id: 'case' | 'cold'
  lon: number
  lat: number
  height: number
  hex: string
  title: string
  sub: string
  to: string
  /** 1 puts the label to the right of the gem, -1 to the left. */
  side: 1 | -1
  reduced: boolean
  /** Glow level, 1 is full. A cold case with no review due idles at a lower glow. */
  glow?: number
}

function Marker({ id, lon, lat, height, hex, title, sub, to, side, reduced, glow = 1 }: MarkerProps) {
  const [x, z] = lonLatToXZ(lon, lat)
  const gem = useRef<THREE.Group>(null)
  const root = useRef<THREE.Group>(null)
  const anchor = useRef<THREE.Group>(null)
  const hit = useRef<THREE.Mesh>(null)
  const [hover, setHover] = useState(false)
  const focused = useRuntime((s) => s.focusedMarker === id)
  const pressed = useSyncExternalStore(subscribeMarkerPressed, () => markerPressed(id), () => false)
  const calm = sceneCalm(reduced, STILL)
  const flags = { hover, focused, pressed }

  const glowU = useMemo(() => uniform(glow), []) // eslint-disable-line react-hooks/exhaustive-deps
  const { gemMat, wireMat, beamMat, ringMat, label } = useMemo(() => {
    const c = color(hex).mul(glowU)
    const clock = calm ? float(0.4) : time
    const gemMat = new THREE.MeshStandardNodeMaterial()
    gemMat.color = new THREE.Color('#06101c')
    gemMat.roughness = 0.2
    gemMat.metalness = 0.6
    gemMat.emissiveNode = c.mul(float(2.2).add(calm ? float(0) : sin(clock.mul(3)).mul(0.5)))

    const wireMat = new THREE.MeshBasicNodeMaterial()
    wireMat.colorNode = c.mul(2.4)
    wireMat.wireframe = true

    // Beam: bright at the base, fading upward, with a pulse running up it.
    const beamMat = new THREE.MeshBasicNodeMaterial()
    const h = saturate(positionLocal.y.add(0.5))
    const run = smoothstep(0.0, 1.0, sin(h.mul(14).sub(clock.mul(3))).mul(0.5).add(0.5)).mul(0.5).add(0.5)
    beamMat.colorNode = c.mul(run.mul(1.8))
    beamMat.opacityNode = oneMinus(h).mul(0.7).add(0.1)
    beamMat.transparent = true
    beamMat.blending = THREE.AdditiveBlending
    beamMat.depthWrite = false
    beamMat.side = THREE.DoubleSide

    // Ground ring: two circles. The outer one breathes unless motion is held.
    const ringMat = new THREE.MeshBasicNodeMaterial()
    const d = length(uv().sub(0.5)).mul(2)
    const wave = calm ? float(0) : sin(clock.mul(2.4)).mul(0.08)
    const r1 = oneMinus(saturate(d.sub(0.62).sub(wave).abs().div(0.045)))
    const r2 = oneMinus(saturate(d.sub(0.95).abs().div(0.03))).mul(0.6)
    const fill = oneMinus(smoothstep(0.0, 0.62, d)).mul(0.28)
    const ringAmt = r1.add(r2).add(fill)
    ringMat.colorNode = c.mul(ringAmt.mul(2.2))
    ringMat.opacityNode = saturate(ringAmt)
    ringMat.transparent = true
    ringMat.blending = THREE.AdditiveBlending
    ringMat.depthWrite = false

    const label = makeLabelTexture(title, hex, sub)
    const labelMat = new THREE.MeshBasicNodeMaterial()
    labelMat.map = label.tex
    labelMat.transparent = true
    labelMat.depthWrite = false
    labelMat.depthTest = false
    return { gemMat, wireMat, beamMat, ringMat, label: { ...label, mat: labelMat } }
  }, [hex, title, sub, glowU, calm])

  useEffect(
    () => () => {
      gemMat.dispose()
      wireMat.dispose()
      beamMat.dispose()
      ringMat.dispose()
      label.tex.dispose()
      label.mat.dispose()
    },
    [gemMat, wireMat, beamMat, ringMat, label],
  )

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    const mix = calm ? 1 : Math.min(1, dt * 8)
    glowU.value += (glow * markerGlowMul(flags) - glowU.value) * mix
    if (gem.current) {
      if (!calm) {
        gem.current.rotation.y += dt * 0.7
        gem.current.position.y = height + Math.sin(t * 1.3 + x) * 0.05
      } else {
        gem.current.position.y = height
      }
    }
    if (root.current) {
      const target = markerScale(flags)
      if (calm) root.current.scale.setScalar(target)
      else root.current.scale.lerp(tmpScale.setScalar(target), Math.min(1, dt * 9))
    }
    const cam = state.camera as THREE.PerspectiveCamera
    const origin = anchor.current?.getWorldPosition(tmpHit) ?? tmpHit.set(x, TABLE_TOP_Y, z)
    const radius = markerHitRadius(state.size.height, cam.position.distanceTo(origin), cam.fov)
    if (hit.current) hit.current.scale.set(radius / 0.55, 1, radius / 0.55)
  })

  const base = TABLE_TOP_Y + 0.42
  const beamH = height - 0.4
  const release = () => setMarkerPressed(id, false)
  return (
    <group ref={anchor} position={[x, base, z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[1.5, 1.5]} />
        <primitive object={ringMat} attach="material" />
      </mesh>
      <group ref={root}>
        <mesh position={[0, beamH / 2 + 0.05, 0]} scale={[1, beamH, 1]}>
          <cylinderGeometry args={[0.035, 0.07, 1, 12, 1, true]} />
          <primitive object={beamMat} attach="material" />
        </mesh>
        <group ref={gem} position={[0, height, 0]}>
          <mesh scale={[0.9, 1.35, 0.9]}>
            <octahedronGeometry args={[0.2, 0]} />
            <primitive object={gemMat} attach="material" />
          </mesh>
          <mesh scale={[1.18, 1.75, 1.18]}>
            <octahedronGeometry args={[0.2, 0]} />
            <primitive object={wireMat} attach="material" />
          </mesh>
        </group>
        <mesh position={[0.3 * side, height, 0]}>
          <boxGeometry args={[0.6, 0.012, 0.012]} />
          <primitive object={wireMat} attach="material" />
        </mesh>
        <Billboard position={[(0.6 + 0.8) * side, height, 0]}>
          <mesh renderOrder={10}>
            <planeGeometry args={[1.6, 1.6 / label.aspect]} />
            <primitive object={label.mat} attach="material" />
          </mesh>
        </Billboard>
      </group>
      {/* Generous invisible hit target so the marker is easy to click. */}
      <mesh
        ref={hit}
        position={[0, height * 0.5, 0]}
        visible={false}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHover(true)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          setHover(false)
          release()
          document.body.style.cursor = ''
        }}
        onPointerDown={(e) => {
          e.stopPropagation()
          setMarkerPressed(id, true)
        }}
        onPointerUp={(e) => {
          e.stopPropagation()
          release()
        }}
        onPointerCancel={release}
        onClick={(e) => {
          e.stopPropagation()
          document.body.style.cursor = ''
          release()
          navigate(to)
        }}
      >
        <cylinderGeometry args={[0.55, 0.55, height + 0.9, 12]} />
        <meshBasicMaterial />
      </mesh>
    </group>
  )
}

/** Case markers floating over the map. Mirrored as HTML buttons in the side panel. */
export default function Markers({ reduced }: { reduced: boolean }) {
  const due = useReviewDue()
  return (
    <>
      <Marker
        id="case"
        lon={-81.4}
        lat={28.5}
        height={1.75}
        hex="#ffb547"
        title="CASE 03-1 VITALS"
        sub="Living Things"
        to="/case/03-1"
        side={1}
        reduced={reduced}
      />
      <Marker
        id="cold"
        lon={-81.1}
        lat={26.2}
        height={1.2}
        hex="#3ee6ff"
        title="COLD CASE RESIDUE"
        sub="Review"
        to="/cold/cold-1"
        side={1}
        reduced={reduced}
        glow={due ? 1.35 : 0.5}
      />
    </>
  )
}
