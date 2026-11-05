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
  await sleep(100)
  await page.mouse.wheel({ deltaY: 200 })
  await sleep(300)
  let wheelScrollTop = await page.evaluate(() => document.querySelector('[data-testid="briefing-story"]')?.scrollTop ?? 0)
  if (wheelScrollTop === 0) {
    await page.mouse.wheel({ deltaY: 200 })
    await sleep(300)
    wheelScrollTop = await page.evaluate(() => document.querySelector('[data-testid="briefing-story"]')?.scrollTop ?? 0)
  }
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

  // =========================================================================
  // PR 2: Make question evidence, crossing out, keyboard input, and speech truthful
  // =========================================================================

  async function setToCaseItems(targetPage, { caseId = '00-1', itemIndex = 0, settings = {} } = {}) {
    await targetPage.evaluate(({ caseId, itemIndex, settings }) => {
      const raw = JSON.parse(localStorage.getItem('anomaly.v1') || '{}')
      if (raw && raw.state) {
        raw.state.settings = { ...raw.state.settings, ...settings }
        localStorage.setItem('anomaly.v1', JSON.stringify(raw))
      }
      const today = new Date().toDateString()
      sessionStorage.setItem(`anomaly.case.case.${caseId}`, JSON.stringify({
        v: 1,
        day: today,
        kind: 'case',
        caseId,
        step: 'items',
        itemIds: ['N1.1-01', 'N1.1-02', 'N1.1-03', 'N2.1-01', 'N2.2-01'],
        itemIndex,
        answers: [],
        benchmarks: ['SC.5.N.1.1', 'SC.5.N.2.1', 'SC.5.N.2.2'],
        stagesBefore: {},
        stageUps: 0,
        paint: null,
      }))
      location.hash = `#/case/${caseId}`
    }, { caseId, itemIndex, settings })
    await targetPage.reload({ waitUntil: 'load' })
    await targetPage.waitForSelector('[data-testid="item-player"]', { timeout: 15000 })
    await sleep(300)
  }

  // 1. First-question guide: nonmodal, required copy, only on question 1
  await page.setViewport({ width: 1366, height: 768, deviceScaleFactor: 1, isMobile: false, hasTouch: false })
  await setToCaseItems(page, { caseId: '00-1', itemIndex: 0, settings: { textSize: 0, lineSpacing: 0, helpLevel: 'regular' } })

  const guideInfo = await page.evaluate(() => {
    const guide = document.querySelector('[data-testid="first-question-guide"]')
    if (!guide) return null
    const text = guide.textContent || ''
    const stem = document.querySelector('[data-testid="stem"]')?.getBoundingClientRect()
    const visual = document.querySelector('[data-testid="item-visual"]')?.getBoundingClientRect()
    const opt = document.querySelector('[data-testid="option-0"]')?.getBoundingClientRect()
    const lock = document.querySelector('[data-testid="lock-in"]')?.getBoundingClientRect()
    const gRect = guide.getBoundingClientRect()
    const coversStem = stem ? !(gRect.bottom <= stem.top || gRect.top >= stem.bottom || gRect.right <= stem.left || gRect.left >= stem.right) : false
    const coversVisual = visual ? !(gRect.bottom <= visual.top || gRect.top >= visual.bottom || gRect.right <= visual.left || gRect.left >= visual.right) : false
    const coversOpt = opt ? !(gRect.bottom <= opt.top || gRect.top >= opt.bottom || gRect.right <= opt.left || gRect.left >= opt.right) : false
    const coversLock = lock ? !(gRect.bottom <= lock.top || gRect.top >= lock.bottom || gRect.right <= lock.left || gRect.left >= lock.right) : false
    return {
      exists: true,
      hasLead: text.includes('Read the question. Tap clue words if they help. Choose an answer, then Lock in.'),
      hasIntel: text.includes('Intel is bonus points for finding evidence.'),
      hasKbd: text.includes('Keyboard: Tab to an answer and press Enter. On a clue word, Space or Enter marks it.'),
      doesNotCoverOtherElements: !coversStem && !coversVisual && !coversOpt && !coversLock,
    }
  })
  check('first-question-guide exists on first question', !!guideInfo?.exists)
  check('first-question-guide has lead copy', !!guideInfo?.hasLead)
  check('first-question-guide has Intel copy', !!guideInfo?.hasIntel)
  check('first-question-guide has keyboard copy', !!guideInfo?.hasKbd)
  check('first-question-guide does not cover stem, visual, options or lock-in', !!guideInfo?.doesNotCoverOtherElements)

  // 2. RKEA Key words indicator: stays data-lit="no" on non-key word, lights data-lit="yes" on earned key phrase
  const initialLit = await page.$eval('[data-testid="rkea-key-words"]', (el) => el.getAttribute('data-lit'))
  check('rkea-key-words starts with data-lit="no"', initialLit === 'no')

  // Click non-key word token 0 ("Two")
  await page.click('[data-testid="word-0"]')
  await sleep(150)
  const nonKeyLit = await page.$eval('[data-testid="rkea-key-words"]', (el) => el.getAttribute('data-lit'))
  check('tagging a non-key word leaves rkea-key-words data-lit="no"', nonKeyLit === 'no')

  // Find and tag an earned key phrase for N1.1-01 (keyWords: ["keep the same", "50 mL of water each day"])
  const keyTokens = await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('[data-testid^="word-"]')]
    const words = buttons.map((b) => b.textContent?.trim().toLowerCase().replace(/[^a-z0-9]/g, '') || '')
    // Find "keep" "the" "same"
    for (let i = 0; i < words.length - 2; i++) {
      if (words[i] === 'keep' && words[i + 1] === 'the' && words[i + 2] === 'same') return [i, i + 1, i + 2]
    }
    return []
  })
  if (keyTokens.length > 0) {
    for (const t of keyTokens) {
      await page.click(`[data-testid="word-${t}"]`)
      await sleep(100)
    }
  }
  const keyLit = await page.$eval('[data-testid="rkea-key-words"]', (el) => el.getAttribute('data-lit'))
  check('tagging an earned key phrase lights rkea-key-words with data-lit="yes"', keyLit === 'yes')

  // 3. Crossing out: toggle renamed to "Cross out an answer", status shown, answers marked without color alone
  const initialToggle = await page.$eval('[data-testid="crossout-toggle"]', (el) => ({
    text: el.textContent?.trim(),
    pressed: el.getAttribute('aria-pressed'),
  }))
  check('toggle begins as Cross out an answer', initialToggle.text?.includes('Cross out an answer') && initialToggle.pressed === 'false')

  // Turn on crossing out
  await page.click('[data-testid="crossout-toggle"]')
  await sleep(150)
  const activeToggle = await page.$eval('[data-testid="crossout-toggle"]', (el) => ({
    text: el.textContent?.trim(),
    pressed: el.getAttribute('aria-pressed'),
  }))
  const statusMsg = await page.$eval('[data-testid="crossout-status"]', (el) => el.textContent?.trim())
  check('active toggle says Done crossing out with aria-pressed="true"', activeToggle.text?.includes('Done crossing out') && activeToggle.pressed === 'true')
  check('crossout-status says Tap an answer to cross it out.', statusMsg?.includes('Tap an answer to cross it out.'))

  // Cross out decoy option 1
  await page.click('[data-testid="option-1"]')
  await sleep(150)
  const struckCheck = await page.evaluate(() => {
    const opt = document.querySelector('[data-testid="option-1"]')?.closest('.opt')
    const mark = document.querySelector('[data-testid="struck-mark-1"]')
    const comp = opt ? getComputedStyle(opt) : null
    return {
      isStruckClass: opt?.classList.contains('struck') ?? false,
      markText: mark?.textContent?.trim() || '',
      borderDashed: comp?.borderStyle === 'dashed',
    }
  })
  check('crossed out option has struck class and visible Crossed out mark', struckCheck.isStruckClass && struckCheck.markText.includes('Crossed out'))
  check('crossed out option uses dashed border (distinguishable without color alone)', struckCheck.borderDashed)

  // Done crossing out
  await page.click('[data-testid="crossout-toggle"]')
  await sleep(150)
  const turnedOff = await page.evaluate(() => {
    const toggle = document.querySelector('[data-testid="crossout-toggle"]')
    const status = document.querySelector('[data-testid="crossout-status"]')
    return {
      text: toggle?.textContent?.trim(),
      pressed: toggle?.getAttribute('aria-pressed'),
      statusGone: status === null,
    }
  })
  check('toggle reverts to Cross out an answer and status disappears', turnedOff.text?.includes('Cross out an answer') && turnedOff.pressed === 'false' && turnedOff.statusGone)

  // Choose an answer and submit with mouse
  await page.click('[data-testid="option-0"]')
  await sleep(150)
  const isSel = await page.$eval('[data-testid="option-0"]', (el) => el.getAttribute('aria-pressed'))
  check('mouse clicking answer selects it', isSel === 'true')
  await page.click('[data-testid="lock-in"]')
  await page.waitForSelector('[data-testid="item-result"]', { timeout: 10000 })
  check('mouse lock-in completes the question and shows verdict', (await page.$('[data-testid="item-result"]')) !== null)

  // 4. Challenge mode omits crossing out instructions and controls
  await setToCaseItems(page, { caseId: '00-1', itemIndex: 0, settings: { helpLevel: 'challenge' } })
  const challengeCheck = await page.evaluate(() => {
    const toggle = document.querySelector('[data-testid="crossout-toggle"]')
    const status = document.querySelector('[data-testid="crossout-status"]')
    const kbd = document.querySelector('.kbd-hint')?.textContent || ''
    return {
      noToggle: toggle === null,
      noStatus: status === null,
      noCrossKbd: !kbd.includes('cross out') && !kbd.includes('eliminate'),
    }
  })
  check('challenge mode omits crossout-toggle', challengeCheck.noToggle)
  check('challenge mode omits crossout-status', challengeCheck.noStatus)
  check('challenge mode omits crossing out from keyboard hint', challengeCheck.noCrossKbd)

  // 5. Keyboard navigation: Tab to answer, Enter selects, Enter locks in; word marking with Space
  await setToCaseItems(page, { caseId: '00-1', itemIndex: 0, settings: { helpLevel: 'regular' } })

  // Focus a stem clue word and mark it with Space
  await page.focus('[data-testid="word-1"]')
  await page.keyboard.press('Space')
  await sleep(150)
  const wordTagged = await page.$eval('[data-testid="word-1"]', (el) => el.getAttribute('aria-pressed'))
  check('keyboard Space on clue word marks it', wordTagged === 'true')

  // Tab into options and choose with Enter
  await page.focus('[data-testid="option-1"]')
  await page.keyboard.press('Enter')
  await sleep(150)
  const kbdSel = await page.$eval('[data-testid="option-1"]', (el) => el.getAttribute('aria-pressed'))
  check('keyboard Enter on option selects it', kbdSel === 'true')

  // Press Enter again on the selected option to lock in
  await page.keyboard.press('Enter')
  await page.waitForSelector('[data-testid="item-result"]', { timeout: 10000 })
  check('keyboard Enter on selected option locks it in', (await page.$('[data-testid="item-result"]')) !== null)

  // 6. Touch emulation: completes an answer with touch
  await page.setViewport({ width: 1024, height: 768, deviceScaleFactor: 1, isMobile: true, hasTouch: true })
  await setToCaseItems(page, { caseId: '00-1', itemIndex: 0, settings: { helpLevel: 'regular' } })
  await page.tap('[data-testid="option-1"]')
  await sleep(150)
  await page.tap('[data-testid="lock-in"]')
  await page.waitForSelector('[data-testid="item-result"]', { timeout: 10000 })
  check('touch emulation completes answer and locks in', (await page.$('[data-testid="item-result"]')) !== null)

  // 7. Question two (data table) at 1024x768 with Extra large text and Loose spacing
  // Check evidence scrollport >= 240px, sticky headings remain available while scrolling, Lock in reachable
  await page.setViewport({ width: 1024, height: 768, deviceScaleFactor: 1, isMobile: false, hasTouch: false })
  await setToCaseItems(page, { caseId: '00-1', itemIndex: 1, settings: { textSize: 2, lineSpacing: 2, helpLevel: 'regular' } })

  // First-question guide must NOT appear on question two
  const q2Guide = await page.$('[data-testid="first-question-guide"]')
  check('first-question-guide does not appear on question two', q2Guide === null)

  const tableScrollport = await page.evaluate(() => {
    const tableWrap = document.querySelector('.table-wrap')
    const table = document.querySelector('[data-testid="item-table"]')
    const lock = document.querySelector('[data-testid="lock-in"]')?.getBoundingClientRect()
    const wrapRect = tableWrap?.getBoundingClientRect()
    const vh = window.innerHeight

    // Measure initial scrollport height
    const scrollportHeight = wrapRect ? wrapRect.height : 0

    // Scroll table-wrap down to verify sticky headings
    if (tableWrap) {
      tableWrap.scrollTop = 150
    }
    const ths = [...document.querySelectorAll('.data-table th')]
    const thRects = ths.map((th) => th.getBoundingClientRect())
    const headingsVisibleWhileScrolled = wrapRect && thRects.length > 0 && thRects.every(
      (r) => r.top >= wrapRect.top - 2 && r.bottom <= wrapRect.bottom && r.height > 0,
    )

    const lockReachable = lock ? lock.top >= 0 && lock.bottom <= vh && lock.height >= 40 : false

    return {
      scrollportHeight,
      hasTable: table !== null,
      headingsVisibleWhileScrolled,
      lockReachable,
      lockBottom: lock?.bottom,
      vh,
    }
  })

  check('evidence scrollport height is at least 240px', tableScrollport.scrollportHeight >= 240, `height=${tableScrollport.scrollportHeight}px`)
  check('data-table is present in question two', tableScrollport.hasTable)
  check('table column headings remain sticky and visible while scrolling', tableScrollport.headingsVisibleWhileScrolled)
  check('Lock in button remains reachable and inside viewport', tableScrollport.lockReachable, `bottom=${tableScrollport.lockBottom}px, vh=${tableScrollport.vh}px`)

  await page.screenshot({ path: `${SHOTS_DIR}/pr2-question2-table-1024x768-xl.png` })

  // 8. Reduced motion at 1366x768 and 1024x768
  for (const width of [1366, 1024]) {
    await page.setViewport({ width, height: 768, deviceScaleFactor: 1, isMobile: false, hasTouch: false })
    await setToCaseItems(page, { caseId: '00-1', itemIndex: 1, settings: { reducedMotion: true, textSize: 1, lineSpacing: 1 } })
    const rmCheck = await page.evaluate(() => {
      const lock = document.querySelector('[data-testid="lock-in"]')?.getBoundingClientRect()
      const wrap = document.querySelector('.table-wrap')?.getBoundingClientRect()
      const vh = window.innerHeight
      return {
        lockVisible: lock ? lock.top >= 0 && lock.bottom <= vh : false,
        wrapHeightOk: wrap ? wrap.height >= 240 : false,
      }
    })
    check(`reduced motion layout works at ${width}x768`, rmCheck.lockVisible && rmCheck.wrapHeightOk)
  }

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
