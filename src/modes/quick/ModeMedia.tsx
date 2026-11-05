import { useState } from 'react'
import type { MotionMode } from '../../ui/motionMode'
import './modeMedia.css'

export interface ModeMediaProps {
  titlePoster: string
  introWebm?: string
  introMp4?: string
  motion: MotionMode
  still?: boolean
  skipIntro?: boolean
  onIntroEnd?: () => void
  className?: string
}

// oxlint-disable-next-line react/only-export-components -- helper export for tests
export function canPlayModeVideo(motion: MotionMode, still: boolean): boolean {
  return motion === 'full' && !still
}

export default function ModeMedia({
  titlePoster,
  introWebm,
  introMp4,
  motion,
  still = false,
  skipIntro = false,
  onIntroEnd,
  className = 'mode-media',
}: ModeMediaProps) {
  const [skipped, setSkipped] = useState(false)
  const [failed, setFailed] = useState(false)
  const [failedSources, setFailedSources] = useState<Record<string, boolean>>({})

  const totalSources = (introWebm ? 1 : 0) + (introMp4 ? 1 : 0)
  const failedCount = Object.keys(failedSources).length
  const allSourcesExhausted = totalSources > 0 && failedCount >= totalSources

  const showVideo = !skipIntro && !skipped && !failed && !allSourcesExhausted && canPlayModeVideo(motion, still) && totalSources > 0

  const handleSkip = () => {
    setSkipped(true)
    onIntroEnd?.()
  }

  const handleEnded = () => {
    setSkipped(true)
    onIntroEnd?.()
  }

  const handleError = () => {
    setFailed(true)
    onIntroEnd?.()
  }

  const handleSourceError = (src: string) => {
    setFailedSources((prev) => {
      const next = { ...prev, [src]: true }
      if (totalSources > 0 && Object.keys(next).length >= totalSources) {
        onIntroEnd?.()
      }
      return next
    })
  }

  return (
    <div className={className} data-testid="mode-media">
      {showVideo ? (
        <div className="mode-media-video-wrap">
          <video
            autoPlay
            muted
            playsInline
            preload="auto"
            poster={titlePoster}
            aria-hidden="true"
            onEnded={handleEnded}
            onError={handleError}
          >
            {introWebm && (
              <source src={introWebm} type="video/webm" onError={() => handleSourceError(introWebm)} />
            )}
            {introMp4 && (
              <source src={introMp4} type="video/mp4" onError={() => handleSourceError(introMp4)} />
            )}
          </video>
          <button
            type="button"
            className="btn mode-media-skip"
            onClick={handleSkip}
            aria-label="Skip intro"
          >
            Skip
          </button>
        </div>
      ) : (
        <img
          src={titlePoster}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="mode-media-poster"
        />
      )}
    </div>
  )
}
