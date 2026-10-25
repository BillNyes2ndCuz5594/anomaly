import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef, type RefObject } from 'react'
import * as THREE from 'three/webgpu'
import { fitBox, projectBox, type Box, type V3 } from './fit'
import { useInsets } from './insets'

export interface FitView {
  box: Box
  elevation?: number
  azimuth?: number
  margin?: number
}

/** The free part of the canvas as fractions, given the HUD insets (ignored on narrow screens, where panels stack). */
export function useFrameFractions() {
  const size = useThree((s) => s.size)
  const ins = useInsets()
  return useMemo(() => {
    if (size.width <= 900) return { w: 1, h: 1 }
    return { w: Math.max(0.3, (size.width - ins.right) / size.width), h: Math.max(0.3, (size.height - ins.top - ins.bottom) / size.height) }
  }, [size.width, size.height, ins.right, ins.top, ins.bottom])
}

/** Camera pose that fits `view.box` inside the free frame at the current canvas size. Refits on resize. */
export function useFitPose(view: FitView) {
  const size = useThree((s) => s.size)
  const fov = useThree((s) => (s.camera as THREE.PerspectiveCamera).fov)
  const frame = useFrameFractions()
  const { box, elevation = 0.14, azimuth = 0, margin = 0.08 } = view
  return useMemo(
    () => fitBox(box, { fovDeg: fov, aspect: size.width / Math.max(1, size.height), margin, elevation, azimuth, frame }),
    [box, fov, size.width, size.height, margin, elevation, azimuth, frame],
  )
}

const tmpBox = new THREE.Box3()
const partBox = new THREE.Box3()

/** World box of the visible meshes under `root`. Effects (feedback beams, rings) opt out with userData.noFit. */
function measureVisible(root: THREE.Object3D, out: THREE.Box3): void {
  if (!root.visible || root.userData.noFit) return
  const mesh = root as THREE.Mesh
  if (mesh.isMesh && mesh.geometry) {
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox()
    if (mesh.geometry.boundingBox) out.union(partBox.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld))
  }
  for (const c of root.children) measureVisible(c, out)
}

/**
 * Publishes where the real objects land on screen, as normalized device coordinates, on the canvas element
 * (data-fit). The proof run reads it and asserts the whole model is inside the canvas. Cheap: every 20 frames.
 */
export function usePublishFit(pose: { position: V3; target: V3 }, measure: RefObject<THREE.Object3D | null> | undefined, fallback: Box) {
  const gl = useThree((s) => s.gl)
  const size = useThree((s) => s.size)
  const frame = useFrameFractions()
  const n = useRef(0)
  useFrame((state) => {
    if (n.current++ % 20 !== 0) return
    let box = fallback
    const obj = measure?.current
    if (obj) {
      obj.updateWorldMatrix(true, true)
      measureVisible(obj, tmpBox.makeEmpty())
      if (!tmpBox.isEmpty()) box = { min: [tmpBox.min.x, tmpBox.min.y, tmpBox.min.z], max: [tmpBox.max.x, tmpBox.max.y, tmpBox.max.z] }
    }
    const cam = state.camera as THREE.PerspectiveCamera
    const e = projectBox(box, [cam.position.x, cam.position.y, cam.position.z], pose.target, cam.fov, size.width / Math.max(1, size.height))
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
