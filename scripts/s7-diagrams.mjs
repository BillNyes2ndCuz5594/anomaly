// Render check for the S7 scene diagrams. Needs a fresh `npm run build` (vite preview).
//   node scripts/s7-diagrams.mjs [shot.png]
// Opens the art check page (#/visuals?tier=high&still=1) at 1366x768 and 1920x1080, at text sizes 0 and 2,
// runs svgReport (every label inside its viewBox, no label overlap, label size at least 14 px times the text
// scale, no letterboxing) and counts the scene ids on the page. Exits 1 on any problem or console error.
// With a path, also saves the full art page at 1920 (Normal text) there.
import { statSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'
import { freePort, launch, profilePage, setTextSize, startPreview, svgReport } from './lib/drive.mjs'

const shotPath = process.argv[2]
const QS = '?tier=high&still=1'
const port = await freePort()
const { proc, base } = await startPreview(port)
const browser = await launch()
let failed = false
try {
  for (const vp of [
    { width: 1366, height: 768 },
    { width: 1920, height: 1080 },
  ]) {
    const errors = []
    const page = await profilePage(browser, base, QS, vp, errors)
    for (const t of [0, 2]) {
      await setTextSize(page, t)
      await page.goto(base + QS + '#/visuals', { waitUntil: 'load' })
      await page.waitForSelector('[data-testid="visuals-scenes"] svg')
      await sleep(1200)
      const r = await svgReport(page)
      const ids = await page.$$eval('[data-testid="visuals-scenes"] svg.scene-svg', (els) => [...new Set(els.map((e) => e.getAttribute('data-scene')))])
      const problems = [...r.outside.map((x) => `outside ${x}`), ...r.overlaps.map((x) => `overlap ${x}`), ...r.small.map((x) => `small ${x}`), ...r.letterboxed.map((x) => `letterbox ${x}`)]
      const ok = problems.length === 0 && errors.length === 0 && ids.length === 49
      failed ||= !ok
      console.log(`${ok ? 'PASS' : 'FAIL'} ${vp.width}x${vp.height} text ${t}: ${r.svgs} svgs, ${ids.length} scene ids, ${r.texts} texts, min ${r.minPx.toFixed(1)}px, ${problems.length} problems, ${errors.length} console errors`)
      for (const p of problems) console.log('  ' + p)
      for (const e of errors) console.log('  ' + e)
      errors.length = 0
      if (shotPath && vp.width === 1920 && t === 0) {
        const need = await page.evaluate(() => {
          const g = document.querySelector('.visuals-grid')
          return g ? Math.ceil(g.scrollHeight + g.getBoundingClientRect().top + 24) : 0
        })
        await page.setViewport({ ...vp, height: Math.max(vp.height, need), deviceScaleFactor: 1 })
        await sleep(2500)
        await page.screenshot({ path: shotPath })
        let kb = statSync(shotPath).size / 1024
        // keep the PM's shot small: scale the capture down until it is under 1.5 MB
        for (const scale of [0.75, 0.6, 0.5]) {
          if (kb <= 1500) break
          const h = Math.max(vp.height, need)
          await page.screenshot({ path: shotPath, clip: { x: 0, y: 0, width: vp.width, height: h, scale } })
          kb = statSync(shotPath).size / 1024
        }
        console.log(`  wrote ${shotPath} (${Math.round(kb)} KB)`)
        await page.setViewport({ ...vp, deviceScaleFactor: 1 })
      }
    }
    await page.close()
  }
} finally {
  await browser.close()
  proc.kill()
}
process.exit(failed ? 1 : 0)
