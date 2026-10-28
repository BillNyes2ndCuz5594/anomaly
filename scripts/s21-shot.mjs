// Iteration helper for S21. node scripts/s15-shot.mjs <ids|hub> [w] [h] [dsf] [tag]
// Needs a fresh `npm run build` (uses vite preview). Writes /tmp/s21/<tag>.png.
import { mkdirSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'
import { freePort, launch, profilePage, startPreview, toCaseStep } from './lib/drive.mjs'
const [target = 'L142-02', wS = '1920', hS = '1080', dsfS = '1', tag = ''] = process.argv.slice(2)
mkdirSync('/tmp/s21', { recursive: true })
const port = await freePort()
const { proc, base } = await startPreview(port)
const browser = await launch()
const errors = []
try {
  const vp = { width: Number(wS), height: Number(hS) }
  const qs = '?tier=' + (process.env.TIER || 'high') + '&still=1' + (target === 'hub' ? '' : '&qaitems=' + target)
  const page = await profilePage(browser, base, qs, vp, errors)
  if (target !== 'hub') {
    await toCaseStep(page, 'items')
    await sleep(5500)
  } else await sleep(4500)
  await page.setViewport({ ...vp, deviceScaleFactor: Number(dsfS) })
  await sleep(2500)
  const out = `/tmp/s21/${target}-${wS}${tag}.png`
  const clip = process.env.CLIP ? Object.fromEntries(process.env.CLIP.split(',').map((v, i) => [['x', 'y', 'width', 'height'][i], Number(v)])) : undefined
  await page.screenshot({ path: out, ...(clip ? { clip } : {}) })
  const a = await page.evaluate(() => window.__anomaly)
  console.log('wrote', out, 'calls', a?.calls, errors.length ? errors : 'noerr')
} finally {
  await browser.close()
  proc.kill()
}
