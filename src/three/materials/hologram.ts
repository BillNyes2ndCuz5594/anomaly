import * as THREE from 'three/webgpu'
import type { UniformNode } from 'three/webgpu'
import {
  abs,
  dot,
  float,
  floor,
  fract,
  hash,
  mix,
  normalView,
  positionViewDirection,
  positionWorld,
  pow,
  saturate,
  sin,
  time,
  uniform,
  vec3,
} from 'three/tsl'

export interface HologramOptions {
  /** Base color. Default hologram cyan. */
  color?: THREE.ColorRepresentation
  /** Overall opacity multiplier, 0 to 1. */
  opacity?: number
  /** Brightness multiplier. Above 1 feeds the bloom. */
  intensity?: number
  /** Rim glow sharpness. Higher is a thinner rim. */
  fresnelPower?: number
  /** Scanline count per world unit. */
  scanDensity?: number
  /** Scanline scroll speed in world units per second. */
  scanSpeed?: number
  /** Sweep band that travels up the object. 0 disables. */
  sweep?: number
  doubleSided?: boolean
  /** Render in front of everything (no depth test), good for overlays. */
  alwaysOnTop?: boolean
}

export type HologramMaterial = THREE.MeshBasicNodeMaterial & {
  uniforms: {
    color: UniformNode<'color', THREE.Color>
    opacity: UniformNode<'float', number>
    intensity: UniformNode<'float', number>
    scanSpeed: UniformNode<'float', number>
  }
}

export const HOLO_CYAN = '#3ee6ff'

/**
 * Signature look: fresnel rim glow, scrolling horizontal scanlines, a slow sweep band,
 * a touch of flicker, additive blending. Works on any procedural geometry.
 */
export function createHologramMaterial(opts: HologramOptions = {}): HologramMaterial {
  const {
    color = HOLO_CYAN,
    opacity = 0.85,
    intensity = 1,
    fresnelPower = 2.2,
    scanDensity = 22,
    scanSpeed = 0.35,
    sweep = 1,
    doubleSided = true,
    alwaysOnTop = false,
  } = opts

  const uColor = uniform(new THREE.Color(color))
  const uOpacity = uniform(opacity)
  const uIntensity = uniform(intensity)
  const uScanSpeed = uniform(scanSpeed)
  const uSweep = uniform(sweep)

  // Rim: bright where the surface turns away from the camera.
  const facing = abs(dot(normalView, positionViewDirection))
  const fresnel = pow(saturate(float(1).sub(facing)), float(fresnelPower))

  // Scanlines: thin bright lines that scroll, plus a fine static raster underneath.
  const phase = positionWorld.y.mul(scanDensity).sub(time.mul(uScanSpeed).mul(scanDensity))
  const lines = pow(sin(phase.mul(Math.PI * 2)).mul(0.5).add(0.5), float(7))
  const raster = sin(positionWorld.y.mul(scanDensity * 5).mul(Math.PI * 2)).mul(0.5).add(0.5).mul(0.22).add(0.78)

  // Sweep: a soft band with a hard leading edge, rising through the object.
  const band = fract(positionWorld.y.mul(0.22).sub(time.mul(0.14)))
  const sweepBand = pow(band, float(18)).mul(uSweep)

  // Flicker: tiny whole-object jitter that changes about 14 times a second.
  const flicker = float(0.94).add(hash(floor(time.mul(14))).mul(0.06))

  const energy = float(0.16)
    .add(fresnel.mul(1.5))
    .add(lines.mul(0.3))
    .add(sweepBand.mul(0.85))
    .mul(raster)
    .mul(flicker)

  const hot = mix(uColor, vec3(1, 1, 1), saturate(fresnel.mul(0.55).add(sweepBand.mul(0.6))))

  const material = new THREE.MeshBasicNodeMaterial() as HologramMaterial
  material.colorNode = hot.mul(energy).mul(uIntensity)
  material.opacityNode = saturate(
    float(0.22).add(fresnel.mul(0.9)).add(lines.mul(0.3)).add(sweepBand.mul(0.5)).mul(uOpacity),
  )
  material.transparent = true
  material.blending = THREE.AdditiveBlending
  material.depthWrite = false
  material.depthTest = !alwaysOnTop
  material.side = doubleSided ? THREE.DoubleSide : THREE.FrontSide
  material.toneMapped = true
  material.uniforms = {
    color: uColor,
    opacity: uOpacity,
    intensity: uIntensity,
    scanSpeed: uScanSpeed,
  }
  return material
}
