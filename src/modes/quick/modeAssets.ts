import { existsSync } from 'node:fs'

/**
 * Literal references to mode assets for public URL resolution.
 * Referenced by exact filename so check-assets.mjs detects them.
 */

const base = import.meta.env.BASE_URL.replace(/\/$/, '')
export const resolvePublicAsset = (path: string): string => `${base}/${path.replace(/^\//, '')}`

export const CONTAINMENT_ASSETS = {
  title: resolvePublicAsset('art/modes/containment-title.webp'),
  scene: resolvePublicAsset('art/modes/containment-scene.webp'),
  magnet: resolvePublicAsset('art/modes/containment-magnet.webp'),
  freeze: resolvePublicAsset('art/modes/containment-freeze.webp'),
  filter: resolvePublicAsset('art/modes/containment-filter.webp'),
  anomaly: resolvePublicAsset('art/modes/containment-anomaly.webp'),
  charge: resolvePublicAsset('art/modes/containment-charge.webp'),
  introWebm: resolvePublicAsset('video/modes/containment-intro.webm'),
  introMp4: resolvePublicAsset('video/modes/containment-intro.mp4'),
} as const

export const REACTOR_ASSETS = {
  title: resolvePublicAsset('art/modes/reactor-title.webp'),
  scene: resolvePublicAsset('art/modes/reactor-scene.webp'),
  core: resolvePublicAsset('art/modes/reactor-core.webp'),
  shield: resolvePublicAsset('art/modes/reactor-shield.webp'),
  streak: resolvePublicAsset('art/modes/reactor-streak.webp'),
  pulse: resolvePublicAsset('art/modes/reactor-pulse.webp'),
  stable: resolvePublicAsset('art/modes/reactor-stable.webp'),
  introWebm: resolvePublicAsset('video/modes/reactor-intro.webm'),
  introMp4: resolvePublicAsset('video/modes/reactor-intro.mp4'),
} as const

/** Checks if a mode asset relative to public/ exists on disk (used in tests/guards). */
export function checkModeAssetExists(relativePath: string): boolean {
  try {
    return existsSync(new URL(`../../../public/${relativePath.replace(/^\//, '')}`, import.meta.url))
  } catch {
    return false
  }
}
