import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import * as THREE from 'three/webgpu'
import { depthOnlyMaterial, litHero, litSpecimen, tintedHolo } from '../../materials/tinted'
import { hasHero, heroIfReady, loadHero, onHeroReady } from '../../models/heroSpecimens'
import { STILL, STILL_YAW } from '../../../lib/flags'
import { specimenGeo } from '../../models/creatures'
import { SPECIMEN_LOOK } from '../../materials/detailMaps'
import { useTier } from './sceneHelpers'
import { specimenScale } from '../../models/specimenBox'
import { useFx } from '../../../state/session'
import { AQUATIC, idPhase } from './specimenLife'

export interface SpecimenProps {
  id: string
  /** Largest dimension in world units after scaling. */
  fit?: number
  spin?: boolean
  reduced?: boolean
  mode?: 'lit' | 'holo'
  /** Resting yaw when not spinning. */
  yaw?: number
  /** Pops in from zero scale when mounted. */
  pop?: boolean
  /** Sways by this many radians around `yaw` instead of spinning. */
  sway?: number
  /** Lab C: hop or shake when the answer flash for this id fires. */
  react?: boolean
}

/** One low poly specimen, grounded at y = 0. Lit and flat shaded, or as a cyan hologram. */
export default function Specimen({ id, fit = 3, spin = false, reduced = false, mode = 'lit', yaw = -0.45, pop = false, sway = 0, react = false }: SpecimenProps) {
  const tier = useTier()
  const low = tier === 'low'
  const g = useMemo(() => specimenGeo(id, low ? 0.55 : 1), [id, low])
  const k = specimenScale(id, fit)
  // Medium tier and up swap in the textured hero scan once it has loaded; Low tier keeps the procedural model.
  const heroOk = hasHero(id) && !low
  const hero = useSyncExternalStore(onHeroReady, () => (heroOk ? heroIfReady(id) : undefined))
  useEffect(() => {
    if (heroOk) void loadHero(id)
  }, [id, heroOk])
  const geo = hero ? hero.geo : g.geo
  // Low tier: fewer segments and no detail map, so it stays lighter than High.
  const mat = useMemo(
    () => (mode === 'lit' ? (hero ? litHero(hero.map, hero.rough, hero.metalness) : litSpecimen({ look: SPECIMEN_LOOK[id], detail: !low })) : tintedHolo('#3ee6ff', 0.9, false)),
    [mode, id, low, hero],
  )
  const depthMat = useMemo(() => (mode === 'holo' ? depthOnlyMaterial() : null), [mode])
  useEffect(() => () => mat.dispose(), [mat])
  useEffect(() => () => depthMat?.dispose(), [depthMat])
  // L3: x-ray pass. A second shell on the shared hologram fresnel shader, faded in and out over 600 ms on the backbone answer.
  const xrayOn = react && !reduced && !STILL && !low && mode === 'lit'
  const xmat = useMemo(() => (xrayOn ? tintedHolo('#3ee6ff', 0, false) : null), [xrayOn])
  useEffect(() => () => xmat?.dispose(), [xmat])
  const xmesh = useRef<THREE.Mesh>(null)
  const xt0 = useRef<number | null>(null)
  const group = useRef<THREE.Group>(null)
  const born = useRef<number | null>(null)

  const phase = useMemo(() => idPhase(id), [id])
  const aquatic = AQUATIC.has(id)
  const life = !reduced && !STILL && !low
  const seen = useRef<number | null>(null)
  const rx = useRef<{ ok: boolean; t0: number } | null>(null)
  const extraYaw = useRef(0)

  useFrame((state, dt) => {
    const gr = group.current
    if (!gr) return
    const t = state.clock.elapsedTime
    if (born.current === null) born.current = t
    gr.rotation.y -= extraYaw.current
    if (STILL) gr.rotation.y = STILL_YAW
    else if (sway > 0) gr.rotation.y = yaw + (reduced ? 0 : Math.sin(t * 0.55) * sway)
    else if (spin && !reduced) gr.rotation.y += dt * 0.55
    else if (!spin) {
      if (reduced || born.current === t) gr.rotation.y = yaw
      else {
        const diff = Math.atan2(Math.sin(yaw - gr.rotation.y), Math.cos(yaw - gr.rotation.y))
        gr.rotation.y += diff * (1 - Math.exp(-dt * 8))
      }
    }
    let s = k
    if (pop && !reduced) {
      const a = Math.min(1, (t - born.current) / 0.55)
      const e = 1 - Math.pow(1 - a, 3)
      s = k * (0.2 + 0.8 * e) * (a < 1 ? 1 + Math.sin(a * Math.PI) * 0.08 : 1)
    }
    let sx = 1
    let sy = 1
    let py = 0
    let pitch = 0
    let roll = 0
    let yawX = 0
    if (life) {
      if (aquatic) {
        py = 0.012 * fit * (1 + Math.sin(t * 0.9 + phase))
        pitch = 0.035 * Math.sin(t * 0.9 + 0.8 + phase)
        roll = 0.02 * Math.sin(t * 0.7 + phase)
      } else {
        const b = Math.sin(t * 1.6 + phase)
        sy = 1 + 0.012 * b
        sx = 1 - 0.005 * b
      }
      if (react) {
        const f = useFx.getState().flash
        if (seen.current === null) seen.current = f?.n ?? 0
        else if (f && f.n !== seen.current) {
          seen.current = f.n
          if (f.id === id || f.id === `xray:${id}`) rx.current = { ok: f.ok, t0: t }
          if (f.id === `xray:${id}`) xt0.current = t
        }
        const r = rx.current
        if (r) {
          const a = Math.min(1, (t - r.t0) / (r.ok ? 0.45 : 0.5))
          if (r.ok) {
            const e = 1 - (1 - a) * (1 - a)
            const w = Math.sin(Math.PI * e)
            py += w * 0.07 * fit
            const p = 1 + 0.035 * w
            sx *= p
            sy *= p
          } else yawX = Math.sin(a * Math.PI * 6) * 0.13 * (1 - a)
          if (a >= 1) rx.current = null
        }
      }
    }
    if (xmat && xmesh.current) {
      const a = xt0.current === null ? 1 : Math.min(1, (t - xt0.current) / 0.6)
      xmat.opacity = xt0.current === null ? 0 : 1.1 * Math.sin(Math.PI * a)
      xmesh.current.visible = xmat.opacity > 0.01
      if (a >= 1) xt0.current = null
    }
    gr.rotation.order = 'YXZ'
    gr.rotation.x = pitch
    gr.rotation.z = roll
    gr.rotation.y += yawX
    extraYaw.current = yawX
    gr.position.y = py
    gr.scale.set(s * sx, s * sy, s * sx)
  })

  return (
    <group ref={group} rotation={[0, STILL ? STILL_YAW : yaw, 0]} scale={k}>
      {depthMat ? (
        <mesh geometry={geo}>
          <primitive object={depthMat} attach="material" />
        </mesh>
      ) : null}
      <mesh geometry={geo}>
        <primitive object={mat} attach="material" />
      </mesh>
      {xmat ? (
        <mesh ref={xmesh} geometry={geo} scale={1.015} visible={false} renderOrder={2}>
          <primitive object={xmat} attach="material" />
        </mesh>
      ) : null}
    </group>
  )
}
