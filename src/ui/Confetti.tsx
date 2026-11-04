import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { resolveTier, TIER_CONFIG } from '../state/quality'
import { useRuntime } from '../state/runtime'
import { useGame } from '../state/store'
import { useMotionMode } from './useMotionMode'

const palette = ['#3ee6ff', '#ffb547', '#37e8b4', '#ffffff']
const rnd = (seed: number) => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

export default function Confetti() {
  const quality = useGame((s) => s.settings.quality)
  const reduced = useGame((s) => s.settings.reducedMotion)
  const autoTier = useRuntime((s) => s.autoTier)
  const motion = useMotionMode()
  const [alive, setAlive] = useState(true)
  // Capture the launch tier once so Auto changes cannot restart the celebration.
  const [count] = useState(() => TIER_CONFIG[resolveTier(quality, autoTier)].particles < 220 ? 14 : 28)
  const pieces = useMemo(() => Array.from({ length: count }, (_, i) => ({
    '--cx': `${(rnd(i + 1) - 0.5) * 90}vw`,
    '--cy': `${65 + rnd(i + 40) * 30}vh`,
    '--cr': `${(rnd(i + 80) - 0.5) * 540}deg`,
    '--cd': `${1.6 + rnd(i + 120) * 0.6}s`,
    '--cl': `${0.5 + rnd(i + 160) * 0.25}s`,
    '--cc': palette[i % palette.length],
  } as CSSProperties)), [count])
  useEffect(() => {
    const timer = window.setTimeout(() => setAlive(false), 3000)
    return () => window.clearTimeout(timer)
  }, [])
  if (!alive || reduced || motion !== 'full') return null
  return (
    <div className="case-confetti" aria-hidden="true">
      {pieces.map((style, i) => <i key={i} className={i % 3 === 0 ? 'confetti-piece dot' : 'confetti-piece'} style={style} />)}
    </div>
  )
}
