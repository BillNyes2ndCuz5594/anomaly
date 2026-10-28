import type { V3 } from './builder'
import { chain, cone, ellipsoid, makeField, meshField, primBounds, type Field, type Prim } from './sculpt'
import type * as THREE from 'three/webgpu'

// Whole body shell for the hologram, sculpted as one continuous surface (see sculpt.ts): sloped shoulders and a real
// neck line, a ribcage that narrows to a waist, hips, arms with deltoid, elbow and forearm, hands with a finger mass
// and a thumb, legs with knee, calf and ankle, proper feet, and a head with brow, nose, cheek, jaw and chin.
// Feet at y = 0, about 6.8 units tall, facing +z. Organs are authored separately and sit inside this shell.

const sides = [-1, 1]
const mx = (k: number, p: V3): V3 => [p[0] * k, p[1], p[2]]

/** Spine of one arm, shoulder to wrist, relaxed and angled slightly out and forward with a soft elbow. */
export const ARM: V3[] = [[0.6, 5.06, 0], [0.92, 4.92, 0], [1.05, 4.5, 0.0], [1.12, 4.0, -0.01], [1.22, 3.5, 0.12], [1.3, 3.05, 0.26]]
export const ARM_R = [0.3, 0.3, 0.25, 0.2, 0.16, 0.1]
export const LEG: V3[] = [[0.38, 3.12, 0], [0.4, 2.45, 0.02], [0.4, 1.75, 0.05], [0.38, 1.05, 0.0], [0.36, 0.45, -0.01], [0.36, 0.2, 0]]
export const LEG_R = [0.36, 0.3, 0.24, 0.22, 0.14, 0.115]

export function humanSkinPrims(): Prim[] {
  const P: Prim[] = []
  const add = (...p: Prim[]) => void P.push(...p)
  // ----- trunk: pelvis, waist, ribcage, shoulder girdle
  add(ellipsoid([0, 3.2, -0.02], [0.74, 0.44, 0.46], 0.3))
  add(ellipsoid([0, 3.85, -0.02], [0.66, 0.5, 0.46], 0.3))
  add(ellipsoid([0, 3.7, 0.14], [0.6, 0.42, 0.4], 0.2))
  add(ellipsoid([0, 4.7, -0.01], [0.74, 0.72, 0.5], 0.3))
  add(ellipsoid([0, 5.08, 0], [0.74, 0.28, 0.38], 0.2))
  // glutes and a gentle curve of the lower back so the side view has a real profile
  for (const k of sides) add(ellipsoid([k * 0.3, 3.0, -0.3], [0.3, 0.32, 0.24], 0.2))
  // chest: a soft pectoral swell on each side
  for (const k of sides) add(ellipsoid([k * 0.32, 4.84, 0.26], [0.32, 0.26, 0.2], 0.2))
  // ----- neck and the slope of the trapezius into the shoulders
  add(cone([0, 5.4, -0.03], [0, 5.98, 0.06], 0.23, 0.2, 0.18))
  for (const k of sides) add(cone([k * 0.16, 5.5, -0.02], [k * 0.76, 5.2, 0], 0.14, 0.24, 0.18))
  // ----- head: rounded cranium, mid face, cheekbones, jaw, chin, brow, nose, ears
  add(ellipsoid([0, 6.3, -0.03], [0.4, 0.47, 0.46], 0.14))
  add(ellipsoid([0, 6.1, 0.2], [0.36, 0.4, 0.32], 0.16))
  add(ellipsoid([0, 5.95, 0.2], [0.28, 0.2, 0.26], 0.14))
  add(ellipsoid([0, 5.87, 0.38], [0.13, 0.1, 0.11], 0.08))
  add(ellipsoid([0, 6.31, 0.41], [0.3, 0.06, 0.09], 0.07))
  // nose: a straight bridge to a rounded tip that projects about a fifth of the face width
  add(cone([0, 6.26, 0.43], [0, 6.03, 0.57], 0.045, 0.065, 0.06))
  add(ellipsoid([0, 5.985, 0.575], [0.075, 0.06, 0.065], 0.05))
  for (const k of sides) {
    add(ellipsoid([k * 0.23, 6.1, 0.36], [0.1, 0.07, 0.08], 0.08))
    add(ellipsoid([k * 0.4, 6.14, -0.02], [0.07, 0.13, 0.09], 0.05))
    add(ellipsoid([k * 0.075, 5.95, 0.56], [0.06, 0.05, 0.06], 0.04))
  }
  // ----- arms: deltoid, upper arm, elbow, forearm tapering to the wrist
  for (const k of sides) {
    add(ellipsoid([k * 0.92, 5.0, 0.0], [0.28, 0.32, 0.28], 0.2))
    add(...chain(ARM.map((p) => mx(k, p)), [0.22, 0.27, 0.22, 0.17, 0.15, 0.09], 0.14, 0.95, 6))
    // biceps and elbow point
    add(ellipsoid([k * 1.04, 4.6, 0.07], [0.17, 0.32, 0.17], 0.12))
    add(ellipsoid([k * 1.12, 4.0, -0.13], [0.11, 0.1, 0.1], 0.08))
    // forearm swell below the elbow
    add(ellipsoid([k * 1.18, 3.68, 0.05], [0.15, 0.28, 0.15], 0.12))
    // ----- hand: a mitten of palm and fingers hanging with the thumb forward, fingers curled a little
    add(ellipsoid([k * 1.33, 2.86, 0.3], [0.1, 0.21, 0.15], 0.1))
    for (let i = 0; i < 4; i++) {
      const len = [0.46, 0.54, 0.5, 0.4][i]
      const z = 0.2 + i * 0.09
      add(...chain([[k * 1.33, 2.76, z], [k * 1.35, 2.76 - len * 0.55, z + 0.02], [k * 1.35, 2.76 - len, z + 0.07]], [0.05, 0.046, 0.036], 0.06, 1, 3))
    }
    add(...chain([[k * 1.29, 3.0, 0.42], [k * 1.31, 2.84, 0.54], [k * 1.33, 2.66, 0.62]], [0.075, 0.06, 0.044], 0.06, 1, 3))
  }
  // ----- legs: thigh, knee, calf, ankle
  for (const k of sides) {
    add(ellipsoid([k * 0.46, 3.2, 0], [0.28, 0.36, 0.3], 0.2))
    add(...chain(LEG.map((p) => mx(k, p)), [0.36, 0.3, 0.21, 0.19, 0.12, 0.095], 0.14, 1.0, 6))
    // kneecap, calf and the narrow ankle
    add(ellipsoid([k * 0.4, 1.8, 0.17], [0.13, 0.15, 0.09], 0.08))
    add(ellipsoid([k * 0.38, 1.32, -0.1], [0.15, 0.3, 0.14], 0.12))
    add(ellipsoid([k * 0.42, 2.25, 0.05], [0.2, 0.45, 0.2], 0.15))
    // foot: heel, arch, ball and toes, slightly turned out
    add(ellipsoid([k * 0.37, 0.15, -0.1], [0.12, 0.15, 0.16], 0.07))
    add(ellipsoid([k * 0.38, 0.11, 0.18], [0.13, 0.11, 0.3], 0.08))
    add(ellipsoid([k * 0.42, 0.075, 0.5], [0.15, 0.075, 0.17], 0.06))
    add(ellipsoid([k * 0.36, 0.075, 0.66], [0.075, 0.06, 0.09], 0.04))
  }
  return P
}

let fieldCache: Field | null = null
export const humanSkinField = (): Field => (fieldCache ??= makeField(humanSkinPrims()))

/** Meshes the shell. `cell` is the grid size in body units (0.045 still resolves the nose and thumb). */
export function buildHumanSkin(cell = 0.045): THREE.BufferGeometry {
  const f = humanSkinField()
  const { lo, hi } = primBounds(humanSkinPrims(), 0.2)
  return meshField(f, lo, hi, cell, (_p, _n, out) => out.set('#ffffff'))
}
