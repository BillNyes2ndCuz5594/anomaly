import * as THREE from 'three/webgpu'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import pantherUrl from '../../assets/specimens/florida-panther.glb?url'
import crabUrl from '../../assets/specimens/blue-crab.glb?url'
import gatorUrl from '../../assets/specimens/american-alligator.glb?url'
import spiderUrl from '../../assets/specimens/garden-spider.glb?url'
import { specimenGeo } from './creatures'

// Hero specimens: textured scan-style models made with fal.ai (Hunyuan3D v3 from a reference photo), decimated to
// about 18k triangles with a 1024 px WebP color map and meshopt compression (200 to 340 KB each). They replace the
// procedural sculpt on Medium tier and up. Low tier and any load failure keep the procedural model.

interface HeroDef {
  url: string
  /** Yaw (radians) that turns the scan so the animal faces +x like the procedural models. */
  yaw: number
  /** Turn about x applied first, for scans captured standing up (the orb weaver hangs in its web). */
  tilt?: number
  /** Surface roughness for the lit material. */
  rough: number
}

export const HERO_SPECIMENS: Record<string, HeroDef> = {
  'florida-panther': { url: pantherUrl, yaw: 0, rough: 0.82 },
  'blue-crab': { url: crabUrl, yaw: 0, rough: 0.5 },
  'american-alligator': { url: gatorUrl, yaw: 0, rough: 0.7 },
  'garden-spider': { url: spiderUrl, yaw: 0, tilt: Math.PI / 2, rough: 0.55 },
}

export interface HeroSpecimen {
  geo: THREE.BufferGeometry
  map: THREE.Texture | null
  rough: number
}

const ready = new Map<string, HeroSpecimen>()
const pending = new Map<string, Promise<HeroSpecimen | null>>()
const listeners = new Set<() => void>()

export const hasHero = (id: string): boolean => id in HERO_SPECIMENS
export const heroIfReady = (id: string): HeroSpecimen | undefined => ready.get(id)
export function onHeroReady(fn: () => void): () => void {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}

let loader: GLTFLoader | null = null

/**
 * Scan geometry laid along x (its long axis), turned by `yaw` so the head points +x like the procedural models, then
 * scaled to sit inside the procedural model's box so the existing camera framing and pedestal rings still fit.
 */
export function normalizeHero(geo: THREE.BufferGeometry, yaw: number, target: [number, number, number], tilt = 0): THREE.BufferGeometry {
  if (tilt) geo.rotateX(tilt)
  geo.computeBoundingBox()
  const pre = new THREE.Vector3()
  geo.boundingBox!.getSize(pre)
  if (pre.z > pre.x) geo.rotateY(Math.PI / 2)
  if (yaw) geo.rotateY(yaw)
  geo.computeBoundingBox()
  const b = geo.boundingBox!
  const size = new THREE.Vector3()
  b.getSize(size)
  // Side silhouette (length and height) sets the size; width may run a little past the procedural box.
  const k = Math.min(target[0] / Math.max(size.x, 1e-6), target[1] / Math.max(size.y, 1e-6), (target[2] * 1.3) / Math.max(size.z, 1e-6))
  const c = new THREE.Vector3()
  b.getCenter(c)
  geo.translate(-c.x, -b.min.y, -c.z)
  geo.scale(k, k, k)
  geo.computeBoundingBox()
  geo.computeBoundingSphere()
  return geo
}

export function loadHero(id: string): Promise<HeroSpecimen | null> {
  const def = HERO_SPECIMENS[id]
  if (!def) return Promise.resolve(null)
  const have = ready.get(id)
  if (have) return Promise.resolve(have)
  let p = pending.get(id)
  if (!p) {
    loader ??= new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
    p = loader
      .loadAsync(def.url)
      .then((gltf) => {
        let mesh: THREE.Mesh | null = null
        gltf.scene.traverse((o) => {
          if (!mesh && (o as THREE.Mesh).isMesh) mesh = o as THREE.Mesh
        })
        if (!mesh) return null
        const m = mesh as THREE.Mesh
        m.updateWorldMatrix(true, false)
        const geo = toFloat(m.geometry as THREE.BufferGeometry).applyMatrix4(m.matrixWorld)
        const src = m.material as THREE.MeshStandardMaterial
        const map = src.map ?? null
        if (map) {
          map.colorSpace = THREE.SRGBColorSpace
          map.anisotropy = 4
        }
        const hero = { geo: normalizeHero(geo, def.yaw, specimenGeo(id).size, def.tilt), map, rough: def.rough }
        ready.set(id, hero)
        for (const fn of listeners) fn()
        return hero
      })
      .catch(() => null)
    pending.set(id, p)
  }
  return p
}

/**
 * The scans ship quantized (KHR_mesh_quantization: int16 positions, int8 normals). Transforming those in place would
 * clamp every vertex to the normalized range, so copy each attribute out to plain floats first.
 */
export function toFloat(src: THREE.BufferGeometry): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry()
  for (const [name, attr] of Object.entries(src.attributes)) {
    const a = attr as THREE.BufferAttribute
    const n = a.count
    const size = a.itemSize
    const out = new Float32Array(n * size)
    for (let i = 0; i < n; i++) for (let c = 0; c < size; c++) out[i * size + c] = a.getComponent(i, c)
    geo.setAttribute(name, new THREE.BufferAttribute(out, size))
  }
  if (src.index) geo.setIndex(src.index.clone())
  return geo
}

/** Starts every hero download (called once the 3D stage mounts, so items show the scan without a swap). */
export function preloadHeroes(): Promise<unknown> {
  const all = Promise.all(Object.keys(HERO_SPECIMENS).map(loadHero))
  if (typeof window !== 'undefined') (window as unknown as { __heroes?: Promise<unknown> }).__heroes = all
  return all
}
