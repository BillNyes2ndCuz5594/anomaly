// Iteration helper for S17 motion. node scripts/s17-shot.mjs <label> [w] [h]
// Needs a fresh `npm run build`. Captures timed frames of the hub -> briefing route transition.
import { mkdirSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'
import { freePort, launch, profilePage, startPreview } from './lib/drive.mjs'
const [label = 'base', wS = '1920', hS = '1080'] = process.argv.slice(2)
mkdirSync('/tmp/s17', { recursive: true })
const port = await freePort()
const { proc, base } = await startPreview(port)
const browser = await launch()
const errors = []
try {
  const vp = { width: Number(wS), height: Number(hS) }
  const page = await profilePage(browser, base, '?tier=high', vp, errors)
  await sleep(4000)
  await page.screenshot({ path: `/tmp/s17/${label}-hub-settled.png` })
  // Veil mid frame: drive the phase by hand and scrub the animations, so the frame is deterministic.
  await page.evaluate(() => {
    const v = document.querySelector('.veil')
    v.dataset.phase = 'reveal'
  })
  await page.evaluate(() => {
    for (const a of document.querySelector('.veil').getAnimations({ subtree: true })) {
      a.pause()
      a.currentTime = 110
    }
  })
  await page.screenshot({ path: `/tmp/s17/${label}-veil-mid.png` })
  await page.evaluate(() => (document.querySelector('.veil').dataset.phase = 'idle'))
  // Panels settling: navigate, catch the new screen host as it mounts, scrub its animations.
  for (const t of [120, 260]) {
    await page.evaluate(() => (location.hash = '#/hub'))
    await sleep(1500)
    await page.evaluate(() => {
      window.__old = document.querySelector('.screen-host')
      location.hash = '#/case/03-1'
    })
    await page.evaluate(
      (ms) =>
        new Promise((res) => {
          const poll = () => {
            const h = document.querySelector('.screen-host')
            if (h && h !== window.__old && h.querySelector('[data-testid="briefing"]')) {
              for (const a of document.getAnimations()) if (a.effect?.target?.closest?.('.screen-host')) { a.pause(); a.currentTime = ms }
              res()
            } else requestAnimationFrame(poll)
          }
          poll()
        }),
      t,
    )
    await page.screenshot({ path: `/tmp/s17/${label}-panels-${t}.png` })
    await page.evaluate(() => document.getAnimations().forEach((a) => a.play()))
  }
  await sleep(1500)
  await page.screenshot({ path: `/tmp/s17/${label}-briefing-settled.png` })
  console.log(errors.length ? errors : 'noerr')
} finally {
  await browser.close()
  proc.kill()
}
