import type { CaseDef, Item } from '../../content/schema'
import { MINERAL_LIST, ROCK_LIST } from '../../screens/case/labDData'
import * as THREE from 'three/webgpu'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import pantherUrl from '../../assets/specimens/florida-panther.glb?url'
import crabUrl from '../../assets/specimens/blue-crab.glb?url'
import gatorUrl from '../../assets/specimens/american-alligator.glb?url'
import spiderUrl from '../../assets/specimens/garden-spider.glb?url'
import bassUrl from '../../assets/specimens/largemouth-bass.glb?url'
import frogUrl from '../../assets/specimens/green-tree-frog.glb?url'
import owlUrl from '../../assets/specimens/barred-owl.glb?url'
import pelicanUrl from '../../assets/specimens/brown-pelican.glb?url'
import sharkUrl from '../../assets/specimens/bull-shark.glb?url'
import tortoiseUrl from '../../assets/specimens/gopher-tortoise.glb?url'
import grasshopperUrl from '../../assets/specimens/grasshopper.glb?url'
import manateeUrl from '../../assets/specimens/manatee.glb?url'
import quartzUrl from '../../assets/specimens/quartz.glb?url'
import pyriteUrl from '../../assets/specimens/pyrite.glb?url'
import feldsparUrl from '../../assets/specimens/feldspar.glb?url'
import micaUrl from '../../assets/specimens/mica.glb?url'
import calciteUrl from '../../assets/specimens/calcite.glb?url'
import talcUrl from '../../assets/specimens/talc.glb?url'
import graphiteUrl from '../../assets/specimens/graphite.glb?url'
import graniteUrl from '../../assets/specimens/granite.glb?url'
import limestoneUrl from '../../assets/specimens/limestone.glb?url'
import gneissUrl from '../../assets/specimens/gneiss.glb?url'

import quartzPoster from '../../assets/specimens/quartz.webp'
import pyritePoster from '../../assets/specimens/pyrite.webp'
import feldsparPoster from '../../assets/specimens/feldspar.webp'
import micaPoster from '../../assets/specimens/mica.webp'
import calcitePoster from '../../assets/specimens/calcite.webp'
import talcPoster from '../../assets/specimens/talc.webp'
import graphitePoster from '../../assets/specimens/graphite.webp'
import granitePoster from '../../assets/specimens/granite.webp'
import limestonePoster from '../../assets/specimens/limestone.webp'
import gneissPoster from '../../assets/specimens/gneiss.webp'
import { specimenGeo, type SpecimenId } from './creatures'
import { meanProjectedArea, outlinePoints } from '../fit'
import { DISPLAY_YAW, specimenArea } from './specimenBox'

// Hero specimens: textured scan-style models made with fal.ai (Hunyuan3D v3 from a reference photo), decimated to
// about 18k triangles with a 1024 px WebP color map and meshopt compression (about 160 to 410 KB each). They replace the
// procedural sculpt on Medium tier and up. Low tier and any load failure keep the procedural model.

interface HeroDef {
  url: string
  /** Yaw (radians) that turns the scan so the animal faces +x like the procedural models. */
  yaw: number
  /** Turn about x applied first, for a scan captured from above (none need it since the wave 7 spider). */
  tilt?: number
  /** Surface roughness for the lit material. */
  rough: number
  /** Surface metalness (metallic only for pyrite and graphite). */
  metalness?: number
  /** Depth allowance past the procedural box, for a scan whose legs reach toward the camera (default HERO_SLACK). */
  slack?: number
}

export const HERO_SPECIMENS: Record<string, HeroDef> = {
  'florida-panther': { url: pantherUrl, yaw: 0, rough: 0.82 },
  'blue-crab': { url: crabUrl, yaw: Math.PI / 4, rough: 0.5 },
  'american-alligator': { url: gatorUrl, yaw: 0, rough: 0.7 },
  'garden-spider': { url: spiderUrl, yaw: Math.PI / 2, rough: 0.55, slack: 1.2 },
  'largemouth-bass': { url: bassUrl, yaw: Math.PI, rough: 0.45 },
  'green-tree-frog': { url: frogUrl, yaw: 0, rough: 0.55 },
  'barred-owl': { url: owlUrl, yaw: 0, rough: 0.85 },
  'brown-pelican': { url: pelicanUrl, yaw: 0, rough: 0.8 },
  'bull-shark': { url: sharkUrl, yaw: 0, rough: 0.5 },
  'gopher-tortoise': { url: tortoiseUrl, yaw: 0, rough: 0.8 },
  grasshopper: { url: grasshopperUrl, yaw: 0, rough: 0.6 },
  manatee: { url: manateeUrl, yaw: 0, rough: 0.75 },
  quartz: { url: quartzUrl, yaw: 0, rough: 0.3 },
  pyrite: { url: pyriteUrl, yaw: 0, rough: 0.35, metalness: 0.85 },
  feldspar: { url: feldsparUrl, yaw: 0, rough: 0.6 },
  mica: { url: micaUrl, yaw: 0, rough: 0.4 },
  calcite: { url: calciteUrl, yaw: 0, rough: 0.45 },
  talc: { url: talcUrl, yaw: 0, rough: 0.7 },
  graphite: { url: graphiteUrl, yaw: 0, rough: 0.4, metalness: 0.8 },
  granite: { url: graniteUrl, yaw: 0, rough: 0.75 },
  limestone: { url: limestoneUrl, yaw: 0, rough: 0.8 },
  gneiss: { url: gneissUrl, yaw: 0, rough: 0.75 },
}

export const SPECIMEN_POSTERS: Partial<Record<SpecimenId, string>> = {
  quartz: quartzPoster,
  pyrite: pyritePoster,
  feldspar: feldsparPoster,
  mica: micaPoster,
  calcite: calcitePoster,
  talc: talcPoster,
  graphite: graphitePoster,
  granite: granitePoster,
  limestone: limestonePoster,
  gneiss: gneissPoster,
}

export interface HeroSpecimen {
  geo: THREE.BufferGeometry
  map: THREE.Texture | null
  rough: number
  metalness?: number
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

/** How far a scan's height may exceed the procedural box (the camera frames the procedural outline). */
const HERO_REACH = 1.05
/** Width allowance past the procedural box (depth barely shows at the display yaw). */
const HERO_SLACK = 1.4

/**
 * Scan geometry laid along x (its long axis), turned by `yaw` so the head points +x like the procedural models, then
 * scaled to sit inside the procedural model's box so the existing camera framing and pedestal rings still fit.
 */
export function normalizeHero(
  geo: THREE.BufferGeometry,
  yaw: number,
  target: [number, number, number],
  tilt = 0,
  area = 0,
  slack = HERO_SLACK,
): THREE.BufferGeometry {
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
  const c = new THREE.Vector3()
  b.getCenter(c)
  geo.translate(-c.x, -b.min.y, -c.z)
  // With `area` (the procedural model's mean silhouette), the scan takes the same on-screen room as the model it
  // replaces, so it fills its pedestal ring however much empty space the procedural box carries. The box caps keep
  // it inside the camera framing.
  let k = Infinity
  if (area) {
    const pts = outlinePoints(geo.getAttribute('position').array as ArrayLike<number>, 128)
    k = Math.sqrt(area / Math.max(meanProjectedArea(pts, DISPLAY_YAW, 0.6, 0.24), 1e-9))
  }
  k = Math.min(
    k,
    target[0] / Math.max(size.x, 1e-6),
    (target[1] * HERO_REACH) / Math.max(size.y, 1e-6),
    (target[2] * slack) / Math.max(size.z, 1e-6),
  )
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
        const hero = { geo: normalizeHero(geo, def.yaw, specimenGeo(id).size, def.tilt, specimenArea(id), def.slack), map, rough: def.rough, metalness: def.metalness }
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

/** Fetch selected specimens now, sharing the same cache as mounted visuals. */
export function prefetchHeroes(ids: readonly string[]): Promise<unknown> {
  const all = Promise.all([...new Set(ids)].map(loadHero))
  if (typeof window !== 'undefined') (window as unknown as { __heroes?: Promise<unknown> }).__heroes = all
  return all
}

/** One download per idle turn. Cleanup prevents further work after a route or tier change. */
export function idlePrefetchHeroes(): () => void {
  let cancelled = false
  let cancelScheduled = () => {}
  const ids = Object.keys(HERO_SPECIMENS)
  const schedule = () => {
    if (cancelled || ids.length === 0) return
    const run = () => {
      if (cancelled) return
      const id = ids.shift()!
      void prefetchHeroes([id]).then(schedule)
    }
    if (typeof window.requestIdleCallback === 'function') {
      const handle = window.requestIdleCallback(run)
      cancelScheduled = () => window.cancelIdleCallback(handle)
    } else {
      const handle = window.setTimeout(run, 500)
      cancelScheduled = () => window.clearTimeout(handle)
    }
  }
  schedule()
  return () => {
    cancelled = true
    cancelScheduled()
  }
}

/** Include lab specimens as well as evidence, so briefing time can hide downloads. */
export function prefetchCaseHeroes(caseDef: CaseDef | null, items: readonly Item[]): Promise<unknown> {
  const ids = items.flatMap((item) => item.visual.kind === 'specimen' ? item.visual.ids : [])
  ids.push(...(caseDef?.labs?.specimenSort.specimens.map((s) => s.id) ?? []))
  if (caseDef?.lab.kind === 'vitals') ids.unshift('manatee')
  if (caseDef?.id === '04-1') ids.push(...MINERAL_LIST, ...ROCK_LIST)
  return prefetchHeroes(ids)
}
