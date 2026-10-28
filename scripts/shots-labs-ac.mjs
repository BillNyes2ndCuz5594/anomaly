// Before/after frames of Lab A and Lab C mid-play.
// Does not replace scripts/proof.mjs. Needs `npm run build` first.
// Usage: AN_TAG=lac PROOF_OUT=/tmp/anomaly-proof-lac node scripts/shots-labs-ac.mjs [--when=before|after]
import { mkdirSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'
import { CONTENT, click, fitReport, freePort, launch, profilePage, startPreview, toCaseStep, waitRendered } from './lib/drive.mjs'

const when = (process.argv.find((a) => a.startsWith('--when=')) ?? '--when=after').split('=')[1]
const OUT = (process.env.PROOF_OUT || '/tmp/anomaly-proof-lac') + '/shots'
mkdirSync(OUT, { recursive: true })

const PROFILES = [
  { tag: '1920', width: 1920, height: 1080, dpr: 1, mobile: false },
  { tag: 's23-portrait', width: 360, height: 780, dpr: 2, mobile: true },
  { tag: 'tab-landscape', width: 1280, height: 800, dpr: 1, mobile: true },
]

const QS = '?tier=high&still=1'

async function labAMid(page) {
  await toCaseStep(page, 'lab-a')
  await waitRendered(page, 2200)
  const tasks = CONTENT.case.labs.organOps.tasks
  for (let i = 0; i < 4; i++) {
    await click(page, `organ-${tasks[i].organ}`)
    await page.waitForFunction(() => document.querySelector('[data-testid="lab-feedback"]')?.getAttribute('data-ok') === 'yes')
    await click(page, 'lab-next')
    await sleep(80)
  }
  await click(page, `organ-${tasks[4].organ}`)
  await page.waitForFunction(() => document.querySelector('[data-testid="lab-feedback"]')?.getAttribute('data-ok') === 'yes')
  await sleep(700)
}

async function labCMid(page) {
  await toCaseStep(page, 'lab-c')
  await waitRendered(page, 2200)
  const specs = CONTENT.case.labs.specimenSort.specimens
  for (let i = 0; i < 2; i++) {
    const sp = specs[i]
    await click(page, `sort-backbone-${sp.backbone ? 'yes' : 'no'}`)
    await click(page, `sort-group-${sp.group}`)
    await click(page, 'lab-next')
    await sleep(80)
  }
  const cur = specs[2]
  await click(page, `sort-backbone-${cur.backbone ? 'yes' : 'no'}`)
  await page.waitForFunction(() => document.querySelector('[data-testid="lab-feedback"]')?.getAttribute('data-ok') === 'yes')
  await sleep(900)
}

const port = await freePort()
const { proc, base } = await startPreview(port)
const browser = await launch()
const errors = []
try {
  for (const vp of PROFILES) {
    for (const lab of ['lab-a', 'lab-c']) {
      const page = await profilePage(browser, base, QS, { width: vp.width, height: vp.height, deviceScaleFactor: vp.dpr }, errors)
      if (vp.mobile) {
        await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: vp.dpr, isMobile: true, hasTouch: true })
      }
      if (lab === 'lab-a') await labAMid(page)
      else await labCMid(page)
      const file = `${OUT}/${lab}-${when}-${vp.tag}.png`
      await page.screenshot({ path: file })
      const fits = await fitReport(page)
      const over = fits.map((f) => f.over.toFixed(3)).join(',') || 'none'
      console.log(`wrote ${file} fit ${over}`)
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
