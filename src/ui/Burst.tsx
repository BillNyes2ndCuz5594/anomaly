import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { STILL } from '../lib/flags'
import { TIER_CONFIG, resolveTier } from '../state/quality'
import { useRuntime } from '../state/runtime'
import { useGame } from '../state/store'

const rnd = (seed: number) => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

/**
 * Short, crisp burst: a thin ring plus thin light streaks and a few small dots, centered on its
 * parent (give the parent `position: relative; isolation: isolate`). It paints behind the parent's
 * text, fades out fully and then removes itself from the DOM. Not rendered at all for reduced
 * motion. Spark count follows the quality tier, so Low gets a lighter version.
 */
export default function Burst({ color = '#37e8b4', spread = 120, delay = 0.38, big = true }: { color?: string; spread?: number; delay?: number; big?: boolean }) {
  const quality = useGame((s) => s.settings.quality)
  const reduced = useGame((s) => s.settings.reducedMotion)
  const autoTier = useRuntime((s) => s.autoTier)
  const tier = resolveTier(quality, autoTier)
  const count = Math.round((big ? 22 : 10) * Math.min(1, TIER_CONFIG[tier].particles / 420) * 0.9 + 4)
  const [alive, setAlive] = useState(true)
  useEffect(() => {
    const t = window.setTimeout(() => setAlive(false), (delay + (STILL ? 20 : 1.1)) * 1000)
    return () => window.clearTimeout(t)
  }, [delay])
  const sparks = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2 + (rnd(i + 1) - 0.5) * 0.5
        const d = spread * (0.55 + rnd(i + 40) * 0.6)
        const dot = i % 3 === 2
        return { dx: Math.cos(a) * d, dy: Math.sin(a) * d * 0.8, len: dot ? 3 : 12 + rnd(i + 90) * 14, dot, rot: Math.round(Math.atan2(Math.sin(a), Math.cos(a)) * 57.3), dl: rnd(i + 130) * 0.08 }
      }),
    [count, spread],
  )
  if (reduced || !alive) return null
  return (
    <span className={big ? 'burst' : 'burst small'} aria-hidden="true" style={{ color, '--bd': `${delay}s` } as CSSProperties}>
      <i className="burst-flash" />
      <i className="burst-ring" />
      {sparks.map((p, i) => (
        <i key={i} className={p.dot ? 'spark dot' : 'spark'} style={{ '--dx': `${p.dx}px`, '--dy': `${p.dy}px`, '--len': `${p.len}px`, '--rot': `${p.rot}deg`, '--dl': `${p.dl}s` } as CSSProperties} />
      ))}
    </span>
  )
}
