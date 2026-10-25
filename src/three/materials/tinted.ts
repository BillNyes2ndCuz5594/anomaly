import * as THREE from 'three/webgpu'
import {
  abs,
  dot,
  float,
  fract,
  materialColor,
  materialEmissive,
  materialOpacity,
  mix,
  normalView,
  normalWorld,
  positionViewDirection,
  positionWorld,
  pow,
  saturate,
  sin,
  time,
  vec3,
} from 'three/tsl'

/**
 * Hologram variant that reads its tint and opacity from material.color and material.opacity.
 * All instances share one node graph, so one shader program serves every organ and part;
 * highlight is done by changing color brightness and opacity per frame, no recompiles.
 */
function makeGraph() {
  const facing = abs(dot(normalView, positionViewDirection))
  const fresnel = pow(saturate(float(1).sub(facing)), float(2.2))
  const phase = positionWorld.y.mul(16).sub(time.mul(0.6))
  const lines = pow(sin(phase.mul(Math.PI * 2)).mul(0.5).add(0.5), float(6))
  const energy = float(0.34).add(fresnel.mul(1.35)).add(lines.mul(0.3))
  const hot = mix(materialColor, vec3(1, 1, 1), saturate(fresnel.mul(0.5)))
  return {
    colorNode: hot.mul(energy),
    opacityNode: saturate(float(0.3).add(fresnel.mul(0.8)).add(lines.mul(0.28)).mul(materialOpacity)),
  }
}

let shared: ReturnType<typeof makeGraph> | undefined
const graph = () => (shared ??= makeGraph())

export type TintedHolo = THREE.MeshBasicNodeMaterial

export function tintedHolo(tint: THREE.ColorRepresentation, opacity = 0.8, doubleSided = true, depthTest = true): TintedHolo {
  const g = graph()
  const m = new THREE.MeshBasicNodeMaterial()
  m.color.set(tint)
  m.opacity = opacity
  m.colorNode = g.colorNode
  m.opacityNode = g.opacityNode
  m.transparent = true
  m.blending = THREE.AdditiveBlending
  m.depthWrite = false
  m.depthTest = depthTest
  m.side = doubleSided ? THREE.DoubleSide : THREE.FrontSide
  return m
}

/**
 * Stylized lit material for specimens: smooth shaded vertex colors, physically based, with a cool rim light and a
 * faint sky bounce on upward facing surfaces so shapes read at panel size.
 */
export function litSpecimen(): THREE.MeshStandardNodeMaterial {
  const m = new THREE.MeshStandardNodeMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.02 })
  const facing = abs(dot(normalView, positionViewDirection))
  const rim = pow(saturate(float(1).sub(facing)), float(3))
  const sky = saturate(normalWorld.y.mul(0.5).add(0.5))
  m.emissiveNode = vec3(0.24, 0.9, 1).mul(rim).mul(0.42).add(vec3(0.02, 0.04, 0.07).mul(sky))
  return m
}

/**
 * Hologram body shell: nearly clear glass with a strong fresnel rim, fine scanlines that crawl up the body and a
 * soft bright band that sweeps over it. Reads tint and opacity from the material, so one shader serves every state.
 */
function makeShellGraph() {
  const facing = abs(dot(normalView, positionViewDirection))
  const fresnel = pow(saturate(float(1).sub(facing)), float(2.2))
  const y = positionWorld.y
  const fine = pow(sin(y.mul(46).sub(time.mul(1.4)).mul(Math.PI)).mul(0.5).add(0.5), float(10))
  const bands = pow(sin(y.mul(3.2).add(time.mul(0.35)).mul(Math.PI)).mul(0.5).add(0.5), float(14))
  const sweepPos = fract(time.mul(0.11)).mul(7.6).sub(0.5)
  const sweep = pow(saturate(float(1).sub(abs(y.sub(sweepPos)).mul(2.2))), float(2))
  const energy = float(0.2).add(fresnel.mul(1.3)).add(fine.mul(0.2)).add(bands.mul(0.12)).add(sweep.mul(0.7))
  const hot = mix(materialColor, vec3(1, 1, 1), saturate(fresnel.mul(0.45).add(sweep.mul(0.3))))
  return {
    colorNode: hot.mul(energy),
    opacityNode: saturate(float(0.17).add(fresnel.mul(0.85)).add(fine.mul(0.22)).add(sweep.mul(0.35)).mul(materialOpacity)),
  }
}

let shellShared: ReturnType<typeof makeShellGraph> | undefined

export function humanShell(tint: THREE.ColorRepresentation, opacity = 0.9): TintedHolo {
  const g = (shellShared ??= makeShellGraph())
  const m = new THREE.MeshBasicNodeMaterial()
  m.color.set(tint)
  m.opacity = opacity
  m.colorNode = g.colorNode
  m.opacityNode = g.opacityNode
  m.transparent = true
  m.blending = THREE.AdditiveBlending
  m.depthWrite = false
  m.depthTest = true
  m.side = THREE.FrontSide
  return m
}

/**
 * Organ material: solid, softly lit and glowing from within. Brightness is driven per frame through
 * material.emissive (rim and glow share one shader program across all organs).
 */
export function organMaterial(tint: THREE.ColorRepresentation): THREE.MeshStandardNodeMaterial {
  const m = new THREE.MeshStandardNodeMaterial({ roughness: 0.4, metalness: 0.0, vertexColors: true })
  m.color.set(tint)
  m.emissive.set(tint).multiplyScalar(0.4)
  const facing = abs(dot(normalView, positionViewDirection))
  const rim = pow(saturate(float(1).sub(facing)), float(2.4))
  // Fixed key light in view space so every organ keeps the same soft studio shading, plus a small glint.
  const key = vec3(0.35, 0.6, 0.72).normalize()
  const lit = saturate(dot(normalView, key))
  const half = vec3(0.35, 0.6, 1.72).normalize()
  const glint = pow(saturate(dot(normalView, half)), float(48)).mul(0.5)
  m.emissiveNode = materialEmissive.mul(mix(float(0.5), float(1.2), lit)).add(vec3(0.55, 0.95, 1).mul(rim).mul(0.4)).add(vec3(1, 1, 1).mul(glint))
  return m
}

/** Depth-only twin of a hologram shell. Lets the shell draw just its outermost surface, so overlapping solids do not show through each other. */
export function depthOnlyMaterial(): THREE.MeshBasicNodeMaterial {
  const m = new THREE.MeshBasicNodeMaterial()
  m.colorWrite = false
  m.depthWrite = true
  return m
}
