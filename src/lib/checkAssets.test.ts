import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
// @ts-expect-error plain mjs script without types
import { findOrphans, run } from '../../scripts/check-assets.mjs'

const dirs: string[] = []
function tmp() {
  const d = mkdtempSync(join(tmpdir(), 'an-assets-'))
  dirs.push(d)
  return d
}
afterEach(() => {
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true })
})

describe('check-assets', () => {
  it('passes when asset folders are missing', () => {
    const d = tmp()
    mkdirSync(join(d, 'src'))
    expect(run(d)).toEqual([])
  })

  it('catches an unreferenced fixture and accepts a referenced one', () => {
    const d = tmp()
    mkdirSync(join(d, 'src'), { recursive: true })
    mkdirSync(join(d, 'public/art/sub'), { recursive: true })
    writeFileSync(join(d, 'public/art/sub/used.png'), 'x')
    writeFileSync(join(d, 'public/art/orphan.png'), 'x')
    writeFileSync(join(d, 'src/a.ts'), "export const u = '/art/sub/used.png'\n")
    writeFileSync(join(d, 'index.html'), '<html></html>')
    const orphans = run(d)
    expect(orphans).toEqual([join('public', 'art', 'orphan.png')])
    expect(findOrphans({ assetDirs: [], sourcePaths: [] })).toEqual([])
  })

  it('the real repo has no orphan assets', () => {
    expect(run()).toEqual([])
  })
})
