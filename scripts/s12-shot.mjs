// S12 iteration helper: shoots evidence items at given viewports. Needs `npm run build` first.
// Usage: node scripts/s12-shot.mjs --vp=780x360x2,1920x1080x1 --ids=L142-02,L315-03 [--tier=high] [--out=/tmp/s12]
import { mkdirSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'
import { freePort, launch, profilePage, startPreview, toCaseStep, waitRendered } from './lib/drive.mjs'

const args = process.argv.slice(2)
const opt = (k, d) => (args.find((a) => a.startsWith(`--${k}=`)) ?? `--${k}=${d}`).split('=')[1]
const vps = opt('vp', '780x360x2').split(',').map((s) => { const [w, h, d] = s.split('x').map(Number); return { width: w, height: h, dsf: d || 1 } })
const ids = opt('ids', 'L142-02').split(',')
const OUT = opt('out', '/tmp/s12')
const tier = opt('tier', 'low')
mkdirSync(OUT, { recursive: true })
const port = await freePort()
const { proc, base } = await startPreview(port)
const browser = await launch()
const errors = []
try {
  for (const vp of vps) {
    const touch = vp.width < 1000
    const page = await profilePage(browser, base, `?tier=${tier}&qaitems=${ids.join(',')}&still=1`, { width: vp.width, height: vp.height, isMobile: touch, hasTouch: touch }, errors)
    await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: vp.dsf, isMobile: touch, hasTouch: touch })
    await toCaseStep(page, 'items')
    for (const id of ids) {
      await sleep(5000)
      const m = await page.evaluate(() => {
        const c = document.querySelector('[data-testid="item-visual"] canvas')
        if (!c) return null
        const r = c.getBoundingClientRect()
        const vis = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)) * Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0))
        return { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), inside: +(vis / (r.width * r.height)).toFixed(2), calls: window.__anomaly?.calls }
      })
      console.log(vp.width, vp.height, id, JSON.stringify(m))
      await page.screenshot({ path: `${OUT}/${id}-${vp.width}x${vp.height}.png` })
      await page.evaluate(() => document.querySelector('[data-testid="option-0"]')?.click())
      await page.evaluate(() => document.querySelector('[data-testid="lock-in"]')?.click())
      await sleep(400)
      await page.evaluate(() => document.querySelector('[data-testid="next-item"]')?.click())
    }
    await page.close()
  }
} finally {
  await browser.close()
  proc.kill()
}
if (errors.length) console.log('ERRORS', errors.join('\n'))
