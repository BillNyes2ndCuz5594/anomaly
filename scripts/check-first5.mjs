// Headless puppeteer proof for first 5 cases and access gates.
// Serves built dist/ and asserts layout, scrolling, and access fixes.
// Usage: timeout 400 node scripts/check-first5.mjs
import { mkdirSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'
import { freePort, launch, profilePage, startPreview, toCaseStep } from './lib/drive.mjs'

const SHOTS_DIR = '/workspace/anomaly-runs/first5/shots/merged'
mkdirSync(SHOTS_DIR, { recursive: true })

const VIEWPORTS = [
  { name: '1280x800', width: 1280, height: 800, mobile: false },
  { name: '1366x768', width: 1366, height: 768, mobile: false },
  { name: '1024x768', width: 1024, height: 768, mobile: false },
  { name: '810x1080', width: 810, height: 1080, mobile: true },
]

const SETTINGS = [
  { label: 'normal', textSize: 0, lineSpacing: 0 },
  { label: 'large', textSize: 1, lineSpacing: 0 },
  { label: 'extra-large-loose', textSize: 2, lineSpacing: 2 },
]

const errors = []
const checks = []
const check = (name, ok, detail = '') => {
  checks.push({ name, ok: !!ok, detail })
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? `  [${detail}]` : ''}`)
}

async function setGameSettings(page, settings) {
  await page.evaluate((s) => {
    const raw = JSON.parse(localStorage.getItem('anomaly.v1') || '{}')
    if (raw && raw.state) {
      raw.state.settings = { ...raw.state.settings, ...s }
      localStorage.setItem('anomaly.v1', JSON.stringify(raw))
    }
  }, settings)
  await page.reload({ waitUntil: 'load' })
  await page.waitForSelector('[data-testid="briefing"]')
  await sleep(250)
}

const port = await freePort()
const { proc, base } = await startPreview(port)
const browser = await launch()

try {
  const initialVp = VIEWPORTS[0]
  const page = await profilePage(browser, base, '?tier=low', { width: initialVp.width, height: initialVp.height }, errors)
  await toCaseStep(page, 'briefing')
  await page.waitForSelector('[data-testid="briefing"]')

  // 1. Acceptance check across all 4 viewports and text/spacing settings:
  // Both action rectangles are fully inside the viewport without initial scrolling.
  for (const vp of VIEWPORTS) {
    if (vp.mobile) {
      await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 1, isMobile: true, hasTouch: true })
    } else {
      await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 1, isMobile: false, hasTouch: false })
    }

    for (const st of SETTINGS) {
      await setGameSettings(page, { textSize: st.textSize, lineSpacing: st.lineSpacing })
      await page.waitForSelector('[data-testid="briefing"]')
      await sleep(200)

      const bounds = await page.evaluate(() => {
        const ra = document.querySelector('[data-testid="read-aloud"]')?.getBoundingClientRect()
        const cont = document.querySelector('[data-testid="briefing-continue"]')?.getBoundingClientRect()
        const actions = document.querySelector('[data-testid="briefing-actions"]')?.getBoundingClientRect()
        const story = document.querySelector('[data-testid="briefing-story"]')?.getBoundingClientRect()
        const vh = window.innerHeight
        const vw = window.innerWidth
        return {
          ra: ra ? { top: ra.top, bottom: ra.bottom, left: ra.left, right: ra.right } : null,
          cont: cont ? { top: cont.top, bottom: cont.bottom, left: cont.left, right: cont.right } : null,
          actions: actions ? { top: actions.top, bottom: actions.bottom } : null,
          story: story ? { top: story.top, bottom: story.bottom, height: story.height } : null,
          vh,
          vw,
        }
      })

      const raOk = bounds.ra && bounds.ra.top >= 0 && bounds.ra.bottom <= bounds.vh && bounds.ra.left >= 0 && bounds.ra.right <= bounds.vw
      const contOk = bounds.cont && bounds.cont.top >= 0 && bounds.cont.bottom <= bounds.vh && bounds.cont.left >= 0 && bounds.cont.right <= bounds.vw

      check(
        `actions visible at ${vp.name} (${st.label})`,
        raOk && contOk,
        `ra bottom: ${bounds.ra?.bottom}px, cont bottom: ${bounds.cont?.bottom}px, vh: ${bounds.vh}px`,
      )

      if (st.label === 'extra-large-loose') {
        await page.screenshot({ path: `${SHOTS_DIR}/pr1-briefing-${vp.name}-${st.label}.png` })
      }
    }
  }

  // 2. Story scrolling test (wheel, touch, keyboard) on 1024x768 Extra large Loose
  await page.setViewport({ width: 1024, height: 768, deviceScaleFactor: 1, isMobile: false, hasTouch: false })
  await setGameSettings(page, { textSize: 2, lineSpacing: 2 })
  await page.waitForSelector('[data-testid="briefing"]')
  await sleep(250)

  // Keyboard scrolling inside briefing-story:
  await page.evaluate(() => {
    const story = document.querySelector('[data-testid="briefing-story"]')
    if (story) story.scrollTop = 0
  })
  await page.focus('[data-testid="briefing-story"]')
  await page.keyboard.press('PageDown')
  await sleep(200)
  const keyScrollTop = await page.evaluate(() => document.querySelector('[data-testid="briefing-story"]')?.scrollTop ?? 0)
  check('keyboard scrolling scrolls briefing-story', keyScrollTop > 0, `scrollTop=${keyScrollTop}`)

  // Wheel scrolling inside briefing-story:
  await page.evaluate(() => {
    const story = document.querySelector('[data-testid="briefing-story"]')
    if (story) story.scrollTop = 0
  })
  const storyCenter = await page.$eval('[data-testid="briefing-story"]', (el) => {
    const r = el.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  })
  await page.mouse.move(storyCenter.x, storyCenter.y)
  await page.mouse.wheel({ deltaY: 200 })
  await sleep(200)
  const wheelScrollTop = await page.evaluate(() => document.querySelector('[data-testid="briefing-story"]')?.scrollTop ?? 0)
  check('wheel scrolling scrolls briefing-story', wheelScrollTop > 0, `scrollTop=${wheelScrollTop}`)

  // Scroll to bottom and verify the final paragraph is reached and footer remains visible
  await page.evaluate(() => {
    const story = document.querySelector('[data-testid="briefing-story"]')
    if (story) story.scrollTop = story.scrollHeight
  })
  await sleep(150)
  const reachEnd = await page.evaluate(() => {
    const story = document.querySelector('[data-testid="briefing-story"]')
    const actions = document.querySelector('[data-testid="briefing-actions"]')
    const lastP = story?.querySelector('p:last-of-type')
    const cont = document.querySelector('[data-testid="briefing-continue"]')
    const storyRect = story?.getBoundingClientRect()
    const lastRect = lastP?.getBoundingClientRect()
    const actionsRect = actions?.getBoundingClientRect()
    const contRect = cont?.getBoundingClientRect()
    const vh = window.innerHeight
    return {
      lastPTopInsideStory: lastRect ? lastRect.top < (storyRect?.bottom ?? 0) : false,
      footerInsideViewport: actionsRect ? actionsRect.top >= 0 && actionsRect.bottom <= vh : false,
      buttonInsideViewport: contRect ? contRect.top >= 0 && contRect.bottom <= vh : false,
    }
  })
  check('scrolling reaches final paragraph of story', reachEnd.lastPTopInsideStory)
  check('footer remains visible when story is scrolled to bottom', reachEnd.footerInsideViewport)
  check('continue button remains inside viewport when story is scrolled', reachEnd.buttonInsideViewport)
  await page.screenshot({ path: `${SHOTS_DIR}/pr1-briefing-story-scrolled.png` })

  // 3. Reduced motion produces usable layout with actions inside viewport
  await setGameSettings(page, { reducedMotion: true, textSize: 0, lineSpacing: 0 })
  await page.waitForSelector('[data-testid="briefing"]')
  const reducedCheck = await page.evaluate(() => {
    const cont = document.querySelector('[data-testid="briefing-continue"]')?.getBoundingClientRect()
    const motionFlag = document.documentElement.dataset.reducedMotion
    return {
      inside: cont ? cont.top >= 0 && cont.bottom <= window.innerHeight : false,
      motionFlag,
    }
  })
  check('reduced motion sets document dataset flag', reducedCheck.motionFlag === 'true')
  check('reduced motion keeps actions fully visible', reducedCheck.inside)

  // 4. Keyboard navigation: Tab reaches story and both actions, Enter activates focused action
  await page.focus('[data-testid="back-to-hub-top"]')
  await page.keyboard.press('Tab')
  const f1 = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))
  check('Tab reaches briefing-story', f1 === 'briefing-story', `focused ${f1}`)

  await page.keyboard.press('Tab')
  const f2 = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))
  check('Tab reaches read-aloud', f2 === 'read-aloud', `focused ${f2}`)

  await page.keyboard.press('Tab')
  const f3 = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))
  check('Tab reaches briefing-continue', f3 === 'briefing-continue', `focused ${f3}`)

  // Press Enter on the focused continue button:
  await page.keyboard.press('Enter')
  await page.waitForSelector('[data-testid="lab-a"]', { timeout: 15000 })
  check('Enter activates focused action without click scrolling', (await page.$('[data-testid="lab-a"]')) !== null)

  await page.close()
} finally {
  await browser.close()
  proc.kill()
}

// 5. Console errors check
check('zero console errors reported', errors.length === 0, errors.join('\n'))

const failed = checks.filter((c) => !c.ok)
console.log(`\ncheck-first5 summary: ${checks.length - failed.length} passed, ${failed.length} failed.`)
if (failed.length > 0 || errors.length > 0) {
  process.exitCode = 1
}
