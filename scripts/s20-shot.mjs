// Iteration helper for S20. node scripts/s20-shot.mjs [w] [h] [mode]  mode: sample|decoded|print|sorted
// Needs a fresh `npm run build`. Writes /tmp/s20/teacher-<mode>-<w>x<h>.png
import { mkdirSync } from 'node:fs'
import { freePort, launch, startPreview } from './lib/drive.mjs'
const [wS = '1920', hS = '1080', mode = 'sample'] = process.argv.slice(2)
mkdirSync('/tmp/s20', { recursive: true })
const port = await freePort()
const { proc, base } = await startPreview(port)
const browser = await launch()
const errors = []
try {
  const page = await browser.newPage()
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.setViewport({
    width: Number(wS),
    height: Number(hS),
    deviceScaleFactor: 1,
  })
  await page.goto(base + 'teacher.html', { waitUntil: 'networkidle0' })
  if (mode !== 'empty') await page.click('[data-testid="load-sample"]')
  if (mode === 'sorted' || mode === 'print') {
    await page.select('[data-testid="sort-benchmarks"]', 'low')
    await page.select('[data-testid="sort-agents"]', 'low')
  }
  if (mode === 'print') await page.emulateMediaType('print')
  await new Promise((r) => setTimeout(r, 500))
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  if (over > 0)
    console.log(
      await page.evaluate(() =>
        [...document.querySelectorAll('body *')]
          .filter((e) => !e.closest('.heat-scroll'))
          .filter((e) => e.getBoundingClientRect().right > document.documentElement.clientWidth + 1)
          .slice(0, 6)
          .map((e) => e.tagName + '.' + e.className + ' ' + Math.round(e.getBoundingClientRect().right)),
      ),
    )
  if (over > 0)
    console.log(
      await page.evaluate(() =>
        [document.documentElement, document.body, ...document.querySelectorAll('body *')]
          .filter((e) => e.scrollWidth > e.clientWidth + 1 && !e.closest('.heat-scroll'))
          .slice(0, 8)
          .map((e) => e.tagName + '.' + e.className + ' sw' + e.scrollWidth + ' cw' + e.clientWidth),
      ),
    )
  const out = `/tmp/s20/teacher-${mode}-${wS}x${hS}.png`
  await page.screenshot({ path: out, fullPage: true })
  console.log('wrote', out, 'pageOverflowX', over, errors.length ? errors : 'noerr')
} finally {
  await browser.close()
  proc.kill()
}
