// Iteration helper for S14 (not committed). node scripts/s14-shot.mjs <lab-a|lab-c|briefing> [dsf] [vpw] [yaw]
import { setTimeout as sleep } from 'node:timers/promises'
import { freePort, launch, profilePage, startPreview, toCaseStep, waitRendered } from './lib/drive.mjs'
const [target = 'lab-a', dsfS = '2', vpw = '1500', yaw = ''] = process.argv.slice(2)
const port = await freePort()
const { proc, base } = await startPreview(port)
const browser = await launch()
const errors = []
try {
  const vp = { width: Number(vpw), height: Math.round((Number(vpw) * 9) / 16) }
  const page = await profilePage(browser, base, '?tier=high&still=1' + (yaw ? '&yaw=' + yaw : ''), vp, errors)
  await toCaseStep(page, target)
  await waitRendered(page, 3000)
  await page.setViewport({ ...vp, deviceScaleFactor: Number(dsfS) })
  await sleep(4000)
  let clip
  if (target === 'lab-a') {
    const o = await page.evaluate(() => JSON.parse(document.querySelector('canvas').dataset.organs || '{}'))
    const xs = Object.values(o).map((v) => v[0]), ys = Object.values(o).map((v) => v[1])
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2
    const top = Math.min(...ys), bot = Math.max(...ys)
    clip = { x: Math.max(0, cx - 230), y: Math.max(0, top - 170), width: 460, height: bot - top + 210 }
  }
  if (process.env.CLIP) { const [x, y, width, height] = process.env.CLIP.split(',').map(Number); clip = { x, y, width, height } }
  const out = `/tmp/s14/${target}-${vpw}-${yaw || 'd'}.png`
  await page.screenshot({ path: out, ...(clip ? { clip } : {}) })
  console.log('wrote', out, JSON.stringify(clip), errors.length ? errors : 'noerr')
} finally {
  await browser.close()
  proc.kill()
}
