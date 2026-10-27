import { useEffect, useMemo } from 'react'
import * as THREE from 'three/webgpu'

/**
 * Studio stage for the evidence canvases (specimens and organs): a navy gradient backdrop made in code, a soft lit
 * floor, a thin bevelled pedestal with a faint cyan edge and a baked contact shadow. No asset files, no shadow maps:
 * every piece is one cheap draw, so a two specimen item adds eight calls at most.
 */

function canvasTexture(w: number, h: number, paint: (c: CanvasRenderingContext2D, w: number, h: number) => void, srgb = true): THREE.CanvasTexture {
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  const c = cv.getContext('2d')
  if (c) paint(c, w, h)
  const t = new THREE.CanvasTexture(cv)
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  t.generateMipmaps = false
  t.minFilter = THREE.LinearFilter
  t.magFilter = THREE.LinearFilter
  t.needsUpdate = true
  return t
}

/** Deterministic hash noise so the dither is stable between mounts. */
function hash(n: number): number {
  const s = Math.sin(n * 127.1) * 43758.5453
  return s - Math.floor(s)
}

function paintBackdrop(c: CanvasRenderingContext2D, w: number, h: number) {
  const g = c.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, '#0e2240')
  g.addColorStop(0.55, '#173a60')
  g.addColorStop(1, '#0c2038')
  c.fillStyle = g
  c.fillRect(0, 0, w, h)
  // Soft cool pool of light behind the specimens, where the floor meets the wall.
  c.save()
  c.translate(w / 2, h * 0.62)
  c.scale(1, 0.5)
  const r = c.createRadialGradient(0, 0, 0, 0, 0, w * 0.62)
  r.addColorStop(0, 'rgba(96,160,196,0.1)')
  r.addColorStop(0.45, 'rgba(60,112,150,0.05)')
  r.addColorStop(1, 'rgba(30,70,104,0)')
  c.fillStyle = r
  c.fillRect(-w, -w, w * 2, w * 2)
  c.restore()
  // Gentle vignette so the edges of the glass panel fall away.
  const v = c.createRadialGradient(w / 2, h * 0.55, h * 0.3, w / 2, h * 0.55, w * 0.78)
  v.addColorStop(0, 'rgba(2,6,14,0)')
  v.addColorStop(1, 'rgba(2,6,14,0.5)')
  c.fillStyle = v
  c.fillRect(0, 0, w, h)
  // Dither: dark gradients band badly on 8 bit panels.
  const img = c.getImageData(0, 0, w, h)
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (hash(i) - 0.5) * 3.2
    img.data[i] = Math.max(0, Math.min(255, img.data[i] + n))
    img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n))
    img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n))
  }
  c.putImageData(img, 0, 0)
}

function paintFloor(c: CanvasRenderingContext2D, w: number, h: number) {
  c.translate(w / 2, h / 2)
  c.scale(1, h / w)
  const r = c.createRadialGradient(0, 0, 0, 0, 0, w / 2)
  r.addColorStop(0, 'rgba(255,255,255,0.9)')
  r.addColorStop(0.3, 'rgba(255,255,255,0.4)')
  r.addColorStop(0.6, 'rgba(255,255,255,0.08)')
  r.addColorStop(0.85, 'rgba(255,255,255,0)')
  r.addColorStop(1, 'rgba(255,255,255,0)')
  c.fillStyle = r
  c.fillRect(-w, -w, w * 2, w * 2)
}

function paintShadow(c: CanvasRenderingContext2D, w: number, h: number) {
  const cx = w / 2
  const r = c.createRadialGradient(cx, h / 2, 0, cx, h / 2, w / 2)
  r.addColorStop(0, 'rgba(0,0,0,0.95)')
  r.addColorStop(0.55, 'rgba(0,0,0,0.72)')
  r.addColorStop(0.8, 'rgba(0,0,0,0.3)')
  r.addColorStop(1, 'rgba(0,0,0,0)')
  c.fillStyle = r
  c.fillRect(0, 0, w, h)
}

/** Top face of the pedestal: dim glass disc, a soft shadow under the animal, a hairline ring and a faint glowing edge. */
function paintTop(c: CanvasRenderingContext2D, w: number, h: number) {
  const m = w / 2
  c.translate(m, m)
  const disc = c.createRadialGradient(0, 0, 0, 0, 0, m)
  disc.addColorStop(0, 'rgba(14,36,56,0.9)')
  disc.addColorStop(0.8, 'rgba(10,28,46,0.9)')
  disc.addColorStop(1, 'rgba(12,40,60,0.9)')
  c.fillStyle = disc
  c.beginPath()
  c.arc(0, 0, m, 0, Math.PI * 2)
  c.fill()
  // Contact shadow of the specimen on the glass.
  const s = c.createRadialGradient(0, 0, 0, 0, 0, m * 0.8)
  s.addColorStop(0, 'rgba(0,4,10,0.7)')
  s.addColorStop(0.6, 'rgba(0,4,10,0.35)')
  s.addColorStop(1, 'rgba(0,4,10,0)')
  c.fillStyle = s
  c.fillRect(-m, -m, w, h)
  // Hairline ring and tick marks.
  c.strokeStyle = 'rgba(62,230,255,0.22)'
  c.lineWidth = w * 0.004
  c.beginPath()
  c.arc(0, 0, m * 0.64, 0, Math.PI * 2)
  c.stroke()
  c.strokeStyle = 'rgba(62,230,255,0.3)'
  c.lineWidth = w * 0.006
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2
    const r0 = m * (i % 4 === 0 ? 0.8 : 0.85)
    c.beginPath()
    c.moveTo(Math.cos(a) * r0, Math.sin(a) * r0)
    c.lineTo(Math.cos(a) * m * 0.9, Math.sin(a) * m * 0.9)
    c.stroke()
  }
  // Faint emissive edge.
  const e = c.createRadialGradient(0, 0, m * 0.9, 0, 0, m)
  e.addColorStop(0, 'rgba(62,230,255,0)')
  e.addColorStop(0.7, 'rgba(62,230,255,0.14)')
  e.addColorStop(1, 'rgba(110,236,255,0.5)')
  c.fillStyle = e
  c.beginPath()
  c.arc(0, 0, m, 0, Math.PI * 2)
  c.arc(0, 0, m * 0.9, 0, Math.PI * 2, true)
  c.fill()
}

/** One shared set of textures for every stage on the page. Built lazily, kept for the session. */
let shared: { backdrop: THREE.CanvasTexture; floor: THREE.CanvasTexture; shadow: THREE.CanvasTexture; top: THREE.CanvasTexture } | null = null
function textures() {
  if (!shared) {
    shared = {
      backdrop: canvasTexture(512, 512, paintBackdrop),
      floor: canvasTexture(256, 256, paintFloor, false),
      shadow: canvasTexture(128, 128, paintShadow, false),
      top: canvasTexture(512, 512, paintTop),
    }
  }
  return shared
}

/** Screen space gradient backdrop, attached as the scene background. */
export function StageBackdrop() {
  const tex = useMemo(() => textures().backdrop, [])
  return <primitive object={tex} attach="background" />
}

/** Thin bevelled plinth: lathe body, decal top face and a blob shadow on the floor. Low tier uses fewer segments. */
export function StagePedestal({ radius = 1.8, low = false, tint = '#3ee6ff' }: { radius?: number; low?: boolean; tint?: string }) {
  const { body, top, shadow, pool, geo } = useMemo(() => {
    const t = textures()
    const b = new THREE.MeshStandardNodeMaterial({ color: '#14283f', metalness: 0.4, roughness: 0.38 })
    b.emissive.set('#0a2536')
    b.emissiveIntensity = 0.7
    const tp = new THREE.MeshBasicNodeMaterial()
    tp.map = t.top
    tp.transparent = true
    tp.depthWrite = false
    tp.polygonOffset = true
    tp.polygonOffsetFactor = -2
    tp.color.set(tint === '#3ee6ff' ? '#ffffff' : tint)
    const sh = new THREE.MeshBasicNodeMaterial()
    sh.map = t.shadow
    sh.transparent = true
    sh.depthWrite = false
    sh.opacity = 0.9
    const pl = new THREE.MeshBasicNodeMaterial()
    pl.map = t.floor
    pl.color.set('#4d8aa6')
    pl.opacity = 0.2
    pl.transparent = true
    pl.depthWrite = false
    pl.blending = THREE.AdditiveBlending
    const r = radius / 1.07
    const pts = [
      [0, 0.036],
      [r * 0.9, 0.036],
      [r * 0.962, 0.031],
      [r * 0.99, 0.02],
      [r, 0.008],
      [r, -0.014],
      [r * 1.03, -0.032],
      [r * 1.07, -0.045],
      [0, -0.045],
    ].map(([x, y]) => new THREE.Vector2(x, y))
    return { body: b, top: tp, shadow: sh, pool: pl, geo: new THREE.LatheGeometry(pts, low ? 40 : 72) }
  }, [radius, low, tint])
  useEffect(
    () => () => {
      body.dispose()
      top.dispose()
      shadow.dispose()
      pool.dispose()
      geo.dispose()
    },
    [body, top, shadow, pool, geo],
  )
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.045, 0]} scale={radius * 2.8} renderOrder={-2} userData={{ noFit: true }}>
        <planeGeometry args={[1, 0.72]} />
        <primitive object={pool} attach="material" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-radius * 0.06, -0.043, -radius * 0.1]} scale={radius * 2.7} renderOrder={-1} userData={{ noFit: true }}>
        <planeGeometry args={[1, 0.8]} />
        <primitive object={shadow} attach="material" />
      </mesh>
      <mesh geometry={geo}>
        <primitive object={body} attach="material" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0375, 0]} renderOrder={1}>
        <circleGeometry args={[(radius / 1.07) * 0.995, low ? 40 : 72]} />
        <primitive object={top} attach="material" />
      </mesh>
    </group>
  )
}
