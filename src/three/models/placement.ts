import * as THREE from 'three/webgpu'
import type { V3 } from './builder'

/** Euler angles for an ellipsoid whose local z follows `n` and whose local x stays as horizontal as possible. */
export function frame(n: V3, roll = 0): V3 {
  const z = new THREE.Vector3(...n).normalize()
  const x = new THREE.Vector3(0, 1, 0).cross(z)
  if (x.lengthSq() < 1e-6) x.set(1, 0, 0)
  x.normalize()
  const y = z.clone().cross(x)
  const m = new THREE.Matrix4().makeBasis(x, y, z)
  if (roll) m.multiply(new THREE.Matrix4().makeRotationZ(roll))
  const e = new THREE.Euler().setFromRotationMatrix(m)
  return [e.x, e.y, e.z]
}

/** Point `d` along the unit vector `n` from `p`. */
export const off = (p: V3, n: V3, d: number): V3 => [p[0] + n[0] * d, p[1] + n[1] * d, p[2] + n[2] * d]

/** Cheap deterministic value noise in [-1, 1] from sines, for broken-up coat and plumage patterns. */
export const wob = (x: number, y: number, z: number): number => Math.sin(x * 12.9 + y * 7.3) * Math.sin(z * 11.7 + y * 5.1 + x * 3.3) * 0.6 + Math.sin(x * 27 + z * 19 + y * 13) * 0.4
