import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runInNewContext } from 'node:vm'
import { expect, it } from 'vitest'
// @ts-expect-error plain mjs script without types
import { checkPrecache } from '../../scripts/check-precache.mjs'

it('reports runtime files absent from the emitted manifest', () => {
  const dir = mkdtempSync(join(tmpdir(), 'an-precache-'))
  try {
    mkdirSync(join(dir, 'assets'))
    const files = 'js css html json glb webp png svg woff2 mp4 webm'.split(' ').map((ext) => `assets/file.${ext}`)
    for (const file of [...files, 'og-image.jpg', 'workbox-abc.js']) writeFileSync(join(dir, file), 'x')
    writeFileSync(join(dir, 'sw.js'), 'precacheAndRoute([{url:"assets/file.js",revision:null}])')
    expect(checkPrecache(dir).missing).toEqual(files.slice(1).sort())
    writeFileSync(join(dir, 'sw.js'), `precacheAndRoute(${JSON.stringify(files.map((url) => ({ url, revision: null })))})`)
    expect(checkPrecache(dir)).toEqual({ missing: [], count: files.length, bytes: files.length })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

it('serves video byte ranges from a revisioned precache without network access', async () => {
  let listener: (event: unknown) => void = () => {}
  const scope = 'https://example.test/anomaly/'
  runInNewContext(readFileSync('public/video-range.js', 'utf8'), {
    self: { location: { origin: 'https://example.test' }, registration: { scope },
      addEventListener: (_: string, handler: typeof listener) => { listener = handler } },
    URL, Response, Headers,
    caches: {
      keys: async () => [`workbox-precache-v2-${scope}`],
      match: async (_: string, options: { ignoreSearch: boolean }) => {
        expect(options.ignoreSearch).toBe(true)
        return new Response('0123456789', { headers: { 'Content-Type': 'video/mp4' } })
      },
    },
    fetch: () => { throw new Error('Unexpected network access') },
  })
  for (const [range, status, body, contentRange] of [
    ['bytes=0-1', 206, '01', 'bytes 0-1/10'],
    ['bytes=3-', 206, '3456789', 'bytes 3-9/10'],
    ['bytes=-3', 206, '789', 'bytes 7-9/10'],
    ['bytes=8-99', 206, '89', 'bytes 8-9/10'],
    ['bytes=20-', 416, '', 'bytes */10'],
    ['bytes=-0', 416, '', 'bytes */10'],
    ['bytes=0-1,3-4', 416, '', 'bytes */10'],
  ] as const) {
    let result: Promise<Response> | undefined
    listener({ request: new Request(`${scope}assets/loop.mp4`, { headers: { Range: range } }),
      respondWith: (value: Promise<Response>) => { result = value }, stopImmediatePropagation() {} })
    const response = await result!
    expect(response.status).toBe(status)
    expect(response.headers.get('Content-Range')).toBe(contentRange)
    expect(await response.text()).toBe(body)
  }
})
