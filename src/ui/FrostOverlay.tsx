import { useEffect, useRef, useState } from 'react'
import { resolveTier } from '../state/quality'
import { useRuntime } from '../state/runtime'
import { useGame } from '../state/store'
import { useMotionMode } from './useMotionMode'
import frostFrame from '../assets/textures/cold-frost-frame.webp?url'
import creepWebm from '../assets/video/cold-frost-creep.webm?url'
import creepMp4 from '../assets/video/cold-frost-creep.mp4?url'
import thawWebm from '../assets/video/cold-thaw.webm?url'
import thawMp4 from '../assets/video/cold-thaw.mp4?url'
import thawHold from '../assets/video/cold-thaw-hold.webp?url'
import thawEnd from '../assets/video/cold-thaw-end.webp?url'
import './frost.css'

// Cold case frost overlays. The art sits on pure black (there is no alpha video), so every layer composites with
// mix-blend-mode: screen. Motion modes: full plays the clips, fade only changes opacity (no video, no transforms),
// still shows the final state at once and never mounts a <video> element.

const CREEP_REVEAL_MS = 1400
const CREEP_VIDEO_FADE_AT_MS = 1400
const CREEP_VIDEO_END_MS = 2200
const THAW_HOLD_AT = 0.55
const THAW_START_DELAY_MS = 380
const NOISE_W = 480
const NOISE_H = 270

/** Resolves once the veil has finished revealing (or after a cap), so the frost starts on a settled screen. */
function useAfterVeil(enabled: boolean): boolean {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (!enabled) return
    let dead = false
    const t0 = performance.now()
    const poll = window.setInterval(() => {
      const phase = document.querySelector<HTMLElement>('.veil')?.dataset.phase
      if (dead || (phase && phase !== 'idle' && performance.now() - t0 < 2600)) return
      window.clearInterval(poll)
      setReady(true)
    }, 80)
    return () => {
      dead = true
      window.clearInterval(poll)
    }
  }, [enabled])
  return ready
}

/** A muted, inline, preloaded clip that stays invisible until its first frame has been decoded. */
function Clip({ webm, mp4, className, onFrame, onEnded, onTime }: { webm: string; mp4: string; className: string; onFrame?: () => void; onEnded?: () => void; onTime?: (v: HTMLVideoElement) => void}) {
  const ref = useRef<HTMLVideoElement | null>(null)
  const [live, setLive] = useState(false)
  useEffect(() => {
    const v = ref.current
    if (!v) return
    let dead = false
    const shown = () => {
      if (dead) return
      setLive(true)
      onFrame?.()
    }
    const onPlaying = () => {
      const rvfc = (v as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number }).requestVideoFrameCallback
      if (rvfc) rvfc.call(v, shown)
      else shown()
    }
    const tick = () => onTime?.(v)
    v.addEventListener('playing', onPlaying)
    if (onTime) v.addEventListener('timeupdate', tick)
    v.play().catch(() => {
      // Autoplay refused: the still layer underneath is the fallback.
    })
    return () => {
      dead = true
      v.removeEventListener('playing', onPlaying)
      v.removeEventListener('timeupdate', tick)
      v.pause()
    }
    // The handlers are stable for the life of one mount.
    // oxlint-disable-next-line react/exhaustive-deps
  }, [])
  return (
    <video ref={ref} className={className} data-live={live ? 'yes' : 'no'} muted playsInline preload="auto" aria-hidden="true" tabIndex={-1} onEnded={onEnded}>
      <source src={webm} type="video/webm" />
      <source src={mp4} type="video/mp4" />
    </video>
  )
}

/** Cheap value noise on a coarse grid, smoothed, for the frost reveal threshold. */
function buildThresholds(): Float32Array {
  const g = 14
  const cells = new Float32Array((g + 1) * (g + 1))
  let seed = 7
  for (let i = 0; i < cells.length; i++) {
    seed = (seed * 16807) % 2147483647
    cells[i] = seed / 2147483647
  }
  const out = new Float32Array(NOISE_W * NOISE_H)
  for (let y = 0; y < NOISE_H; y++) {
    for (let x = 0; x < NOISE_W; x++) {
      const nx = x / NOISE_W
      const ny = y / NOISE_H
      const fx = nx * g
      const fy = ny * g
      const ix = Math.floor(fx)
      const iy = Math.floor(fy)
      const tx = fx - ix
      const ty = fy - iy
      const sx = tx * tx * (3 - 2 * tx)
      const sy = ty * ty * (3 - 2 * ty)
      const a = cells[iy * (g + 1) + ix]
      const b = cells[iy * (g + 1) + ix + 1]
      const c = cells[(iy + 1) * (g + 1) + ix]
      const d = cells[(iy + 1) * (g + 1) + ix + 1]
      const noise = a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy
      // Frost grows in from the edges: small thresholds near the border, large toward the centre.
      const edge = Math.min(nx, 1 - nx, ny * 1.4, (1 - ny) * 1.4) * 2
      out[y * NOISE_W + x] = Math.min(1, edge) * 0.72 + noise * 0.28
    }
  }
  return out
}

/** The frost frame revealed through a noise threshold over CREEP_REVEAL_MS. Draws to a small canvas, then stops. */
function RevealCanvas({ start }: { start: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas || !start) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let dead = false
    let raf = 0
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => {
      if (dead) return
      ctx.drawImage(img, 0, 0, NOISE_W, NOISE_H)
      const frame = ctx.getImageData(0, 0, NOISE_W, NOISE_H)
      const px = frame.data
      const th = buildThresholds()
      for (let i = 3; i < px.length; i += 4) px[i] = 0
      const t0 = performance.now()
      const step = (now: number) => {
        if (dead) return
        const k = Math.min(1, (now - t0) / CREEP_REVEAL_MS)
        const p = 1 - Math.pow(1 - k, 2)
        for (let i = 0, j = 3; i < th.length; i++, j += 4) {
          const a = (p * 1.35 - th[i]) * 5
          px[j] = a <= 0 ? 0 : a >= 1 ? 255 : a * 255
        }
        ctx.putImageData(frame, 0, 0)
        if (k < 1) raf = requestAnimationFrame(step)
      }
      raf = requestAnimationFrame(step)
    }
    img.src = frostFrame
    return () => {
      dead = true
      cancelAnimationFrame(raf)
    }
  }, [start])
  return <canvas ref={ref} className="frost-layer frost-canvas" width={NOISE_W} height={NOISE_H} />
}

/** C1: frost creeps in from the screen edges on the cold Scan step. */
export function FrostCreep() {
  const mode = useMotionMode()
  const quality = useGame((s) => s.settings.quality)
  const autoTier = useRuntime((s) => s.autoTier)
  const high = resolveTier(quality, autoTier) === 'high'
  const ready = useAfterVeil(mode !== 'still')
  const [video, setVideo] = useState<'on' | 'fading' | 'off'>('on')
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (mode !== 'full' || !ready || !high) return
    const fade = window.setTimeout(() => setVideo('fading'), CREEP_VIDEO_FADE_AT_MS)
    const end = window.setTimeout(() => setVideo('off'), CREEP_VIDEO_END_MS)
    return () => {
      window.clearTimeout(fade)
      window.clearTimeout(end)
    }
  }, [mode, ready, high])
  useEffect(() => {
    if (mode !== 'fade' || !ready) return
    const id = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(id)
  }, [mode, ready])

  if (mode === 'still') return <div className="frost-ov" data-testid="frost-creep" data-mode="still" aria-hidden="true"><img className="frost-layer frost-still" src={frostFrame} alt="" /></div>
  if (mode === 'fade')
    return (
      <div className="frost-ov" data-testid="frost-creep" data-mode="fade" aria-hidden="true">
        <img className="frost-layer frost-still frost-fade-in" data-on={shown ? 'yes' : 'no'} src={frostFrame} alt="" />
      </div>
    )
  return (
    <div className="frost-ov" data-testid="frost-creep" data-mode="full" aria-hidden="true">
      {ready && high && video !== 'off' ? <Clip webm={creepWebm} mp4={creepMp4} className={video === 'fading' ? 'frost-layer frost-video fading' : 'frost-layer frost-video'} /> : null}
      <RevealCanvas start={ready} />
    </div>
  )
}

/** C4: the frost melts on cold Results. Closed ends thawed. Open ("Some residue stuck") holds at 55 percent. */
export function FrostThaw({ open }: { open: boolean }) {
  const mode = useMotionMode()
  const [go, setGo] = useState(false)
  const [phase, setPhase] = useState<'play' | 'done'>('play')
  const [live, setLive] = useState(false)
  const target = open ? thawHold : thawEnd

  useEffect(() => {
    if (mode === 'still') return
    const id = window.setTimeout(() => setGo(true), THAW_START_DELAY_MS)
    return () => window.clearTimeout(id)
  }, [mode])

  if (mode === 'still')
    return (
      <div className="frost-ov thaw" data-testid="frost-thaw" data-mode="still" data-open={open ? 'yes' : 'no'} aria-hidden="true">
        <img className="frost-layer frost-still frost-end" src={target} alt="" />
      </div>
    )
  const stillsOnly = mode === 'fade'
  // Fade: the frost frame crossfades to the right end still over 600 ms once the start delay has passed.
  const settled = phase === 'done' || (stillsOnly && go)
  const finish = () => setPhase('done')
  return (
    <div className="frost-ov thaw" data-testid="frost-thaw" data-mode={mode} data-open={open ? 'yes' : 'no'} data-phase={settled ? 'done' : 'play'} data-live={live ? 'yes' : 'no'} aria-hidden="true">
      <img className="frost-layer frost-still frost-start" src={frostFrame} alt="" />
      <img className="frost-layer frost-still frost-end" data-open={open ? 'yes' : 'no'} src={target} alt="" />
      {!stillsOnly && go ? (
        <Clip
          webm={thawWebm}
          mp4={thawMp4}
          className="frost-layer frost-video thaw-video"
          onFrame={() => setLive(true)}
          onTime={(v) => {
            if (open && v.duration > 0 && v.currentTime / v.duration >= THAW_HOLD_AT) {
              v.pause()
              finish()
            }
          }}
          onEnded={finish}
        />
      ) : null}
    </div>
  )
}

/** C3: a brief amber vignette on a wrong answer. Opacity only, nothing in still mode. */
export function CoreVignette() {
  const mode = useMotionMode()
  const fx = useRuntime((s) => s.coreFx)
  const [first] = useState(() => useRuntime.getState().coreFx?.n ?? 0)
  if (mode === 'still' || !fx || fx.ok || fx.n === first) return null
  return <div key={fx.n} className="core-vignette" data-mode={mode} aria-hidden="true" />
}
