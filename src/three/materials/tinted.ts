import * as THREE from 'three/webgpu'
import {
  abs,
  attribute,
  dot,
  float,
  fract,
  materialColor,
  materialEmissive,
  materialOpacity,
  mix,
  normalize,
  normalLocal,
  normalView,
  normalWorld,
  positionLocal,
  positionViewDirection,
  positionWorld,
  pow,
  saturate,
  sin,
  texture,
  time,
  transformNormalToView,
  vec3,
  vertexColor,
} from 'three/tsl'
import { DEFAULT_LOOK, detailMap, type DetailKind, type DetailLook } from './detailMaps'

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

const detailTextures = new Map<DetailKind, { tex: THREE.DataTexture; gradMax: number }>()

/** The shared tileable detail map for a kind of skin, generated on first use (128 px, a few ms). */
export function detailTexture(kind: DetailKind): { tex: THREE.DataTexture; gradMax: number } {
  let t = detailTextures.get(kind)
  if (!t) {
    const m = detailMap(kind, 128)
    const tex = new THREE.DataTexture(m.pixels, 128, 128, THREE.RGBAFormat)
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.magFilter = THREE.LinearFilter
    tex.minFilter = THREE.LinearMipmapLinearFilter
    tex.generateMipmaps = true
    tex.anisotropy = 4
    tex.needsUpdate = true
    t = { tex, gradMax: m.gradMax }
    detailTextures.set(kind, t)
  }
  return t
}

export interface SpecimenMaterialOpts {
  look?: DetailLook
  /** Triplanar detail map: bump, roughness variation and cavity darkening. Off on the Low tier. */
  detail?: boolean
}

/**
 * Stylized lit material for specimens: smooth shaded vertex colors, physically based, with a cool rim light and a
 * faint sky bounce on upward facing surfaces so shapes read at panel size. Per vertex `surf` (gloss, thin) marks
 * wet eyes and thin membranes. With `detail`, a small procedural map adds scales, wrinkles or coat as bump,
 * roughness variation and crevice darkening, all in the shader (works on WebGPU and WebGL2).
 */
export function litSpecimen(opts: SpecimenMaterialOpts = {}): THREE.MeshStandardNodeMaterial {
  const look = opts.look ?? DEFAULT_LOOK
  const m = new THREE.MeshStandardNodeMaterial({ vertexColors: true, roughness: look.rough, metalness: 0.02 })
  const facing = abs(dot(normalView, positionViewDirection))
  const rim = pow(saturate(float(1).sub(facing)), float(3))
  const sky = saturate(normalWorld.y.mul(0.5).add(0.5))
  const surf = attribute('surf', 'vec2')
  const gloss = surf.x
  const thin = surf.y
  let rough: THREE.Node<'float'> = float(look.rough)
  let albedo: THREE.Node<'vec3'> = vec3(1, 1, 1)
  if (opts.detail) {
    const { tex, gradMax } = detailTexture(look.kind)
    const p = positionLocal.mul(look.freq)
    const nw = pow(abs(normalLocal), vec3(4, 4, 4))
    const w = nw.div(nw.x.add(nw.y).add(nw.z))
    // Triplanar: the same pattern is read along x, y and z and blended by how much each face looks that way.
    const s1 = texture(tex, p.zy)
    const s2 = texture(tex, p.xz)
    const s3 = texture(tex, p.xy)
    const dec = (v: THREE.Node<'float'>) => v.sub(0.5).mul(2 * gradMax)
    // Height gradient of each projection, placed on its own two axes, then blended.
    const grad = vec3(0, dec(s1.g), dec(s1.r)).mul(w.x).add(vec3(dec(s2.r), 0, dec(s2.g)).mul(w.y)).add(vec3(dec(s3.r), dec(s3.g), 0).mul(w.z))
    const slope = grad.mul(look.bump * look.freq)
    const nl = normalLocal
    m.normalNode = normalize(transformNormalToView(normalize(nl.sub(slope.sub(nl.mul(dot(slope, nl)))))))
    const mixed = s1.mul(w.x).add(s2.mul(w.y)).add(s3.mul(w.z))
    rough = float(look.rough).add(mixed.b.sub(0.5).mul(look.roughVar * 2))
    albedo = vec3(mix(float(1), mixed.a, look.cavity))
  }
  m.roughnessNode = mix(rough, float(0.1), gloss)
  // Cheap ambient occlusion: surfaces that face down sit a little darker, which gives the bodies weight.
  const ao = mix(float(0.74), float(1), saturate(normalWorld.y.mul(1.1).add(0.55)))
  m.colorNode = albedo.mul(ao)
  // A soft key fixed in view space gives the thin parts (fins, ears, flippers) a warm backlit glow.
  const key = vec3(0.35, 0.6, 0.72).normalize()
  const wrap = saturate(dot(normalView, key).mul(0.5).add(0.5))
  const edge = pow(saturate(float(1).sub(facing)), float(1.6))
  const warm = vertexColor().mul(vec3(1.5, 0.62, 0.42))
  const glow = warm.mul(edge.mul(wrap).mul(float(0.05).add(thin.mul(0.38))))
  m.emissiveNode = vec3(0.24, 0.9, 1).mul(rim).mul(0.2).add(vec3(0.015, 0.025, 0.04).mul(sky)).add(glow)
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
  m.emissiveNode = materialEmissive.mul(vertexColor()).mul(mix(float(0.5), float(1.2), lit)).add(vec3(0.55, 0.95, 1).mul(rim).mul(0.4)).add(vec3(1, 1, 1).mul(glint))
  return m
}

/** Depth-only twin of a hologram shell. Lets the shell draw just its outermost surface, so overlapping solids do not show through each other. */
export function depthOnlyMaterial(): THREE.MeshBasicNodeMaterial {
  const m = new THREE.MeshBasicNodeMaterial()
  m.colorWrite = false
  m.depthWrite = true
  return m
}

/**
 * Lit material for the textured hero scans: the scan's color map with the same soft down-facing occlusion, cool sky
 * fill and cyan rim as litSpecimen, so scans and procedural specimens sit in one lighting world.
 */
export function litHero(map: THREE.Texture | null, rough = 0.7): THREE.MeshStandardNodeMaterial {
  const m = new THREE.MeshStandardNodeMaterial({ roughness: rough, metalness: 0 })
  const facing = abs(dot(normalView, positionViewDirection))
  const rim = pow(saturate(float(1).sub(facing)), float(3))
  const sky = saturate(normalWorld.y.mul(0.5).add(0.5))
  const ao = mix(float(0.72), float(1), saturate(normalWorld.y.mul(1.1).add(0.55)))
  const base: THREE.Node<'vec3'> = map ? texture(map).rgb : vec3(0.7, 0.62, 0.5)
  // Scans carry some baked light; lift the deepest shadows a touch and keep saturation natural.
  m.colorNode = base.mul(1.06).mul(ao)
  m.emissiveNode = vec3(0.24, 0.9, 1).mul(rim).mul(0.16).add(vec3(0.015, 0.025, 0.04).mul(sky))
  return m
}
