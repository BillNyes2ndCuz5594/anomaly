// Iteration helper for S18. node scripts/s18-shot.mjs <screens|all> [w] [h] [dsf]
// screens: comma list of title,hub,briefing,debrief,results,settings. Needs a fresh `npm run build`. Writes /tmp/s18/<screen>-<w>.png
import { mkdirSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'
import { click, freePort, launch, startPreview, toCaseStep, finishItems, waitRendered } from './lib/drive.mjs'
const [which = 'all', wS = '1920', hS = '1080', dsfS = '1'] = process.argv.slice(2)
const want = which === 'all' ? ['title', 'hub', 'briefing', 'debrief', 'results'] : which.split(',')
mkdirSync('/tmp/s18', { recursive: true })
const port = await freePort()
const { proc, base } = await startPreview(port)
const browser = await launch()
const errors = []
try {
  const vp = { width: Number(wS), height: Number(hS), deviceScaleFactor: Number(dsfS) }
  const page = await browser.newPage()
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(e.message))
  await page.setViewport(vp)
  await page.goto(base + '?tier=high&still=1#/', { waitUntil: 'load' })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'load' })
  await page.waitForSelector('[data-testid="start-shift"]')
  await waitRendered(page, 3000)
  const snap = async (n) => {
    await sleep(1200)
    await page.screenshot({ path: `/tmp/s18/${n}-${wS}.png` })
    const a = await page.evaluate(() => window.__anomaly)
    console.log('wrote', n, 'calls', a?.calls)
  }
  if (want.includes('title')) await snap('title')
  await page.click('[data-testid="start-shift"]')
  await page.waitForSelector('[data-testid="firstrun-modal"]')
  await page.type('[data-testid="classcode-input"]', 'DEMO')
  await page.click('[data-testid="agent-input"]', { clickCount: 3 })
  await page.type('[data-testid="agent-input"]', '14')
  await page.click('[data-testid="firstrun-confirm"]')
  await page.waitForSelector('[data-testid="hub"]')
  page.setDefaultTimeout(60000)
  await sleep(3500)
  if (want.includes('hub')) await snap('hub')
  if (want.includes('settings')) {
    await click(page, 'open-settings')
    await page.waitForSelector('[data-testid="settings"]')
    await snap('settings')
    await page.evaluate(() => (location.hash = '#/hub'))
    await sleep(800)
  }
  if (want.some((x) => ['briefing', 'debrief', 'results'].includes(x))) {
    await toCaseStep(page, 'briefing')
    await sleep(2500)
    if (want.includes('briefing')) await snap('briefing')
  }
  if (want.some((x) => ['debrief', 'results'].includes(x))) {
    await toCaseStep(page, 'items')
    await finishItems(page)
    await sleep(2500)
    if (want.includes('debrief')) await snap('debrief')
    if (want.includes('results')) {
      await click(page, 'debrief-continue')
      await page.waitForSelector('[data-testid="results"]')
      await sleep(4000)
      await snap('results')
    }
  }
  console.log(errors.length ? errors : 'noerr')
} finally {
  await browser.close()
  proc.kill()
}
