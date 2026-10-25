import { resolveTier } from '../state/quality'
import { useRuntime } from '../state/runtime'
import { useGame } from '../state/store'

export function isDebugUrl(): boolean {
  return new URLSearchParams(window.location.search).get('debug') === '1'
}

/** FPS, backend and tier. Shown when enabled in Settings or when the URL has ?debug=1. */
export default function FpsReadout() {
  const show = useGame((s) => s.settings.showFps)
  const quality = useGame((s) => s.settings.quality)
  const { fps, backend, autoTier } = useRuntime()
  if (!show && !isDebugUrl()) return null
  const tier = resolveTier(quality, autoTier)
  return (
    <div className="fps-readout" data-testid="fps-readout" role="status" aria-label="Performance readout">
      <span>{fps.toFixed(0)} FPS</span>
      <span>{backend.toUpperCase()}</span>
      <span>
        {tier.toUpperCase()}
        {quality === 'auto' ? ' (AUTO)' : ''}
      </span>
    </div>
  )
}
