// S17 iteration helper: item screen feedback frames, scrubbed deterministically. Writes /tmp/s17/<label>-item-*.png
import { setTimeout as sleep } from 'node:timers/promises'
import { CONTENT, click, freePort, launch, profilePage, startPreview, toCaseStep } from './lib/drive.mjs'
const [label = 'a', wS = '1366', hS = '768'] = process.argv.slice(2)
const port = await freePort()
const { proc, base } = await startPreview(port)
const browser = await launch()
const errors = []
const scrub = (page, sel, ms) =>
  page.evaluate(
    (s, t) => {
      for (const a of document.getAnimations()) if (a.effect?.target?.closest?.(s)) { a.pause(); a.currentTime = t }
    },
    sel,
    ms,
  )
const play = (page) => page.evaluate(() => document.getAnimations().forEach((a) => a.play()))
try {
  const vp = { width: Number(wS), height: Number(hS) }
  const page = await profilePage(browser, base, '?tier=high', vp, errors)
  await toCaseStep(page, 'items')
  await sleep(5000)
  await page.screenshot({ path: `/tmp/s17/${label}-item-0-settled.png` })
  const first = await page.$eval('[data-testid="stem"]', (e) => e.textContent.replace(/\s+/g, ' ').trim())
  const it = CONTENT.items.find((i) => i.stem.replace(/\s+/g, ' ').trim() === first) ?? CONTENT.items[0]
  const wrong = [0, 1, 2, 3].find((i) => i !== it.key)
  await click(page, `option-${wrong}`)
  await scrub(page, '.opt', 120)
  await page.screenshot({ path: `/tmp/s17/${label}-item-1-selected.png` })
  await play(page)
  await click(page, 'lock-in')
  await page.waitForSelector('[data-testid="item-result"]')
  await scrub(page, '.screen-host', 110)
  await page.screenshot({ path: `/tmp/s17/${label}-item-2-wrong.png` })
  await play(page)
  console.log(errors.length ? errors : 'noerr')
} finally {
  await browser.close()
  proc.kill()
}
