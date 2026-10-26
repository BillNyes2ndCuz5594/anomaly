// Orphan-asset guard. Every file under public/art/ and src/assets/ must be
// referenced by file name somewhere in src/, index.html, teacher.html or the
// vite config. Missing folders count as empty. Exit 1 with a list on failure.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const TEXT_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|css|html|json|svg|md)$/i

export function walk(dir) {
  if (!existsSync(dir)) return []
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else out.push(p)
  }
  return out
}

/** Returns asset files (absolute paths) not referenced by name in any source. */
export function findOrphans({ assetDirs, sourcePaths }) {
  const assets = assetDirs.flatMap(walk)
  const sources = sourcePaths.flatMap((p) => (existsSync(p) && statSync(p).isDirectory() ? walk(p) : existsSync(p) ? [p] : []))
  const corpus = sources
    .filter((f) => TEXT_EXT.test(f))
    .map((f) => readFileSync(f, 'utf8'))
    .join('\n')
  return assets.filter((a) => !corpus.includes(basename(a)))
}

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))

export function run(rootDir = root) {
  const orphans = findOrphans({
    assetDirs: [join(rootDir, 'public/art'), join(rootDir, 'src/assets')],
    sourcePaths: [
      join(rootDir, 'src'),
      join(rootDir, 'index.html'),
      join(rootDir, 'teacher.html'),
      join(rootDir, 'vite.config.ts'),
    ],
  })
  return orphans.map((o) => relative(rootDir, o))
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const orphans = run()
  if (orphans.length) {
    console.error('check-assets: unreferenced asset files (add a reference or delete them):')
    for (const o of orphans) console.error('  - ' + o)
    process.exit(1)
  }
  console.log('check-assets: ok, no orphan assets')
}
