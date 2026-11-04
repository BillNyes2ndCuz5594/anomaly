import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// teacher.html must never get the student SPA shell from the service worker, even with a query string.
describe('service worker navigate fallback', () => {
  it('denies teacher.html with or without a query', () => {
    const src = readFileSync(new URL('../../vite.config.ts', import.meta.url), 'utf8')
    const m = src.match(/navigateFallbackDenylist: \[\/(.+)\/\]/)
    expect(m).toBeTruthy()
    const re = new RegExp(m![1].replace(/\\\//g, '/'))
    for (const p of ['/anomaly/teacher.html', '/anomaly/teacher.html?mute=1']) expect(re.test(p)).toBe(true)
    expect(re.test('/anomaly/index.html')).toBe(false)
  })
})
