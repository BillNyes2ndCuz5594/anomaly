// Navigation metadata only. Keep pack items in their lazy-loaded JSON chunks.
import { writeFileSync } from 'node:fs'
import { loadPacks } from './lib/content.mjs'

const manifest = loadPacks().map((p) => ({
  case: p.case,
  codex: p.codex ?? [],
  itemCount: p.items.length,
  reviewBenchmarks: [...new Set(p.items.filter((i) => i.pool === 'cold').map((i) => i.benchmark))].sort(),
}))
writeFileSync(new URL('../src/content/manifest.json', import.meta.url), `${JSON.stringify(manifest)}\n`)
console.log(`manifest: generated metadata for ${manifest.length} packs`)
