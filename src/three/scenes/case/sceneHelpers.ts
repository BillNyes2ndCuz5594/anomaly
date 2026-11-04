import { useThree } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { useLayoutEffect, useRef } from 'react'
import * as THREE from 'three/webgpu'
import { resolveTier } from '../../../state/quality'
import { useRuntime } from '../../../state/runtime'
import { useGame } from '../../../state/store'
import { widthFit } from '../../fit'

const BASE_FOV = 40

/**
 * Keeps `halfWidth` world units either side of the view axis (at `distance`) visible on tall narrow canvases:
 * widens the field of view up to `maxFovDeg`, then reports how much further back the camera has to go.
 * Restores the default fov on unmount, since the canvas and camera outlive scenes.
 */
export function useWidthFit(halfWidth: number, distance: number, maxFovDeg = 70, margin = 0.08): { current: number } {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const width = useThree((s) => s.size.width)
  const height = useThree((s) => s.size.height)
  const scale = useRef(1)
  useLayoutEffect(() => {
    const r = widthFit(halfWidth, distance, width / Math.max(1, height), BASE_FOV, maxFovDeg, margin)
    scale.current = r.distanceScale
    camera.fov = r.fovDeg
    camera.updateProjectionMatrix()
    return () => {
      camera.fov = BASE_FOV
      camera.updateProjectionMatrix()
    }
  }, [camera, width, height, halfWidth, distance, maxFovDeg, margin])
  return scale
}

export function useTier() {
  const quality = useGame((s) => s.settings.quality)
  const autoTier = useRuntime((s) => s.autoTier)
  return resolveTier(quality, autoTier)
}

export function useReduced() {
  return useGame((s) => s.settings.reducedMotion)
}

export interface Pickable {
  part: string
  prio: number
}

/**
 * Picks the intended part from every object under the pointer. Higher priority wins (organs beat the
 * translucent skin that covers them), then the nearest. Returns null when nothing pickable was hit.
 */
export function choosePart(e: ThreeEvent<PointerEvent> | ThreeEvent<MouseEvent>): string | null {
  let best: { part: string; prio: number; d: number } | null = null
  for (const hit of e.intersections) {
    const u = hit.object.userData as Partial<Pickable>
    if (!u.part) continue
    const prio = u.prio ?? 0
    if (!best || prio > best.prio || (prio === best.prio && hit.distance < best.d)) {
      best = { part: u.part, prio, d: hit.distance }
    }
  }
  return best?.part ?? null
}

/** Pointer handlers shared by the interactive models. Hover goes to the fx store, click to the active lab. */
export function pointerHandlers(
  setHover: (id: string | null) => void,
  pick: () => ((id: string) => void) | null,
  allowed?: (id: string) => boolean,
) {
  const ok = (id: string | null): id is string => !!id && (!allowed || allowed(id))
  return {
    onPointerMove: (e: ThreeEvent<PointerEvent>) => {
      const id = choosePart(e)
      e.stopPropagation()
      setHover(ok(id) ? id : null)
      document.body.style.cursor = ok(id) ? 'pointer' : ''
    },
    onPointerOut: () => {
      setHover(null)
      document.body.style.cursor = ''
    },
    onClick: (e: ThreeEvent<MouseEvent>) => {
      const id = choosePart(e)
      e.stopPropagation()
      if (ok(id)) pick()?.(id)
    },
  }
}
