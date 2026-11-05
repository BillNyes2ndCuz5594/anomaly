import { useEffect, useRef, useState } from 'react'
import closedMp4 from '../assets/video/case-closed.mp4?url'
import closedWebm from '../assets/video/case-closed.webm?url'
import closedPoster from '../assets/video/case-closed.webp?url'
import './caseClips.css'
import { useMotionMode } from './useMotionMode'

export default function CaseClosedClip() {
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
    v.play().catch(() => {})
    return () => {
      dead = true
      v.removeEventListener('playing', onPlaying)
      v.pause()
    }
  }, [playing])

  return (
    <div className="case-closed-clip" data-mode={mode} data-testid="case-closed-clip" aria-hidden="true">
      <img className="case-closed-poster" src={closedPoster} alt="" decoding="async" />
      {playing && !done ? (
        <video
          ref={ref}
          className="case-closed-video"
          data-live={live ? 'yes' : 'no'}
          data-ended={ended ? 'yes' : 'no'}
          muted
          playsInline
          preload="auto"
          tabIndex={-1}
          onEnded={() => setEnded(true)}
        >
          <source src={closedWebm} type="video/webm" />
          <source src={closedMp4} type="video/mp4" />
        </video>
      ) : null}
    </div>
  )
}
