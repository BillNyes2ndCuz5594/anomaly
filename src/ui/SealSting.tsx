import { useEffect, useRef, useState } from 'react'
import { useMotionMode } from './useMotionMode'
import stingWebm from '../assets/video/seal-sting.webm?url'
import stingMp4 from '../assets/video/seal-sting.mp4?url'
import stingPoster from '../assets/video/seal-sting.webp?url'

/**
 * Holographic seal behind a verdict block (D2). The clip sits on pure black, so it composites with
 * mix-blend-mode: screen. Open verdicts get an amber filter in CSS. Modes: full shows the poster, then
 * crossfades to the one-shot clip after its first decoded frame. fade only fades the poster in. still shows
 * the poster and never mounts a <video> element.
 */
export default function SealSting({ open }: { open: boolean }) {
  const mode = useMotionMode()
  const ref = useRef<HTMLVideoElement | null>(null)
  const [live, setLive] = useState(false)
  const [ended, setEnded] = useState(false)
  const [done, setDone] = useState(false)
  const playing = mode === 'full'

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
    <div className="seal-sting" data-mode={mode} data-open={open ? 'yes' : 'no'} aria-hidden="true">
      <img className="seal-poster" src={stingPoster} alt="" decoding="async" />
      {playing && !done ? (
        <video
          ref={ref}
          className="seal-video"
          data-live={live ? 'yes' : 'no'}
          data-ended={ended ? 'yes' : 'no'}
          muted
          playsInline
          preload="auto"
          tabIndex={-1}
          onEnded={() => setEnded(true)}
        >
          <source src={stingWebm} type="video/webm" />
          <source src={stingMp4} type="video/mp4" />
        </video>
      ) : null}
    </div>
  )
}
