import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three/webgpu'
import { abs, asin, atan, clamp, color, dot, float, mix, normalize, oneMinus, positionWorld, pow, saturate, smoothstep, texture, uniform, varying, vec2, vec3 } from 'three/tsl'
import { useMotionMode } from '../../ui/useMotionMode'
import { CLIPS, type LoopClip } from './loopClips'

/** Elevation band (radians above the horizon) and azimuth width the clip covers on the dome. */
const EL_LO = -0.02
const EL_HI = 0.7
const AZ_SPAN = 1.3

function makeVideo(src: { webm: string; mp4: string }): HTMLVideoElement {
  const v = document.createElement('video')
  v.muted = true
  v.defaultMuted = true
  v.loop = true
  v.autoplay = true
  v.playsInline = true
  v.preload = 'auto'
  v.setAttribute('muted', '')
  v.setAttribute('playsinline', '')
  v.setAttribute('aria-hidden', 'true')
  for (const [url, type] of [
    [src.webm, 'video/webm'],
    [src.mp4, 'video/mp4'],
  ] as const) {
    const s = document.createElement('source')
    s.src = url
    s.type = type
    v.appendChild(s)
  }
  return v
}

/** Navy sky dome with an ambient video loop blended into it. */
export function LoopSky({ clip, strength = 0.62 }: { clip: LoopClip; strength?: number }) {
  // fade (Low tier) and still (reduced motion, ?still=1) both get the poster only, with no video element.
  const mode = useMotionMode()
  const still = mode === 'still'
  const src = CLIPS[clip]

  const { mat, poster, video, vnode, u } = useMemo(() => {
    const u = { show: uniform(0), live: uniform(0), az: uniform(0) }
    const poster = new THREE.Texture()
    poster.colorSpace = THREE.SRGBColorSpace
    const video = mode === 'full' ? makeVideo(src) : null

    // Everything but the texture reads is per vertex (the dome is 48x24, smooth enough for these slow gradients),
    // so the fragment cost is two texture samples and a few mixes, cheap on low power GPUs.
    const dir = normalize(positionWorld)
    const h = dir.y
    const horizon = pow(oneMinus(saturate(abs(h).mul(2.2))), float(3))
    const base = mix(color('#0a1426'), color('#060a14'), saturate(h.mul(1.6)))
    const haze = base.add(color('#1b6a86').mul(horizon.mul(0.3)))
    // Match the deck fog below the horizon without changing the cyan haze above it.
    const sky = varying(mix(haze, color('#070c17'), smoothstep(0.02, 0.25, h.negate())))

    // Azimuth relative to the window centre (radians), wrapped to -pi..pi through atan of a rotated direction.
    // The wrap sits directly behind the window, where the front mask is zero, so interpolation across it is hidden.
    const fwd = vec2(u.az.sin(), u.az.cos().negate())
    const side = vec2(fwd.y.negate(), fwd.x)
    const flat = vec2(dir.x, dir.z)
    const da = atan(dot(flat, side), dot(flat, fwd))
    const el = asin(clamp(h, -1, 1))
    const uvx = varying(da.div(AZ_SPAN).add(0.5))
    const uvy = varying(el.sub(EL_LO).div(EL_HI - EL_LO))
    const front = varying(smoothstep(0, 0.35, dot(flat, fwd)))
    const uvn = vec2(saturate(uvx), oneMinus(saturate(uvy)))
    const edgeX = smoothstep(0, 0.22, uvx).mul(smoothstep(1, 0.78, uvx))
    const edgeY = smoothstep(0, 0.3, uvy).mul(smoothstep(1, 0.72, uvy))
    const aboveHorizon = varying(smoothstep(0, 0.06, h))
    const mask = edgeX.mul(edgeY).mul(front).mul(aboveHorizon).mul(u.show).mul(strength)

    const still4 = texture(poster, uvn).rgb
    // The video slot samples the poster until the clip has a decoded frame, then its value is swapped to the
    // video texture. Swapping the bound texture keeps the same pipeline, so the first frames never stall.
    const vnode = video ? texture(poster, uvn) : null
    const pix = vnode ? mix(still4, vnode.rgb, u.live) : still4
    // Grade: keep some of the clip's own colour, pull the rest toward the cyan key, and darken under the UI.
    const lum = dot(pix, vec3(0.2126, 0.7152, 0.0722))
    const graded = mix(color('#2fb8d8').mul(lum.mul(1.35)), pix, 0.5).mul(0.78)
    const m = new THREE.MeshBasicNodeMaterial()
    m.colorNode = mix(sky, graded, mask)
    m.side = THREE.BackSide
    m.fog = false
    m.depthWrite = false
    return { mat: m, poster, video, vnode, u }
  }, [src, mode, strength])

  useEffect(() => {
    let dead = false
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => {
      if (dead) return
      poster.image = img
      poster.needsUpdate = true
      u.show.value = still ? 1 : 0.0001
    }
    img.src = src.poster
    let onPlaying: (() => void) | null = null
    let vtex: THREE.VideoTexture | null = null
    if (video && vnode) {
      onPlaying = () => {
        const ready = () => {
          if (dead || vtex) return
          vtex = new THREE.VideoTexture(video)
          vtex.colorSpace = THREE.SRGBColorSpace
          vnode.value = vtex
          u.live.value = Math.max(u.live.value, 0.0001)
        }
        const rvfc = (video as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number }).requestVideoFrameCallback
        if (rvfc) rvfc.call(video, ready)
        else ready()
      }
      video.addEventListener('playing', onPlaying)
      video.play().catch(() => {
        // Autoplay refused: the poster stays, which is the static fallback.
      })
    }
    return () => {
      dead = true
      if (video) {
        if (onPlaying) video.removeEventListener('playing', onPlaying)
        video.pause()
        video.removeAttribute('src')
        while (video.firstChild) video.removeChild(video.firstChild)
        video.load()
      }
      vtex?.dispose()
      poster.dispose()
      mat.dispose()
    }
  }, [mat, poster, video, vnode, u, src, still])

  useFrame((state, dt) => {
    const step = Math.min(dt, 0.05)
    if (u.show.value > 0 && u.show.value < 1) u.show.value = still ? 1 : THREE.MathUtils.damp(u.show.value, 1, 8, step)
    if (u.live.value > 0 && u.live.value < 1) u.live.value = THREE.MathUtils.damp(u.live.value, 1, 6, step)
    // The window settles where the camera looks and then follows it slowly, so it reads as part of the far sky.
    const d = state.camera.getWorldDirection(tmp)
    const target = Math.atan2(d.x, -d.z)
    let delta = target - u.az.value
    delta = Math.atan2(Math.sin(delta), Math.cos(delta))
    u.az.value += still || u.show.value <= 0.0001 ? delta : delta * Math.min(1, step * 0.6)
  })

  return (
    <mesh renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[90, 48, 24]} />
      <primitive object={mat} attach="material" />
    </mesh>
  )
}

const tmp = new THREE.Vector3()
