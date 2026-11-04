// Run after generateSW so the check inspects the actual emitted manifest.
import { readFileSync, statSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { walk } from './check-assets.mjs'

export function checkPrecache(dist = resolve('dist')) {
  const sw = readFileSync(resolve(dist, 'sw.js'), 'utf8')
  const manifest = sw.match(/\.?(?:precacheAndRoute)\((\[[\s\S]*?\])/)?.[1]
  if (!manifest) throw new Error('No precache manifest found in dist/sw.js')
  const urls = new Set([...manifest.matchAll(/(?:\burl|"url")\s*:\s*"([^"]+)"/g)].map((m) => m[1]))
  if (!urls.size) throw new Error('No precache entries found in dist/sw.js')
  const runtime = walk(dist).map((p) => relative(dist, p).split('\\').join('/'))
    .filter((p) => /\.(js|css|html|json|glb|webp|png|svg|woff2|mp4|webm)$/i.test(p))
    // Worker bootstrap files are fetched by the SW lifecycle, not the app.
    .filter((p) => p !== 'sw.js' && !/^workbox-[^/]+\.js$/.test(p))
  return {
    missing: runtime.filter((p) => !urls.has(p)),
    count: urls.size,
    bytes: [...urls].reduce((sum, p) => sum + statSync(resolve(dist, p)).size, 0),
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = checkPrecache()
  console.log(`precache: ${result.count} files, ${result.bytes} bytes; missing: ${JSON.stringify(result.missing)}`)
  if (result.missing.length) process.exitCode = 1
}
