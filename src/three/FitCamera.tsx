import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, type RefObject } from 'react'
import * as THREE from 'three/webgpu'
import { STILL } from '../lib/flags'
import { useGame } from '../state/store'
import { dampFactor, PUSH_IN, useFitPose, usePublishFit, type FitView } from './fitCameraHelpers'

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
