// Run after generateSW so the check inspects the actual emitted manifest.
import { readFileSync, statSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { walk } from './check-assets.mjs'

export const BASELINE_PRECACHE_BYTES = 19146504
export const MAX_PRECACHE_GROWTH_BYTES = 3000000

export const REQUIRED_MODE_ASSETS = [
  'art/modes/containment-title.webp',
  'art/modes/containment-scene.webp',
  'art/modes/containment-magnet.webp',
  'art/modes/containment-freeze.webp',
  'art/modes/containment-filter.webp',
  'art/modes/containment-anomaly.webp',
  'art/modes/containment-charge.webp',
  'video/modes/containment-intro.webm',
  'video/modes/containment-intro.mp4',
  'art/modes/reactor-title.webp',
  'art/modes/reactor-scene.webp',
  'art/modes/reactor-core.webp',
  'art/modes/reactor-shield.webp',
  'art/modes/reactor-streak.webp',
  'art/modes/reactor-pulse.webp',
  'art/modes/reactor-stable.webp',
  'video/modes/reactor-intro.webm',
  'video/modes/reactor-intro.mp4',
]

export function checkPrecache(dist = resolve('dist'), options = {}) {
  const sw = readFileSync(resolve(dist, 'sw.js'), 'utf8')
  const manifest = sw.match(/\.?(?:precacheAndRoute)\((\[[\s\S]*?\])/)?.[1]
  if (!manifest) throw new Error('No precache manifest found in dist/sw.js')
  const urls = new Set([...manifest.matchAll(/(?:\burl|"url")\s*:\s*"([^"]+)"/g)].map((m) => m[1]))
  if (!urls.size) throw new Error('No precache entries found in dist/sw.js')
  const runtime = walk(dist).map((p) => relative(dist, p).split('\\').join('/'))
    .filter((p) => /\.(js|css|html|json|glb|webp|png|svg|woff2|mp4|webm)$/i.test(p))
    // Worker bootstrap files are fetched by the SW lifecycle, not the app.
    .filter((p) => p !== 'sw.js' && !/^workbox-[^/]+\.js$/.test(p))
  const missing = runtime.filter((p) => !urls.has(p))
  const totalBytes = [...urls].reduce((sum, p) => sum + statSync(resolve(dist, p)).size, 0)
  const res = {
    missing,
    count: urls.size,
    bytes: totalBytes,
  }
  if (options.checkModeAssets ?? options.requiredAssets) {
    const missingModeAssets = (options.requiredAssets ?? REQUIRED_MODE_ASSETS).filter((p) => !urls.has(p))
    const baseline = options.baselineBytes ?? BASELINE_PRECACHE_BYTES
    const maxGrowth = options.maxGrowthBytes ?? MAX_PRECACHE_GROWTH_BYTES
    const growth = totalBytes - baseline
    return {
      ...res,
      missingModeAssets,
      growth,
      growthExceeded: growth > maxGrowth,
    }
  }
  return res
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = checkPrecache(resolve('dist'), { checkModeAssets: true })
  console.log(`precache: ${result.count} files, ${result.bytes} bytes (growth: ${result.growth} bytes); missing: ${JSON.stringify(result.missing)}`)
  if (result.missing.length || result.missingModeAssets.length || result.growthExceeded) {
    if (result.missingModeAssets.length) {
      console.error(`missing required mode assets: ${JSON.stringify(result.missingModeAssets)}`)
    }
    if (result.growthExceeded) {
      console.error(`precache growth ${result.growth} exceeds budget ${MAX_PRECACHE_GROWTH_BYTES}`)
    }
    process.exitCode = 1
  }
}
