import { useEffect, useRef, useState } from 'react'
import { useMotionMode } from './useMotionMode'
import alertWebm from '../assets/video/residue-alert.webm?url'
import alertMp4 from '../assets/video/residue-alert.mp4?url'
import alertPoster from '../assets/video/residue-alert.webp?url'

/** The clip and its poster, shared with the QA gallery. */
export const ALERT_CLIP = { webm: alertWebm, mp4: alertMp4, poster: alertPoster }

/** Clip length in ms, used for the unmount safety timeout. */
const CLIP_MS = 3040

/**
 * H3: the residue canister flickers and cracks amber inside the cold case card when a review is due. The clip sits
 * on pure black, so it composites with mix-blend-mode: screen. It plays once per mount (one hub visit), then the
 * poster holds. Modes: full shows the poster, crossfades to the clip after its first decoded frame, then back to
 * the poster. fade shows the poster with an opacity fade. still shows the poster and never mounts a <video>.
 */
export default function ResidueAlert({ forceMode }: { forceMode?: 'full' | 'fade' | 'still' } = {}) {
  const live = useMotionMode()
  const mode = forceMode ?? live
  const ref = useRef<HTMLVideoElement | null>(null)
  const [shown, setShown] = useState(false)
  const [done, setDone] = useState(false)
  const playing = mode === 'full' && !done
  useEffect(() => {
    const v = ref.current
    if (!v) return
    let dead = false
    const frame = () => {
      if (!dead) setShown(true)
    }
    const onPlaying = () => {
      const rvfc = (v as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number }).requestVideoFrameCallback
      if (rvfc) rvfc.call(v, frame)
      else frame()
    }
    v.addEventListener('playing', onPlaying)
    // Safety net: if 'ended' never fires, drop the video after the full clip (3.04 s) plus 500 ms.
    const safety = window.setTimeout(() => {
      if (!dead) setDone(true)
    }, CLIP_MS + 500)
    v.play().catch(() => {
      // Autoplay refused: the poster stays as the fallback.
    })
    return () => {
      dead = true
      window.clearTimeout(safety)
      v.removeEventListener('playing', onPlaying)
      v.pause()
    }
  }, [playing])
  return (
    <span className="residue-alert" data-testid="residue-alert" data-mode={mode} data-live={shown && playing ? 'yes' : 'no'} aria-hidden="true">
      <img className="residue-poster" src={alertPoster} alt="" decoding="async" />
      {playing ? (
        <video ref={ref} className="residue-video" muted playsInline preload="auto" tabIndex={-1} onEnded={() => setDone(true)}>
          <source src={alertWebm} type="video/webm" />
          <source src={alertMp4} type="video/mp4" />
        </video>
      ) : null}
    </span>
  )
}
