// Title and hub frames for review. Does not touch the proof or mobile runners.
// Usage: AN_TAG=th-shots PROOF_OUT=/tmp/anomaly-shots-th node scripts/shots-title-hub.mjs
// Writes PNGs into $PROOF_OUT (default /tmp/anomaly-shots-title-hub).
import { mkdirSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'
import { freePort, launch, startPreview, waitRendered } from './lib/drive.mjs'

const OUT = process.env.PROOF_OUT || '/tmp/anomaly-shots-title-hub'
const VIEWS = [
  { tag: '1920', width: 1920, height: 1080, dpr: 1 },
  { tag: 's23-portrait', width: 360, height: 780, dpr: 2, mobile: true },
  { tag: 'tab-landscape', width: 1280, height: 800, dpr: 1 },
]

mkdirSync(OUT, { recursive: true })
const port = await freePort()
const { proc, base } = await startPreview(port)
const browser = await launch()
const errors = []
try {
  for (const view of VIEWS) {
    const page = await browser.newPage()
    page.on('console', (m) => m.type() === 'error' && errors.push(`${view.tag}: ${m.text()}`))
    page.on('pageerror', (e) => errors.push(`${view.tag}: ${e.message}`))
    await page.setViewport({
      width: view.width,
      height: view.height,
      deviceScaleFactor: view.dpr,
      isMobile: !!view.mobile,
      hasTouch: !!view.mobile,
    })
    await page.goto(base + '?tier=high&still=1#/', { waitUntil: 'load' })
    await page.evaluate(() => localStorage.clear())
    await page.reload({ waitUntil: 'load' })
    await page.waitForSelector('[data-testid="title"]')
    await waitRendered(page, 2200)
    const titlePath = `${OUT}/title-${view.tag}.png`
    await page.screenshot({ path: titlePath })
    await page.click('[data-testid="start-shift"]')
    await page.waitForSelector('[data-testid="firstrun-modal"]')
    await page.type('[data-testid="classcode-input"]', 'DEMO')
    await page.click('[data-testid="agent-input"]', { clickCount: 3 })
    await page.type('[data-testid="agent-input"]', '14')
    await page.click('[data-testid="firstrun-confirm"]')
    await page.waitForSelector('[data-testid="hub"]')
    page.setDefaultTimeout(60000)
    await sleep(2800)
    const hubPath = `${OUT}/hub-${view.tag}.png`
    await page.screenshot({ path: hubPath })
    const info = await page.evaluate(() => window.__anomaly)
    console.log(view.tag, 'calls', info?.calls, 'tier', info?.tier)
    await page.close()
  }
  console.log(errors.length ? errors.join('\n') : 'noerr')
  if (errors.length) process.exitCode = 1
} finally {
  await browser.close()
  proc.kill()
}
