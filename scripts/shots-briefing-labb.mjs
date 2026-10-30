// Before/after frames of Briefing and Lab B.
// Does not replace scripts/proof.mjs. Needs `npm run build` first.
// Usage: AN_TAG=bl PROOF_OUT=/tmp/proof-bl node scripts/shots-briefing-labb.mjs [--when=before|after]
import { mkdirSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'
import { click, fitReport, freePort, launch, profilePage, startPreview, toCaseStep, waitRendered } from './lib/drive.mjs'

const when = (process.argv.find((a) => a.startsWith('--when=')) ?? '--when=after').split('=')[1]
const only = (process.argv.find((a) => a.startsWith('--tag=')) ?? '').split('=')[1]
const OUT = (process.env.PROOF_OUT || '/tmp/proof-bl') + '/shots'
mkdirSync(OUT, { recursive: true })

const PROFILES = [
  { tag: '1920', width: 1920, height: 1080, dpr: 1, mobile: false },
  { tag: 's23-portrait', width: 360, height: 780, dpr: 2, mobile: true },
  { tag: 's23-landscape', width: 780, height: 360, dpr: 2, mobile: true },
  { tag: 'tab-portrait', width: 800, height: 1280, dpr: 1, mobile: true },
  { tag: 'tab-landscape', width: 1280, height: 800, dpr: 1, mobile: true },
]

const QS = '?tier=high&still=1'

async function labBMid(page) {
  await toCaseStep(page, 'lab-b')
  await waitRendered(page, 2200)
  await click(page, 'match-p1-animal')
  await click(page, 'match-p1-plant')
  await sleep(400)
}

const port = await freePort()
const { proc, base } = await startPreview(port)
const browser = await launch()
const errors = []
try {
  for (const vp of PROFILES.filter((p) => !only || p.tag === only)) {
    for (const screen of ['briefing', 'lab-b']) {
      const page = await profilePage(browser, base, QS, { width: vp.width, height: vp.height, deviceScaleFactor: vp.dpr }, errors)
      if (vp.mobile) {
        await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: vp.dpr, isMobile: true, hasTouch: true })
      }
      if (screen === 'briefing') {
        await toCaseStep(page, 'briefing')
        await waitRendered(page, 2200)
      } else {
        await labBMid(page)
      }
      const file = `${OUT}/${screen}-${when}-${vp.tag}.png`
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
