import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef, type RefObject } from 'react'
import { STILL } from '../lib/flags'
import { useGame } from '../state/store'
import * as THREE from 'three/webgpu'
import { boxCorners, fitBox, fitPoints, outlinePoints, projectPoints, type Box, type V3 } from './fit'
import { useInsets } from './insets'

export interface FitView {
  box: Box
  /** Optional silhouette proxy (see fit.ts outlinePoints). When present the camera fits these instead of the box corners. */
  points?: V3[]
  elevation?: number
  azimuth?: number
  margin?: number
}

/** The free part of the canvas as fractions, given the HUD insets (side panel, bottom sheet, dock, top bar). */
export function useFrameFractions() {
  const size = useThree((s) => s.size)
  const ins = useInsets()
  return useMemo(() => {
    return { w: Math.max(0.3, (size.width - ins.right) / size.width), h: Math.max(0.15, (size.height - ins.top - ins.bottom) / size.height) }
  }, [size.width, size.height, ins.right, ins.top, ins.bottom])
}

/** Camera pose that fits `view.box` inside the free frame at the current canvas size. Refits on resize. */
export function useFitPose(view: FitView) {
  const size = useThree((s) => s.size)
  const fov = useThree((s) => (s.camera as THREE.PerspectiveCamera).fov)
  const frame = useFrameFractions()
  const { box, points, elevation = 0.14, azimuth = 0, margin = 0.08 } = view
  return useMemo(() => {
    const o = { fovDeg: fov, aspect: size.width / Math.max(1, size.height), margin, elevation, azimuth, frame }
    return points ? fitPoints(points, o) : fitBox(box, o)
  }, [box, points, fov, size.width, size.height, margin, elevation, azimuth, frame])
}

const outlines = new WeakMap<THREE.BufferGeometry, V3[]>()
const tmpV = new THREE.Vector3()

/** Silhouette proxy of a geometry in its own space, cached. */
function outlineOf(geo: THREE.BufferGeometry): V3[] {
  let o = outlines.get(geo)
  if (!o) {
    const pos = geo.getAttribute('position')
    o = pos && pos.count > 0 ? outlinePoints(pos.array as ArrayLike<number>, pos.count > 200 ? 96 : 20) : []
    outlines.set(geo, o)
  }
  return o
}

/** World space outline points of the visible meshes under `root`. Effects (feedback beams, rings) opt out with userData.noFit. */
function measureVisible(root: THREE.Object3D, out: V3[]): void {
  if (!root.visible || root.userData.noFit) return
  const mesh = root as THREE.Mesh
  if (mesh.isMesh && mesh.geometry) {
    for (const p of outlineOf(mesh.geometry)) {
      tmpV.set(p[0], p[1], p[2]).applyMatrix4(mesh.matrixWorld)
      out.push([tmpV.x, tmpV.y, tmpV.z])
    }
  }
  for (const c of root.children) measureVisible(c, out)
}

/**
 * Publishes where the real objects land on screen, as normalized device coordinates, on the canvas element
 * (data-fit). The proof run reads it and asserts the whole model is inside the canvas. Cheap: every 20 frames.
 * Measures the outline of the real meshes, not a box, so a turned wide model is judged by its true silhouette.
 */
export function usePublishFit(
  pose: { position: V3; target: V3 },
  measure: RefObject<THREE.Object3D | null> | undefined,
  fallback: Box,
  enabledRef?: { current: boolean },
) {
  const gl = useThree((s) => s.gl)
  const size = useThree((s) => s.size)
  const frame = useFrameFractions()
  const n = useRef(0)
  useFrame((state) => {
    if (enabledRef && !enabledRef.current) return
    if (n.current++ % 20 !== 0) return
    let pts = boxCorners(fallback)
    const obj = measure?.current
    if (obj) {
      obj.updateWorldMatrix(true, true)
      const got: V3[] = []
      measureVisible(obj, got)
      if (got.length) pts = got
    }
    const cam = state.camera as THREE.PerspectiveCamera
    const e = projectPoints(pts, [cam.position.x, cam.position.y, cam.position.z], pose.target, cam.fov, size.width / Math.max(1, size.height))
    const el = gl.domElement as HTMLCanvasElement
    el.dataset.fit = JSON.stringify({ minX: +e.minX.toFixed(4), maxX: +e.maxX.toFixed(4), minY: +e.minY.toFixed(4), maxY: +e.maxY.toFixed(4), behind: e.behind, fw: +frame.w.toFixed(3), fh: +frame.h.toFixed(3), w: size.width, h: size.height })
  })
}

/** Frame rate independent damping factor for a given rate (per second). */
export function dampFactor(rate: number, dt: number): number {
  return 1 - Math.exp(-rate * Math.min(0.5, Math.max(0, dt)))
}

/** How far behind its resting pose the camera starts when a scene mounts (fraction of the distance). */
export const PUSH_IN = 0.12
const DAMP_RATE = 9

/**
 * Item visual camera: fits the whole box in the whole canvas. The camera eases to the fitted pose
 * (a short push in when the scene mounts, a damped follow when the canvas resizes), about 600 ms in all.
 * The resting pose is always the exact fit, and while easing in from behind the model only ever
 * looks smaller, so the whole model stays inside the canvas. Reduced motion and still mode snap.
 */
export function FitCamera({
  view,
  measure,
  enabledRef,
}: {
  view: FitView
  measure?: RefObject<THREE.Object3D | null>
  /** When set, only the slot whose ref is true drives the camera. */
  enabledRef?: { current: boolean }
}) {
  const pose = useFitPose(view)
  const reduced = useGame((s) => s.settings.reducedMotion)
  const snap = reduced || STILL
  const cur = useRef<{ pos: THREE.Vector3; look: THREE.Vector3 } | null>(null)
  const goalPos = useMemo(() => new THREE.Vector3(), [])
  const goalLook = useMemo(() => new THREE.Vector3(), [])
  useFrame((state, dt) => {
    if (enabledRef && !enabledRef.current) return
    const cam = state.camera
    goalPos.set(...pose.position)
    goalLook.set(...pose.target)
    if (!cur.current) {
      const c = { pos: goalPos.clone(), look: goalLook.clone() }
      if (!snap) c.pos.sub(goalLook).multiplyScalar(1 + PUSH_IN).add(goalLook)
      cur.current = c
    } else if (snap) {
      cur.current.pos.copy(goalPos)
      cur.current.look.copy(goalLook)
    } else {
      const k = dampFactor(DAMP_RATE, dt)
      cur.current.pos.lerp(goalPos, k)
      cur.current.look.lerp(goalLook, k)
      // Close enough to be invisible: land exactly on the fit.
      if (cur.current.pos.distanceToSquared(goalPos) < 1e-6) cur.current.pos.copy(goalPos)
      if (cur.current.look.distanceToSquared(goalLook) < 1e-6) cur.current.look.copy(goalLook)
    }
    cam.position.copy(cur.current.pos)
    cam.lookAt(cur.current.look)
  })
  usePublishFit(pose, measure, view.box, enabledRef)
  return null
}
