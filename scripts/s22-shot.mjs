// Iteration helper for S22 (Low tier models). Needs a fresh `npm run build` (vite preview). Writes /tmp/s22/<name>.png.
//   node scripts/s22-shot.mjs laba [w] [h] [name]        Lab A hologram at ?tier=low (still)
//   node scripts/s22-shot.mjs side [w] [h] [name]        Lab A turned side-on (HY env radians, default 1.45; patches dist only)
//   node scripts/s22-shot.mjs models id1,id2 [w] [h] [name]   visuals gallery, one specimen per panel
// TIER env overrides the tier (default low).
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'
import { freePort, launch, profilePage, startPreview, toCaseStep } from './lib/drive.mjs'
const [mode = 'laba', a1, a2, a3, a4] = process.argv.slice(2)
const ids = mode === 'models' ? a1 : ''
const [wS, hS, name] = mode === 'models' ? [a2 || '1920', a3 || '1080', a4] : [a1 || '1920', a2 || '1080', a3]
mkdirSync('/tmp/s22', { recursive: true })
const port = await freePort()
const { proc, base } = await startPreview(port)
const browser = await launch()
const errors = []
try {
  const vp = { width: Number(wS), height: Number(hS) }
  const tier = process.env.TIER || 'low'
  if (mode === 'models') {
    const page = await browser.newPage()
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    page.on('pageerror', (e) => errors.push(e.message))
    await page.setViewport({ ...vp, deviceScaleFactor: Number(process.env.DSF || 1) })
    await page.goto(`${base}?tier=${tier}&still=1&ids=${ids}#/visuals/models`, { waitUntil: 'load' })
    await sleep(7000)
    const out = `/tmp/s22/${name || ids.replace(/,/g, '_') + '-' + tier}-${wS}.png`
    await page.screenshot({ path: out })
    console.log('wrote', out, errors.length ? errors : 'noerr')
  } else {
    const side = mode === 'side'
    if (side) {
      // Patch the BUILT chunk (dist only, never src) so the still pose yaw is read from ?hy=<radians>.
      const dir = new URL('../dist/assets/', import.meta.url).pathname
      const f = readdirSync(dir).find((n) => /^HumanFigure-.*\.js$/.test(n))
      const src = readFileSync(dir + f, 'utf8')
      if (src.includes('.rotation.y=.3;')) writeFileSync(dir + f, src.replace('.rotation.y=.3;', ".rotation.y=Number(new URLSearchParams(location.search).get('hy')||.3);"))
    }
    const pg = await profilePage(browser, base, `?tier=${tier}&still=1` + (side ? '&hy=' + (process.env.HY || 1.45) : ''), vp, errors)
    await toCaseStep(pg, 'lab-a')
    await sleep(4500)
    await pg.setViewport({ ...vp, deviceScaleFactor: Number(process.env.DSF || 1) })
    await sleep(2500)
    const out = `/tmp/s22/${name || mode + '-' + tier}-${wS}.png`
    await pg.screenshot({ path: out })
    const an = await pg.evaluate(() => window.__anomaly)
    console.log('wrote', out, 'calls', an?.calls, 'tris', an?.tris, errors.length ? errors : 'noerr')
  }
} finally {
  await browser.close()
  proc.kill()
}
