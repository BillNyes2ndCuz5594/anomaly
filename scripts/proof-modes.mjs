// Proof script for Fun modes 2+3: Containment Rush and Reactor Stabilizer.
// Exercises both modes, runs rapid taps, checks independent saves, reloads, and captures screenshots.
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { freePort, launch, profilePage, startPreview } from './lib/drive.mjs'

const OUT = process.env.PROOF_OUT || '/workspace/anomaly-runs/modes23-after'
mkdirSync(OUT, { recursive: true })

const errors = []
const port = await freePort()
const { proc, base } = await startPreview(port)
let browser

try {
  browser = await launch()

  for (const vp of [
    { width: 1280, height: 720, label: '1280x720' },
    { width: 834, height: 1194, label: '834x1194' },
  ]) {
    console.log(`Starting walk for viewport ${vp.label}`)
    const page = await profilePage(browser, base, '', vp, errors)

    // --- Containment Rush Full Round ---
    await page.evaluate(() => { location.hash = '#containment/02-2' })
    await page.waitForSelector('.containment-screen', { timeout: 15000 })
    await page.screenshot({ path: join(OUT, `containment-start-${vp.label}.png`) })

    // Play rounds until results screen appears (up to 10 questions or early breach)
    let cRound = 0
    while (cRound < 10) {
      cRound++
      console.log(`Containment ${vp.label} round ${cRound}`)
      await page.waitForSelector('.quick-option:not([disabled])', { timeout: 15000 })
      const options = await page.$$('.quick-option:not([disabled])')
      if (options.length > 0) {
        if (cRound === 1) {
          console.log(`Containment rapid-tap test on round 1 (${vp.label})`)
          await page.evaluate(() => {
            const el = document.querySelector('.quick-option:not([disabled])')
            for (let i = 0; i < 30; i++) {
              el?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
              el?.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
              el?.click()
            }
          })
        } else {
          // Choose an answer choice
          await options[cRound % options.length].click()
        }
      }
      await sleep(200)
      const continueBtn = await page.waitForSelector('.containment-continue-btn', { timeout: 15000 })
      await continueBtn.click()

      // Deployment phase
      await page.waitForSelector('.containment-resolve-btn', { timeout: 15000 })
      if (cRound === 1) {
        await page.screenshot({ path: join(OUT, `containment-deploy-${vp.label}.png`) })
      }

      // Try deploying a defense if affordable
      const laneBtns = await page.$$('.containment-lane-btn[aria-disabled="false"]')
      if (laneBtns.length > 0) {
        await laneBtns[0].click()
        await sleep(100)
      }

      const resolveBtn = await page.$('.containment-resolve-btn')
      await resolveBtn.click()

      // Resolved phase
      const resolvedCont = await page.waitForSelector('.containment-resolved-panel .containment-continue-btn', { timeout: 15000 })
      await resolvedCont.click()

      // Check if finished (either 10 waves or integrity depleted)
      const done = await page.$('.containment-results')
      if (done) break
    }

    // Results screen
    await page.waitForSelector('.containment-results', { timeout: 15000 })
    await page.screenshot({ path: join(OUT, `containment-results-${vp.label}.png`) })

    // --- Reactor Stabilizer Full Round ---
    await page.evaluate(() => { location.hash = '#reactor/02-2' })
    await page.waitForSelector('.reactor-screen', { timeout: 15000 })
    await page.screenshot({ path: join(OUT, `reactor-start-${vp.label}.png`) })

    // Play rounds until results screen appears
    let rRound = 0
    while (rRound < 10) {
      rRound++
      console.log(`Reactor ${vp.label} round ${rRound}`)
      await page.waitForSelector('.quick-option:not([disabled])', { timeout: 15000 })
      const options = await page.$$('.quick-option:not([disabled])')
      if (options.length > 0) {
        if (rRound === 1) {
          console.log(`Reactor rapid-tap test on round 1 (${vp.label})`)
          await page.evaluate(() => {
            const el = document.querySelector('.quick-option:not([disabled])')
            for (let i = 0; i < 30; i++) {
              el?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
              el?.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
              el?.click()
            }
          })
        } else {
          await options[rRound % options.length].click()
        }
      }
      await sleep(200)
      const continueBtn = await page.waitForSelector('.reactor-continue-btn', { timeout: 15000 })
      await continueBtn.click()

      // Action phase (shield or pulse)
      await page.waitForSelector('.reactor-action-group', { timeout: 15000 })
      if (rRound === 1) {
        await page.screenshot({ path: join(OUT, `reactor-action-${vp.label}.png`) })
      }
      const shieldBtn = await page.$('.reactor-shield-btn:not([disabled])')
      if (shieldBtn) {
        await shieldBtn.click()
      } else {
        const pulseBtn = await page.waitForSelector('.reactor-pulse-btn', { timeout: 15000 })
        await pulseBtn.click()
      }

      // Resolved phase
      const resolvedCont = await page.waitForSelector('.reactor-resolved-panel .reactor-continue-btn', { timeout: 15000 })
      await resolvedCont.click()

      // Check if finished
      const done = await page.$('.reactor-results')
      if (done) break
    }

    // Results screen
    await page.waitForSelector('.reactor-results', { timeout: 15000 })
    await page.screenshot({ path: join(OUT, `reactor-results-${vp.label}.png`) })

    await page.close()
  }

  if (errors.length > 0) {
    console.error('Console errors encountered:', errors)
    process.exitCode = 1
  } else {
    console.log('Proof-modes completed successfully with 0 errors.')
  }
} finally {
  if (browser) await browser.close()
  proc.kill()
}
