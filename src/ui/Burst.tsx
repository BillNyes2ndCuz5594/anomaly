import { useMemo, type CSSProperties } from 'react'
import { TIER_CONFIG, resolveTier } from '../state/quality'
import { useRuntime } from '../state/runtime'
import { useGame } from '../state/store'

const rnd = (seed: number) => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

/**
 * Light burst with a ring and a spray of sparks, centered on its parent (give the parent
 * position: relative). CSS only, no layout cost. Hidden for reduced motion by the stylesheet.
 * Spark count follows the quality tier, so Low gets a lighter version.
 */
export default function Burst({ color = '#37e8b4', spread = 190, delay = 0.38, big = true }: { color?: string; spread?: number; delay?: number; big?: boolean }) {
  const quality = useGame((s) => s.settings.quality)
  const autoTier = useRuntime((s) => s.autoTier)
  const tier = resolveTier(quality, autoTier)
  const count = Math.round((big ? 26 : 12) * Math.min(1, TIER_CONFIG[tier].particles / 420) * 0.9 + 6)
  const sparks = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2 + (rnd(i + 1) - 0.5) * 0.45
        const d = spread * (0.5 + rnd(i + 40) * 0.7)
        return { dx: Math.cos(a) * d, dy: Math.sin(a) * d * 0.8, s: 2.4 + rnd(i + 90) * 3.4, rot: Math.round(Math.atan2(Math.sin(a), Math.cos(a)) * 57.3), dl: rnd(i + 130) * 0.1 }
      }),
    [count, spread],
  )
  return (
    <span className={big ? 'burst' : 'burst small'} aria-hidden="true" style={{ color, '--bd': `${delay}s` } as CSSProperties}>
      <i className="burst-flash" />
      <i className="burst-ring" />
      <i className="burst-ring second" />
      {sparks.map((p, i) => (
        <i key={i} className="spark" style={{ '--dx': `${p.dx}px`, '--dy': `${p.dy}px`, '--s': `${p.s}px`, '--rot': `${p.rot}deg`, '--dl': `${p.dl}s` } as CSSProperties} />
      ))}
    </span>
  )
}
