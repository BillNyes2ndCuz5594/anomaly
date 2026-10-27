// S17 iteration helper: debrief stamp frames and count up, then results. Writes /tmp/s17/<label>-debrief-*.png
import { setTimeout as sleep } from 'node:timers/promises'
import { CONTENT, click, freePort, launch, profilePage, startPreview, toCaseStep } from './lib/drive.mjs'
const [label = 'a', wS = '1920', hS = '1080'] = process.argv.slice(2)
const port = await freePort()
const { proc, base } = await startPreview(port)
const browser = await launch()
const errors = []
try {
  const vp = { width: Number(wS), height: Number(hS) }
  const page = await profilePage(browser, base, '?tier=high', vp, errors)
  await toCaseStep(page, 'items')
  for (let n = 0; n < 5; n++) {
    await page.waitForSelector('[data-testid="stem"]')
    await sleep(800)
    const stem = await page.$eval('[data-testid="stem"]', (e) => e.textContent.replace(/\s+/g, ' ').trim())
    const it = CONTENT.items.find((i) => i.stem.replace(/\s+/g, ' ').trim() === stem)
    await click(page, `option-${it.key}`)
    await click(page, 'lock-in')
    await page.waitForSelector('[data-testid="item-result"]')
    await click(page, 'next-item')
  }
  await page.waitForSelector('[data-testid="debrief"]')
  const early = await page.$eval('[data-testid="debrief-score"]', (e) => ({ t: e.textContent, final: e.dataset.countFinal, hidden: e.getAttribute('aria-hidden') }))
  await sleep(3000)
  await page.evaluate(() => {
    const s = '.stamp'
    const els = [...document.querySelectorAll(`${s}, ${s} *`)].filter((e) => {
      const cs = getComputedStyle(e)
      return cs.animationName !== 'none' && cs.animationIterationCount !== 'infinite'
    })
    els.forEach((e) => (e.style.animation = 'none'))
    void document.body.offsetWidth
    els.forEach((e) => (e.style.animation = ''))
    for (const a of document.getAnimations()) if (a.effect?.target?.closest?.('.stamp, .debrief-head') && a.effect.getTiming().iterations !== Infinity) { a.pause(); a.currentTime = 200 }
  })
  await page.screenshot({ path: `/tmp/s17/${label}-debrief-stamp.png` })
  await page.evaluate(() => document.getAnimations().forEach((a) => a.playState === 'paused' && a.play()))
  await sleep(2500)
  const late = await page.$eval('[data-testid="debrief-score"]', (e) => ({ t: e.textContent, hidden: e.getAttribute('aria-hidden') }))
  console.log('early', JSON.stringify(early), 'late', JSON.stringify(late), 'sr nodes', await page.$$eval('.debrief-summary .sr-only', (e) => e.length))
  await page.screenshot({ path: `/tmp/s17/${label}-debrief-settled.png` })
  await click(page, 'debrief-continue')
  await page.waitForSelector('[data-testid="results"]')
  await sleep(2600)
  await page.screenshot({ path: `/tmp/s17/${label}-results-settled.png` })
  console.log(errors.length ? errors : 'noerr')
} finally {
  await browser.close()
  proc.kill()
}
