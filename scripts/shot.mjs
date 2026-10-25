// Quick targeted screenshots while iterating on art. Needs `npm run build` first.
// Usage: node scripts/shot.mjs [--vp=1366,1920] [--out=/tmp/shots] target[:qs] ...
// Targets: hub briefing lab-a lab-b lab-c item item-result visuals models cold-item results debrief firstrun
// Examples: node scripts/shot.mjs briefing lab-c --vp=1366     node scripts/shot.mjs visuals --text=2
import { mkdirSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'
import { click, finishItems, fitReport, svgReport, freePort, launch, profilePage, startPreview, text, toCaseStep, waitRendered, CONTENT } from './lib/drive.mjs'

const args = process.argv.slice(2)
const opt = (k, d) => (args.find((a) => a.startsWith(`--${k}=`)) ?? `--${k}=${d}`).split('=')[1]
const targets = args.filter((a) => !a.startsWith('--'))
const sizes = opt('vp', '1366').split(',').map((w) => ({ width: Number(w), height: Math.round((Number(w) * 9) / 16) }))
const OUT = opt('out', '/tmp/shots')
const textSize = Number(opt('text', '0'))
mkdirSync(OUT, { recursive: true })

const port = await freePort()
const { proc, base } = await startPreview(port)
const browser = await launch()
const errors = []
const QS = '?tier=high&still=1' + (opt('yaw', '') ? '&yaw=' + opt('yaw', '') : '')
try {
  for (const vp of sizes) {
    for (const target of targets) {
      const page = await profilePage(browser, base, QS, vp, errors)
      if (textSize) {
        await page.evaluate((t) => {
          const raw = JSON.parse(localStorage.getItem('anomaly.v1'))
          raw.state.settings = { ...raw.state.settings, textSize: t }
          localStorage.setItem('anomaly.v1', JSON.stringify(raw))
        }, textSize)
        await page.reload({ waitUntil: 'load' })
        await page.waitForSelector('[data-testid="hub"]')
      }
      const name = `${target.replace(/[:,]/g, '_').slice(0, 40)}-${vp.width}${textSize ? `-t${textSize}` : ''}`
      if (target === 'hub') {
        await sleep(3500)
      } else if (['briefing', 'lab-a', 'lab-b', 'lab-c'].includes(target)) {
        await toCaseStep(page, target)
        await waitRendered(page, 4500)
      } else if (target === 'item' || target === 'item-result') {
        await toCaseStep(page, 'items')
        await sleep(4500)
        if (target === 'item-result') {
          const stem = (await text(page, 'stem')).replace(/\s+/g, ' ').trim()
          const item = CONTENT.items.find((it) => it.stem.split(/\s+/).join(' ') === stem)
          await click(page, `option-${item.key}`)
          await click(page, 'lock-in')
          await page.waitForSelector('[data-testid="item-result"]')
          await sleep(1200)
        }
      } else if (target === 'lab-a-flash') {
        await toCaseStep(page, 'lab-a')
        await waitRendered(page, 1500)
        await click(page, `organ-${CONTENT.case.labs.organOps.tasks[0].organ}`)
        await page.waitForFunction(() => document.querySelector('[data-testid="lab-feedback"]')?.getAttribute('data-ok') === 'yes')
        await sleep(500)
      } else if (target === 'debrief' || target === 'results') {
        await toCaseStep(page, 'items')
        await sleep(1500)
        await finishItems(page)
        await sleep(target === 'debrief' ? 2500 : 500)
        if (target === 'results') {
          await click(page, 'debrief-continue')
          await page.waitForSelector('[data-testid="results"]')
          await sleep(4500)
        }
      } else if (target === 'firstrun') {
        await page.evaluate(() => localStorage.clear())
        await page.reload({ waitUntil: 'load' })
        await page.waitForSelector('[data-testid="start-shift"]')
        await page.click('[data-testid="start-shift"]')
        await page.waitForSelector('[data-testid="firstrun-modal"]')
        await sleep(800)
      } else if (target === 'cold-item') {
        await page.evaluate(() => (location.hash = '#/cold/cold-1'))
        await page.waitForSelector('[data-testid="cold-intro"]')
        await sleep(800)
        await click(page, 'cold-continue')
        await page.waitForSelector('[data-testid="item-player"]')
        await sleep(2500)
      } else if (target === 'visuals') {
        await page.goto(base + QS + '#/visuals', { waitUntil: 'load' })
        await page.waitForSelector('[data-testid="visuals-scenes"] svg')
        await page.setViewport({ width: vp.width, height: vp.width > 1700 ? 1080 : 1700, deviceScaleFactor: 1 })
        await sleep(2000)
      } else if (target === 'models' || target === 'models-all' || target.startsWith('models:')) {
        // models:a,b,c,d shows exactly those specimens, one per panel
        const extra = target === 'models-all' ? '&all=1' : target.startsWith('models:') ? `&ids=${target.slice(7)}` : ''
        await page.goto(base + QS + extra + '#/visuals/models', { waitUntil: 'load' })
        await page.waitForSelector('[data-testid="visuals-models"] canvas', { timeout: 60000 })
        await waitRendered(page, 7000)
      } else {
        console.log('unknown target', target)
        await page.close()
        continue
      }
      const file = `${OUT}/${name}.png`
      await page.screenshot({ path: file, fullPage: target === 'visuals' })
      const fits = await fitReport(page)
      if (target === 'visuals' || target === 'cold-item') console.log('svg', JSON.stringify(await svgReport(page)))
      console.log(`wrote ${file}`, fits.length ? JSON.stringify(fits.map((f) => ({ over: +f.over.toFixed(3), w: f.canvasW, h: f.canvasH, minX: f.minX, maxX: f.maxX, minY: f.minY, maxY: f.maxY, fw: f.fw, fh: f.fh }))) : '')
      await page.close()
    }
  }
} finally {
  await browser.close()
  proc.kill()
}
if (errors.length) {
  console.log('CONSOLE ERRORS:\n' + errors.join('\n'))
  process.exitCode = 1
}
