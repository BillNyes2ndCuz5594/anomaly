import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type RefObject } from 'react'
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
export function usePublishFit(pose: { position: V3; target: V3 }, measure: RefObject<THREE.Object3D | null> | undefined, fallback: Box) {
  const gl = useThree((s) => s.gl)
  const size = useThree((s) => s.size)
  const frame = useFrameFractions()
  const n = useRef(0)
  // The Stage canvas outlives its scenes: drop the published fit when the model goes away, so a screen without a model never reports a stale one.
  useEffect(() => {
    const el = gl.domElement as HTMLCanvasElement
    return () => {
      delete el.dataset.fit
    }
  }, [gl])
  useFrame((state) => {
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

/** Item visual camera: fits the whole box in the whole canvas, every frame so a resize is picked up at once. */
export function FitCamera({ view, measure }: { view: FitView; measure?: RefObject<THREE.Object3D | null> }) {
  const pose = useFitPose(view)
  useFrame((state) => {
    const cam = state.camera
    cam.position.set(...pose.position)
    cam.lookAt(...pose.target)
  })
  usePublishFit(pose, measure, view.box)
  return null
}
