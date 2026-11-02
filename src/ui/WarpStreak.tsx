import { useEffect, useRef, useState } from 'react'
import warpWebm from '../assets/video/warp-streak.webm?url'
import warpMp4 from '../assets/video/warp-streak.mp4?url'
import warpPoster from '../assets/video/warp-streak.webp?url'

/** The 2 s clip is sped up so the whole tunnel lands inside the launch or warp veil (about 1.3 s). */
const RATE = 1.5

/**
 * Cyan streak tunnel on black, screen blended inside the veil fill. Mounted only for the full motion mode while a
 * launch or warp veil is up, so Low tier and still never create a video element. The poster shows first and the
 * video fades in after its first decoded frame, so there is no black flash.
 */
export default function WarpStreak() {
  const ref = useRef<HTMLVideoElement>(null)
  const [live, setLive] = useState(false)
  useEffect(() => {
    const v = ref.current
    if (!v) return
    v.defaultMuted = true
    v.muted = true
    v.playbackRate = RATE
    const on = () => setLive(true)
    v.addEventListener('playing', on, { once: true })
    v.play().catch(() => {
      // Autoplay refused: the poster stays, which is the static fallback.
    })
    return () => {
      v.removeEventListener('playing', on)
      v.pause()
    }
  }, [])
  return (
    <div className="warp-streak" aria-hidden="true">
      <img src={warpPoster} alt="" decoding="async" />
      <video ref={ref} className={live ? 'live' : undefined} muted playsInline preload="auto" aria-hidden="true">
        <source src={warpWebm} type="video/webm" />
        <source src={warpMp4} type="video/mp4" />
      </video>
    </div>
  )
}

/**
 * Full mode only: a hidden, paused copy of the warp clip mounted before any veil starts, so the browser has fetched
 * and decoded it by the first launch and the veil plays streaks instead of only the poster. fade and still never
 * render this, so they still create no video element.
 */
export function WarpPreload() {
  return (
    <video className="warp-preload" muted playsInline preload="auto" tabIndex={-1} aria-hidden="true" style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}>
      <source src={warpWebm} type="video/webm" />
      <source src={warpMp4} type="video/mp4" />
    </video>
  )
}
