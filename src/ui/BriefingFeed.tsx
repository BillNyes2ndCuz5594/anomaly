import { useEffect, useRef, useState } from 'react'
import { useMotionMode } from './useMotionMode'
import feedWebm from '../assets/video/briefing-feed.webm?url'
import feedMp4 from '../assets/video/briefing-feed.mp4?url'
import feedPoster from '../assets/video/briefing-feed.webp?url'
import spillWebm from '../assets/video/spill-04-1.webm?url'
import spillMp4 from '../assets/video/spill-04-1.mp4?url'
import spillPoster from '../assets/video/spill-04-1.webp?url'

export type BriefingFeedVariant = 'default' | 'spill-04-1'

/**
 * B1: the incoming transmission monitor in the Briefing panel. The clip is a one-shot on pure black, so it
 * composites with mix-blend-mode: screen. full shows the poster, crossfades to the clip after its first decoded
 * frame, then holds the poster (the clean last frame). fade and still show the poster only and never mount a
 * <video> element.
 */
export default function BriefingFeed({ variant = 'default' }: { variant?: BriefingFeedVariant }) {
  const mode = useMotionMode()
  const ref = useRef<HTMLVideoElement | null>(null)
  const [live, setLive] = useState(false)
  const [ended, setEnded] = useState(false)
  const [done, setDone] = useState(false)
  const playing = mode === 'full'

  const isSpill = variant === 'spill-04-1'
  const webm = isSpill ? spillWebm : feedWebm
  const mp4 = isSpill ? spillMp4 : feedMp4
  const poster = isSpill ? spillPoster : feedPoster

  useEffect(() => {
    if (!ended) return
    const timer = setTimeout(() => setDone(true), 220)
    return () => clearTimeout(timer)
  }, [ended])
  useEffect(() => {
    const v = ref.current
    if (!v) return
    let dead = false
    const shown = () => {
      if (!dead) setLive(true)
    }
    const onPlaying = () => {
      const rvfc = (v as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number }).requestVideoFrameCallback
      if (rvfc) rvfc.call(v, shown)
      else shown()
    }
    v.addEventListener('playing', onPlaying)
    v.play().catch(() => {
      // Autoplay refused: the poster stays as the fallback.
    })
    return () => {
      dead = true
      v.removeEventListener('playing', onPlaying)
      v.pause()
    }
  }, [playing])
  return (
    <div
      className={`briefing-feed${isSpill ? ' briefing-feed-spill' : ''}`}
      data-variant={variant}
      data-mode={mode}
      data-testid="briefing-feed"
      aria-hidden="true"
    >
      <img className="feed-poster" src={poster} alt="" decoding="async" />
      {playing && !done ? (
        <video
          ref={ref}
          className="feed-video"
          data-live={live ? 'yes' : 'no'}
          data-ended={ended ? 'yes' : 'no'}
          muted
          playsInline
          preload="auto"
          tabIndex={-1}
          onEnded={() => setEnded(true)}
        >
          <source src={webm} type="video/webm" />
          <source src={mp4} type="video/mp4" />
        </video>
      ) : null}
      <span className="feed-tag mono">INCOMING</span>
    </div>
  )
}
