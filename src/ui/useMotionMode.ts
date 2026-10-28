import { STILL } from '../lib/flags'
import { resolveTier } from '../state/quality'
import { useRuntime } from '../state/runtime'
import { useGame } from '../state/store'
import { motionMode, type MotionMode } from './motionMode'

/** full, fade, or still, from the quality tier, the reduced motion setting, and ?still=1. */
export function useMotionMode(): MotionMode {
  const reduced = useGame((s) => s.settings.reducedMotion)
  const quality = useGame((s) => s.settings.quality)
  const autoTier = useRuntime((s) => s.autoTier)
  return motionMode({ reduced, still: STILL, tier: resolveTier(quality, autoTier) })
}
