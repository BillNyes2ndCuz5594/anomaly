import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import { beforeAll, describe, expect, it } from 'vitest'
// @ts-expect-error plain mjs script without types
import { BASELINE_PRECACHE_BYTES, checkPrecache, MAX_PRECACHE_GROWTH_BYTES, REQUIRED_MODE_ASSETS } from '../../scripts/check-precache.mjs'

describe('checkPrecache and offline verification', () => {
  beforeAll(() => {
    if (!existsSync(resolve('dist/sw.js'))) {
      execFileSync('node_modules/vite/bin/vite.js', ['build'], { stdio: 'pipe' })
    }
  }, 30000)
  it('reports missing runtime files and required mode assets', () => {
    const dir = mkdtempSync(join(tmpdir(), 'an-precache-'))
    try {
      mkdirSync(join(dir, 'assets'))
      const files = ['assets/app.js', 'assets/style.css']
      for (const file of files) writeFileSync(join(dir, file), 'content')
      writeFileSync(join(dir, 'sw.js'), `precacheAndRoute(${JSON.stringify(files.map((url) => ({ url, revision: null })))})`)

      const res = checkPrecache(dir, {
        requiredAssets: ['art/modes/containment-title.webp'],
        baselineBytes: 10,
        maxGrowthBytes: 100,
      })
      expect(res.missing).toEqual([])
      expect(res.missingModeAssets).toEqual(['art/modes/containment-title.webp'])
      expect(res.growthExceeded).toBe(false)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('detects when precache growth exceeds budget', () => {
    const dir = mkdtempSync(join(tmpdir(), 'an-precache-growth-'))
    try {
      writeFileSync(join(dir, 'big.js'), 'a'.repeat(200))
      writeFileSync(join(dir, 'sw.js'), 'precacheAndRoute([{url:"big.js",revision:null}])')

      const res = checkPrecache(dir, {
        requiredAssets: [],
        baselineBytes: 50,
        maxGrowthBytes: 100,
      })
      expect(res.bytes).toBe(200)
      expect(res.growth).toBe(150)
      expect(res.growthExceeded).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('contains all 18 mode assets and precache growth is under budget in actual build', () => {
    const res = checkPrecache(undefined, { checkModeAssets: true })
    expect(res.missing).toEqual([])
    expect(res.missingModeAssets).toEqual([])
    expect(REQUIRED_MODE_ASSETS).toHaveLength(18)
    for (const asset of REQUIRED_MODE_ASSETS) {
      expect(res.missingModeAssets).not.toContain(asset)
    }
    expect(res.growth).toBeLessThanOrEqual(MAX_PRECACHE_GROWTH_BYTES)
    expect(res.growthExceeded).toBe(false)
    expect(BASELINE_PRECACHE_BYTES).toBe(19146504)
  })

  it('serves video byte ranges with 206 Partial Content without network access', async () => {
    let listener: (event: unknown) => void = () => {}
    const scope = 'https://example.test/anomaly/'
    runInNewContext(readFileSync('public/video-range.js', 'utf8'), {
      self: {
        location: { origin: 'https://example.test' },
        registration: { scope },
        addEventListener: (_: string, handler: typeof listener) => { listener = handler },
      },
      URL,
      Response,
      Headers,
      caches: {
        keys: async () => [`workbox-precache-v2-${scope}`],
        match: async (_: string, options: { ignoreSearch: boolean }) => {
          expect(options.ignoreSearch).toBe(true)
          return new Response('0123456789', { headers: { 'Content-Type': 'video/mp4' } })
        },
      },
      fetch: () => { throw new Error('Unexpected network access') },
    })

    const requests = [
      ['bytes=0-1', 206, '01', 'bytes 0-1/10'],
      ['bytes=3-', 206, '3456789', 'bytes 3-9/10'],
      ['bytes=-3', 206, '789', 'bytes 7-9/10'],
      ['bytes=8-99', 206, '89', 'bytes 8-9/10'],
      ['bytes=20-', 416, '', 'bytes */10'],
      ['bytes=-0', 416, '', 'bytes */10'],
      ['bytes=0-1,3-4', 416, '', 'bytes */10'],
    ] as const

    for (const [range, status, body, contentRange] of requests) {
      let result: Promise<Response> | undefined
      listener({
        request: new Request(`${scope}video/modes/containment-intro.mp4`, { headers: { Range: range } }),
        respondWith: (value: Promise<Response>) => { result = value },
        stopImmediatePropagation() {},
      })
      const response = await result!
      expect(response.status).toBe(status)
      expect(response.headers.get('Content-Range')).toBe(contentRange)
      expect(await response.text()).toBe(body)
    }
  })
})
