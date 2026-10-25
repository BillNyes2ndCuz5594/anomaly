import * as THREE from 'three/webgpu'
import {
  abs,
  dot,
  float,
  materialColor,
  materialOpacity,
  mix,
  normalView,
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

/** Stylized lit material for low poly specimens: flat shaded vertex colors with a cool rim light. */
export function litSpecimen(): THREE.MeshStandardNodeMaterial {
  const m = new THREE.MeshStandardNodeMaterial({ vertexColors: true, flatShading: true, roughness: 0.62, metalness: 0.04 })
  const rim = pow(saturate(float(1).sub(abs(dot(normalView, positionViewDirection)))), float(3))
  m.emissiveNode = vec3(0.24, 0.9, 1).mul(rim).mul(0.55)
  return m
}

/** Depth-only twin of a hologram shell. Lets the shell draw just its outermost surface, so overlapping solids do not show through each other. */
export function depthOnlyMaterial(): THREE.MeshBasicNodeMaterial {
  const m = new THREE.MeshBasicNodeMaterial()
  m.colorWrite = false
  m.depthWrite = true
  return m
}
