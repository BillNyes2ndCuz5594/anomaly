import { useEffect, useState } from 'react'
import * as THREE from 'three/webgpu'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import organsUrl from '../../assets/scans/organ-scans.glb?url'
import oakUrl from '../../assets/scans/oak-scans.glb?url'
import { toFloat } from './heroSpecimens'
import { OAK_ACORNS, oakLeafEnds, rng } from './labB'
import type { V3 } from './builder'

// Lab scans (fal wave 4b): organs for Lab A and live oak sprigs and acorns for Lab B, made with fal.ai (FLUX reference
// photo, then Hunyuan3D v3), decimated and baked offline to plain meshes whose COLOR_0 is the scan's own light and dark
// (grey shade, no texture). The organ and hologram materials multiply that shade into their glow, so each part keeps
// its tint and states while showing real surface detail. Each scan is fitted to the procedural part it replaces, so
// framing, picking and light bridges stay put. The Low tier and any load failure keep the procedural parts.

const loader = () => (shared ??= new GLTFLoader().setMeshoptDecoder(MeshoptDecoder))
let shared: GLTFLoader | null = null

type Pack = Map<string, THREE.BufferGeometry>
const packs = new Map<string, Promise<Pack>>()
const done = new Map<string, Pack>()

function loadPack(url: string): Promise<Pack> {
  let p = packs.get(url)
  if (!p) {
    p = loader()
      .loadAsync(url)
      .then((gltf) => {
        const out: Pack = new Map()
        gltf.scene.updateMatrixWorld(true)
        gltf.scene.traverse((o) => {
          const m = o as THREE.Mesh
          if (!m.isMesh) return
          const geo = toFloat(m.geometry as THREE.BufferGeometry).applyMatrix4(m.matrixWorld)
          geo.computeBoundingBox()
          const c = geo.boundingBox!.getCenter(new THREE.Vector3())
          geo.translate(-c.x, -c.y, -c.z)
          out.set(m.name || o.parent?.name || '', geo)
        })
        done.set(url, out)
        return out
      })
      .catch(() => new Map())
    packs.set(url, p)
  }
  return p
}

/** Scales `geo` per axis so its box matches `size`, centered on `at`. */
function fitBox(geo: THREE.BufferGeometry, size: THREE.Vector3, at: THREE.Vector3): THREE.BufferGeometry {
  geo.computeBoundingBox()
  const s = geo.boundingBox!.getSize(new THREE.Vector3())
  const c = geo.boundingBox!.getCenter(new THREE.Vector3())
  geo.translate(-c.x, -c.y, -c.z)
  geo.scale(size.x / Math.max(s.x, 1e-6), size.y / Math.max(s.y, 1e-6), size.z / Math.max(s.z, 1e-6))
  geo.translate(at.x, at.y, at.z)
  return geo
}

function finish(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  geo.deleteAttribute('normal')
  geo.computeVertexNormals()
  geo.computeBoundingBox()
  geo.computeBoundingSphere()
  return geo
}

// ---------- organs ----------

/** Organs that have a scan in organ-scans.glb (mesh names). The rest stay procedural. */
export const ORGAN_SCAN_IDS = ['brain', 'heart', 'lungs', 'liver', 'stomach', 'pancreas', 'large-intestine', 'kidneys'] as const
const organCache = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>()

/** The scan fitted into the procedural organ's own box (the organ geometry is centered on its origin). */
export function fitOrgan(scan: THREE.BufferGeometry, procedural: THREE.BufferGeometry): THREE.BufferGeometry {
  procedural.computeBoundingBox()
  const b = procedural.boundingBox!
  return finish(fitBox(scan.clone(), b.getSize(new THREE.Vector3()), b.getCenter(new THREE.Vector3())))
}

// Kidney spots copied from the procedural kidneys (humanOrgans.ts), figure space. k = -1 is the figure's right (-x).
const kidneyAt = (k: number): V3 => [k * 0.46, 3.7 + (k > 0 ? 0.05 : 0), -0.2]
const KIDNEY_SIZE = new THREE.Vector3(0.34, 0.58, 0.21)

/** Mirrors a geometry across x and flips its winding so it still faces out. */
function mirrorX(g: THREE.BufferGeometry): THREE.BufferGeometry {
  g.scale(-1, 1, 1)
  const idx = g.index!
  const a = idx.array as Uint16Array | Uint32Array
  for (let i = 0; i < a.length; i += 3) [a[i + 1], a[i + 2]] = [a[i + 2], a[i + 1]]
  idx.needsUpdate = true
  return g
}

/**
 * Both kidneys from the one scan (a right kidney, hilum facing +x): the right one as is, the left one mirrored, each on
 * its procedural spot with the upper pole tipped in toward the spine, plus the ureters down to the bladder.
 * `center` is the organ's figure-space center, which the organ geometry is relative to.
 */
export function kidneyPair(scan: THREE.BufferGeometry, center: V3): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  for (const k of [-1, 1]) {
    const c = kidneyAt(k)
    let g = keepShade(scan.clone())
    if (k > 0) g = mirrorX(g)
    fitBox(g, KIDNEY_SIZE, new THREE.Vector3())
    g.rotateZ(k * 0.2).translate(c[0] - center[0], c[1] - center[1], c[2] - center[2])
    parts.push(g)
    const pts = [
      [c[0] - k * 0.1, c[1] - 0.1, c[2]],
      [k * 0.3, 3.42, -0.16],
      [k * 0.2, 3.2, -0.06],
      [k * 0.06, 3.02, 0.06],
    ].map(([x, y, z]) => new THREE.Vector3(x - center[0], y - center[1], z - center[2]))
    parts.push(keepShade(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.022, 8, false)))
  }
  return finish(mergeGeometries(parts))
}

function organScan(id: string, procedural: THREE.BufferGeometry, center: V3): THREE.BufferGeometry | undefined {
  const have = organCache.get(procedural)
  if (have) return have
  const pack = done.get(organsUrl)
  const scan = pack?.get(id === 'kidneys' ? 'kidney' : id)
  if (!scan) return undefined
  const geo = id === 'kidneys' ? kidneyPair(scan, center) : fitOrgan(scan, procedural)
  organCache.set(procedural, geo)
  return geo
}

/** Scanned organ geometry once loaded (never on the Low tier); the procedural geometry until then. */
export function useOrganGeo(id: string, procedural: THREE.BufferGeometry, center: V3, low: boolean): THREE.BufferGeometry {
  const wanted = !low && (ORGAN_SCAN_IDS as readonly string[]).includes(id)
  const [, bump] = useState(0)
  useEffect(() => {
    if (!wanted || done.has(organsUrl)) return
    let live = true
    loadPack(organsUrl).then(() => live && bump((n) => n + 1))
    return () => {
      live = false
    }
  }, [wanted])
  return (wanted && organScan(id, procedural, center)) || procedural
}

// ---------- oak ----------

/** Lab B oak parts with a scanned upgrade. */
export const OAK_SCAN_PARTS = ['leaf', 'fruit'] as const
const SPRIGS_PER_CLUSTER = 4
const oakCache = new Map<string, THREE.BufferGeometry>()

/** Sprig copies grown outward from every leaf cluster center, in oak space. */
export function sprigCluster(sprig: THREE.BufferGeometry, ends: [V3, number][], per = SPRIGS_PER_CLUSTER): THREE.BufferGeometry {
  sprig.computeBoundingBox()
  const len = sprig.boundingBox!.max.y - sprig.boundingBox!.min.y
  const base = sprig.clone().translate(0, -sprig.boundingBox!.min.y, 0)
  const rnd = rng(11)
  const up = new THREE.Vector3(0, 1, 0)
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const out: THREE.BufferGeometry[] = []
  for (const [c, r] of ends) {
    const a0 = rnd() * Math.PI * 2
    for (let i = 0; i < per; i++) {
      // spread the sprigs around the cluster, leaning out and mostly up, each spun by a random roll
      const a = a0 + (i / per) * Math.PI * 2 + (rnd() - 0.5) * 0.8
      const d = new THREE.Vector3(Math.cos(a), 0.35 + rnd() * 0.6, Math.sin(a)).normalize()
      q.setFromAxisAngle(d, rnd() * Math.PI * 2).multiply(new THREE.Quaternion().setFromUnitVectors(up, d))
      const k = (r * (1.35 + rnd() * 0.4)) / Math.max(len, 1e-6)
      const p = new THREE.Vector3(...c).addScaledVector(d, -r * 0.3)
      out.push(base.clone().applyMatrix4(m.compose(p, q, new THREE.Vector3(k, k, k))))
    }
  }
  return mergeGeometries(out)
}

/** Acorn copies on the procedural acorn spots (body and cap span y-0.15 to y+0.21, oak space). */
export function acornSet(acorn: THREE.BufferGeometry): THREE.BufferGeometry {
  const out: THREE.BufferGeometry[] = []
  acorn.computeBoundingBox()
  const s = acorn.boundingBox!.getSize(new THREE.Vector3())
  const k = 0.36 / Math.max(s.y, 1e-6)
  const rnd = rng(5)
  for (const [x, y, z] of OAK_ACORNS) {
    const g = acorn.clone().scale(k, k, k).rotateY(rnd() * Math.PI * 2)
    out.push(g.translate(x, y + 0.03, z))
    // the short stalk the acorn hangs from
    out.push(new THREE.CylinderGeometry(0.014, 0.014, 0.12, 5, 1).translate(x + 0.01, y + 0.25, z))
  }
  const geo = mergeGeometries(out.map((g) => keepShade(g)))
  return geo
}

/** Gives a stalk or other plain geometry the same attributes as a scan (white shade, no uv). */
function keepShade(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const ng = g
  for (const a of Object.keys(ng.attributes)) if (a !== 'position' && a !== 'color') ng.deleteAttribute(a)
  if (!ng.getAttribute('color')) {
    const n = ng.getAttribute('position').count
    ng.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(0.85), 3))
  }
  const c = ng.getAttribute('color')
  if (c.itemSize === 4) {
    const src = c.array as ArrayLike<number>
    const out = new Float32Array(c.count * 3)
    for (let i = 0; i < c.count; i++) out.set([src[i * 4], src[i * 4 + 1], src[i * 4 + 2]], i * 3)
    ng.setAttribute('color', new THREE.BufferAttribute(out, 3))
  }
  if (!ng.index) ng.setIndex([...Array(ng.getAttribute('position').count).keys()])
  return ng
}

/** Oak part `id` built from the scans in oak space, then put in the procedural part's frame (scale, minus center). */
export function oakScanPart(id: string, pack: Pack, scale: number, center: V3): THREE.BufferGeometry | undefined {
  let geo: THREE.BufferGeometry | undefined
  if (id === 'leaf' && pack.get('sprig')) geo = sprigCluster(keepShade(pack.get('sprig')!.clone()), oakLeafEnds())
  if (id === 'fruit' && pack.get('acorn')) geo = acornSet(keepShade(pack.get('acorn')!.clone()))
  if (!geo) return undefined
  geo.scale(scale, scale, scale).translate(-center[0], -center[1], -center[2])
  return finish(geo)
}

/** Scanned oak part once loaded (never on the Low tier); the procedural part until then. */
export function useOakGeo(id: string, procedural: THREE.BufferGeometry, center: V3, scale: number, low: boolean, oak: boolean | undefined): THREE.BufferGeometry {
  const wanted = oak && !low && (OAK_SCAN_PARTS as readonly string[]).includes(id)
  const [, bump] = useState(0)
  useEffect(() => {
    if (!wanted || done.has(oakUrl)) return
    let live = true
    loadPack(oakUrl).then(() => live && bump((n) => n + 1))
    return () => {
      live = false
    }
  }, [wanted])
  if (!wanted) return procedural
  const pack = done.get(oakUrl)
  if (!pack) return procedural
  const key = `${id}:${center.join(',')}`
  let geo = oakCache.get(key)
  if (!geo) {
    geo = oakScanPart(id, pack, scale, center)
    if (!geo) return procedural
    oakCache.set(key, geo)
  }
  return geo
}
