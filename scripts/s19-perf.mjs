// S19 measurement: per tier calls/triangles/fps on hub and lab A, plus Auto under CPU throttle at dsf 2.
import { setTimeout as sleep } from 'node:timers/promises'
import { freePort, launch, profilePage, startPreview, toCaseStep } from './lib/drive.mjs'
const port = await freePort()
const { proc, base } = await startPreview(port)
const browser = await launch()
const errors = []
const out = []
try {
  const vp = { width: 1366, height: 768 }
  for (const mode of ['low', 'medium', 'high', 'auto']) {
    for (const target of ['hub', 'lab-a']) {
      const page = await profilePage(browser, base, mode === 'auto' ? '?x=1' : `?tier=${mode}`, vp, errors)
      await page.setViewport({ ...vp, deviceScaleFactor: 2 })
      const cdp = await page.createCDPSession()
      if (mode === 'auto') await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
      if (target !== 'hub') await toCaseStep(page, target)
      await sleep(2500)
      const samples = []
      const secs = mode === 'auto' ? 14 : 6
      for (let i = 0; i < secs * 2; i++) { await sleep(500); samples.push((await page.evaluate(() => window.__anomaly)).fps) }
      const a = await page.evaluate(() => window.__anomaly)
      const canvas = await page.evaluate(() => { const c = document.querySelector('canvas'); return c ? c.width + 'x' + c.height : '' })
      const avg = Math.round((samples.reduce((x, y) => x + y, 0) / samples.length) * 10) / 10
      const row = { mode, target, tier: a.tier, calls: a.calls, tris: a.triangles, fpsAvg: avg, canvas }
      console.log(JSON.stringify(row)); out.push(row)
      await page.close()
    }
  }
  console.log('errors', errors.length ? errors : 'none')
} finally { await browser.close(); proc.kill() }
