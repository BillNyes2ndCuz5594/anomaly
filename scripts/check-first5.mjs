// Headless puppeteer proof for first 5 cases and access gates.
// Serves built dist/ and asserts layout, scrolling, and access fixes.
// Usage: timeout 180 node scripts/check-first5.mjs
import { mkdirSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'
import { CONTENT, freePort, launch, profilePage, startPreview, toCaseStep } from './lib/drive.mjs'

const SHOTS_DIR = 'artifacts/first5'
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
  { label: 'normal-loose', textSize: 0, lineSpacing: 2 },
  { label: 'large-loose', textSize: 1, lineSpacing: 2 },
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

async function scrollRegion(targetPage, mode, selector) {
  const atEnd = () => targetPage.$eval(selector, (list) => list.scrollHeight - list.clientHeight - list.scrollTop <= 1)
  if (mode === 'keyboard') await targetPage.focus(selector)
  if (mode !== 'keyboard') {
    const point = await targetPage.$eval(selector, (list) => {
      const r = list.getBoundingClientRect()
      return { x: r.left + r.width / 2, top: r.top + r.height * 0.25, bottom: r.top + r.height * 0.75 }
    })
    if (mode === 'wheel') await targetPage.mouse.move(point.x, point.bottom)
    for (let i = 0; i < 24 && !(await atEnd()); i++) {
      if (mode === 'wheel') await targetPage.mouse.wheel({ deltaY: 180 })
      if (mode === 'touch') {
        const touch = await targetPage.touchscreen.touchStart(point.x, point.bottom)
        await touch.move(point.x, point.top)
        await touch.end()
      }
      await sleep(150)
    }
    return
  }
  for (let i = 0; i < 24 && !(await atEnd()); i++) {
    await targetPage.keyboard.press('PageDown')
    await sleep(150)
  }
}

// Exercise the real modal without navigating or replacing any case nodes.
async function checkCaseOptions(page, label, change = false) {
  await page.evaluate(() => {
    window.__optionsCase = document.querySelector('[data-testid="lab-generic"], [data-testid="item-player"], [data-testid="briefing"]')
    window.__optionsRoute = location.hash
    window.__optionsMixture = document.querySelector('[data-testid="lab-current-mixture"]')?.textContent
  })
  await page.focus('[data-testid="case-options"]')
  await page.keyboard.press('Enter')
  await page.waitForSelector('[data-testid="case-options-dialog"]')
  check(`Options has a labelled modal dialog: ${label}`, await page.$eval('[data-testid="case-options-dialog"]', (el) =>
    el.getAttribute('role') === 'dialog' && el.getAttribute('aria-modal') === 'true' &&
    document.getElementById(el.getAttribute('aria-labelledby'))?.textContent === 'Options'))
  // Done is last and receives initial focus. Tab wraps to the first control.
  await page.keyboard.press('Tab')
  check(`Tab wraps inside Options: ${label}`, await page.$eval('[data-testid="case-options-dialog"]', (el) => el.contains(document.activeElement)))
  check(`Tab reaches the checked help radio: ${label}`, await page.evaluate(() =>
    document.activeElement?.matches('[data-testid="help-level-picker"] input:checked')))
  await page.keyboard.press('Tab')
  check(`Tab reaches Text size: ${label}`, await page.$eval('[data-testid="case-text-size"]', (el) => el === document.activeElement))
  await page.keyboard.down('Shift')
  await page.keyboard.press('Tab')
  await page.keyboard.up('Shift')
  check(`Shift Tab returns to the checked help radio: ${label}`, await page.evaluate(() =>
    document.activeElement?.matches('[data-testid="help-level-picker"] input:checked')))
  await page.keyboard.down('Shift')
  await page.keyboard.press('Tab')
  await page.keyboard.up('Shift')
  check(`Shift Tab wraps to Done: ${label}`, await page.$eval('[data-testid="case-options-close"]', (el) => el === document.activeElement))
  if (change) {
    await page.select('[data-testid="case-text-size"]', '2')
    await page.select('[data-testid="case-line-spacing"]', '2')
    await page.click('[data-testid="case-sound"]')
    await page.focus('[data-testid="case-volume"]')
    await page.keyboard.press('Home')
    await page.keyboard.press('ArrowRight')
    check(`reading and sound persist immediately: ${label}`, await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('anomaly.v1')).state.settings
      return s.textSize === 2 && s.lineSpacing === 2 && !s.sound && s.soundVolume === 0.05 &&
        document.documentElement.style.getPropertyValue('--text-scale') === '1.3'
    }))
  }
  const layout = await page.$eval('[data-testid="case-options-dialog"]', (el) => {
    const r = el.getBoundingClientRect()
    const targets = [...el.querySelectorAll('select, .toggle, .range, button, .help-level-option')]
    return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight &&
      el.scrollWidth <= el.clientWidth && targets.every((t) => t.getBoundingClientRect().height >= 44)
  })
  check(`Options fits with 44px targets: ${label}`, layout)
  await page.keyboard.press('Escape')
  await page.waitForSelector('[data-testid="case-options-dialog"]', { hidden: true })
  check(`Escape restores Options focus and keeps the case mounted: ${label}`, await page.evaluate(() =>
    document.activeElement?.getAttribute('data-testid') === 'case-options' &&
    window.__optionsCase?.isConnected && location.hash === window.__optionsRoute &&
    document.querySelector('[data-testid="lab-current-mixture"]')?.textContent === window.__optionsMixture))
}

const port = await freePort()
const { proc, base } = await startPreview(port)
const browser = await launch()

// PR 7: Local adult launch path and optional practice remain keyboard usable.
async function tabTo(page, selector) {
  for (let i = 0; i < 180; i++) {
    await page.keyboard.press('Tab')
    if (await page.$eval(selector, (el) => el === document.activeElement)) return true
  }
  return false
}

async function checkLaunchGuide() {
  for (const width of [1366, 1024]) {
    const page = await browser.newPage()
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    page.on('pageerror', (e) => errors.push(e.message))
    await page.setViewport({ width, height: 768 })
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
    await page.goto(base + '?tier=low#/', { waitUntil: 'load' })
    await page.waitForSelector('[data-testid="teacher-link"]')
    check(`title adult link reachable by Tab (${width})`, await tabTo(page, '[data-testid="teacher-link"]'))
    check(`adult link stays local (${width})`, await page.$eval('[data-testid="teacher-link"]', (el) => el.getAttribute('href') === './teacher.html'))
    await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), page.keyboard.press('Enter')])
    await page.waitForSelector('[data-testid="launch-guide"]')
    check(`Teacher HQ opens locally (${width})`, page.url() === base + 'teacher.html')
    const guide = await page.$eval('[data-testid="shift-explainer"]', (el) => el.textContent)
    check(`launch guide covers class and home (${width})`, guide.includes('Your first 10 to 15 minute shift') && guide.includes('different roster number') && guide.includes("student's Results code") && guide.includes('without Canvas'))
    const accuracyText = 'Percent of practice answers correct. It is not a diagnostic score or a daily mastery rating. Science stages grow as students revisit cases across days.'
    check(`empty state explains practice accuracy (${width})`, await page.evaluate((text) => document.body.textContent.includes('Practice accuracy') && document.body.textContent.includes(text) && !document.body.textContent.includes('Average mastery'), accuracyText))
    // Ignore offline precaching and inspect scripts actually loaded by Teacher HQ.
    check(`teacher loads no 3D scripts (${width})`, await page.evaluate(() => !performance.getEntriesByType('resource').some((r) => /three|Stage|Scene/i.test(r.name) && r.initiatorType === 'script')))
    check(`sample control reachable by Tab (${width})`, await tabTo(page, '[data-testid="load-sample"]'))
    await page.keyboard.press('Enter')
    await page.waitForSelector('[data-testid="stat-average"]')
    check(`sample shows practice accuracy (${width})`, (await page.$eval('[data-testid="stat-average"]', (el) => el.textContent)).includes('Practice accuracy'))
    check(`teacher has no horizontal overflow (${width})`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    check(`sample keeps accuracy explanation (${width})`, await page.evaluate((text) => document.body.textContent.includes(text), accuracyText))
    check(`Play the game reachable by Tab (${width})`, await tabTo(page, '[data-testid="play-game"]'))
    await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), page.keyboard.press('Enter')])
    await page.waitForSelector('[data-testid="title"]')
    check(`Play the game returns locally (${width})`, new URL(page.url()).pathname === new URL(base).pathname)
    await page.close()

    const hub = await profilePage(browser, base, '?tier=low', { width, height: 768 }, errors)
    await hub.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
    await hub.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem('anomaly.v1'))
      raw.state.lastCaseId = '02-2'
      raw.state.paints = ['Sky', 'Orange']
      raw.state.activePaint = null
      raw.state.settings.reducedMotion = true
      localStorage.setItem('anomaly.v1', JSON.stringify(raw))
    })
    await hub.reload({ waitUntil: 'load' })
    await hub.waitForSelector('[data-testid="drone-paint-picker"]')
    check(`keyboard reaches Sky swatch (${width})`, await tabTo(hub, '[data-testid="drone-paint-sky"]'))
    check(`keyboard reaches Orange swatch (${width})`, await tabTo(hub, '[data-testid="drone-paint-orange"]'))
    await hub.keyboard.press('Enter')
    check(`Orange swatch selected with noncolor marker and locked paints hidden (${width})`, await hub.evaluate(() => {
      const sky = document.querySelector('[data-testid="drone-paint-sky"]')
      const orange = document.querySelector('[data-testid="drone-paint-orange"]')
      const locked = document.querySelector('[data-testid="drone-paint-bluish-green"]')
      const marker = document.querySelector('[data-testid="drone-paint-marker-orange"]')
      return sky?.getAttribute('aria-pressed') === 'false' &&
        orange?.getAttribute('aria-pressed') === 'true' &&
        orange?.textContent?.includes('Orange') &&
        marker?.textContent?.includes('Active') &&
        !locked
    }))
    await hub.reload({ waitUntil: 'load' })
    await hub.waitForSelector('[data-testid="hub"]')
    check(`Orange paint survives reload in reduced motion 2D fallback without panel overflow (${width})`, await hub.evaluate(() => {
      const orange = document.querySelector('[data-testid="drone-paint-orange"]')
      const picker = document.querySelector('[data-testid="drone-paint-picker"]')
      const panel = document.querySelector('.hub-panel')
      const saved = JSON.parse(localStorage.getItem('anomaly.v1') || '{}')?.state?.activePaint
      return orange?.getAttribute('aria-pressed') === 'true' &&
        picker?.getAttribute('data-active-paint') === 'orange' &&
        saved === 'Orange' &&
        document.documentElement.dataset.reducedMotion === 'true' &&
        document.documentElement.dataset.tier === 'low' &&
        !!panel && panel.scrollWidth <= panel.clientWidth
    }))
    check(`hub keeps remembered case and Start case (${width})`, await hub.$eval('[data-testid="hub-quick-play"]', (el) => el.querySelector('.qp-kicker').textContent === 'Start case' && el.querySelector('.qp-title').textContent.includes('Unit 4')))
    check(`hub keeps Unit 4 first and science progress (${width})`, await hub.evaluate(() => {
      const current = document.querySelector('[data-testid="current-unit"]')
      const other = document.querySelector('[data-testid="other-units"]')
      return !!(current.compareDocumentPosition(other) & Node.DOCUMENT_POSITION_FOLLOWING) && document.body.textContent.includes('Your science progress')
    }))
    check(`optional practice grouped with rules (${width})`, await hub.$eval('[aria-label="More ways to practice"]', (el) => ['More ways to practice', 'Optional question practice with a different play style.', 'Defenses last one wave.', 'Correct answer lowers instability by 2.'].every((text) => el.textContent.includes(text))))
    for (const id of ['hub-quick-play', 'gold-rush-launch', 'containment-launch', 'reactor-launch']) {
      check(`keyboard reaches ${id} (${width})`, await tabTo(hub, `[data-testid="${id}"]`))
      check(`focused ${id} fits viewport (${width})`, await hub.$eval(`[data-testid="${id}"]`, (el) => {
        const r = el.getBoundingClientRect()
        return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight
      }))
    }
    check(`hub has no horizontal overflow (${width})`, await hub.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    await hub.close()
  }
}

try {
  await checkLaunchGuide()
  const initialVp = VIEWPORTS[0]
  const page = await profilePage(browser, base, '?tier=low', { width: initialVp.width, height: initialVp.height }, errors)
  await toCaseStep(page, 'briefing')
  await page.waitForSelector('[data-testid="briefing"]')

  // 1. Both the existing case and the real Unit 4 hub entry use the full matrix.
  for (const caseId of ['03-1', '04-1']) {
    if (caseId === '04-1') {
      await page.focus('[data-testid="back-to-hub-top"]')
      await page.keyboard.press('Enter')
      await page.waitForFunction(() => {
        const el = document.querySelector('[data-testid="case-marker-04-1"]')
        el?.focus()
        return !!el && document.activeElement === el
      })
      await page.keyboard.press('Enter')
      await page.waitForSelector('[data-testid="briefing"]')
      check('Unit 4 hub entry opens its briefing', await page.evaluate(() => location.hash === '#/case/04-1'))
    }
    // Acceptance check across all 4 viewports and text/spacing settings:
    // Both action rectangles are fully inside the viewport without initial scrolling.
    for (const vp of VIEWPORTS) {
      if (vp.mobile) {
        await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 1, isMobile: true, hasTouch: true })
      } else {
        await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 1, isMobile: false, hasTouch: true })
      }

      for (const st of SETTINGS) {
        await setGameSettings(page, { textSize: st.textSize, lineSpacing: st.lineSpacing })
        await page.waitForSelector('[data-testid="briefing"]')
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
          `actions visible in ${caseId} at ${vp.name} (${st.label})`,
          raOk && contOk,
          `ra bottom: ${bounds.ra?.bottom}px, cont bottom: ${bounds.cont?.bottom}px, vh: ${bounds.vh}px`,
        )

        // Reset only to the start. Each method must reach the end with real input.
        for (const mode of (vp.width === 1024 || st.label === 'extra-large-loose' ? ['wheel', 'touch', 'keyboard'] : [])) {
          await page.$eval('[data-testid="briefing-story"]', (story) => { story.scrollTop = 0 })
          await scrollRegion(page, mode, '[data-testid="briefing-story"]')
          const end = await page.evaluate(() => {
            const story = document.querySelector('[data-testid="briefing-story"]')
            const last = story.querySelectorAll('.rw')
            // Use a Range so the full final word, including wrapped text, must fit.
            const range = document.createRange()
            range.selectNodeContents(last[last.length - 1])
            const rects = [...range.getClientRects()]
            const footer = document.querySelector('[data-testid="briefing-actions"]').getBoundingClientRect()
            const buttons = ['read-aloud', 'briefing-continue'].map((id) => document.querySelector(`[data-testid="${id}"]`).getBoundingClientRect())
            let top = 0, bottom = Math.min(innerHeight, footer.top), left = 0, right = innerWidth
            for (let el = story; el; el = el.parentElement) {
              const r = el.getBoundingClientRect()
              const style = getComputedStyle(el)
              if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) {
                top = Math.max(top, r.top + el.clientTop)
                bottom = Math.min(bottom, r.top + el.clientTop + el.clientHeight)
              }
              if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) {
                left = Math.max(left, r.left + el.clientLeft)
                right = Math.min(right, r.left + el.clientLeft + el.clientWidth)
              }
            }
            const fits = (r) => r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth
            return {
              atEnd: story.scrollHeight - story.clientHeight - story.scrollTop <= 1,
              wordVisible: rects.length > 0 && rects.every((r) => r.width > 0 && r.height > 0 && r.top >= top && r.bottom <= bottom && r.left >= left && r.right <= right),
              actionsVisible: fits(footer) && buttons.every(fits),
              detail: `word=${last[last.length - 1]?.textContent.trim()}, bottom=${rects.at(-1)?.bottom}, clip=${top}..${bottom}, scroll=${story.scrollTop}/${story.scrollHeight - story.clientHeight}`,
            }
          })
          check(`${mode} reaches the full final word above the footer: ${caseId}, ${vp.name}, ${st.label}`, end.atEnd && end.wordVisible && end.actionsVisible, end.detail)
        }

        if (st.label === 'extra-large-loose') {
          await page.screenshot({ path: `${SHOTS_DIR}/pr1-briefing-${vp.name}-${st.label}.png` })
        }
      }
    }
  }

  // Keep the remaining keyboard flow on the original case. A generic briefing
  // selector can still match Unit 4 while the route transition is committing.
  await toCaseStep(page, 'briefing')
  await page.waitForFunction(() => document.querySelector('.dispatch-title')?.textContent?.startsWith('CASE 03-1 '))
  await page.setViewport({ width: 1024, height: 768, deviceScaleFactor: 1, isMobile: false, hasTouch: false })

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
  check('Tab reaches case Options beside Hub', await page.evaluate(() => document.activeElement?.getAttribute('data-testid') === 'case-options'))
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
      // Checkpoints are owned by an agent (see caseResumeOwner): stamp it the way the game does.
      const prof = raw?.state?.profile
      const owner = prof
        ? `${String(prof.classCode).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)}|${Math.min(40, Math.max(1, Math.round(prof.agentNumber)))}`
        : 'none'
      sessionStorage.setItem(`anomaly.case.case.${caseId}`, JSON.stringify({
        v: 1,
        owner,
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

  // Options also works when title Play starts a case without visiting Hub.
  await page.evaluate(() => {
    // Start fresh rather than resuming the lab reached by the earlier keyboard check.
    for (const key of Object.keys(sessionStorage)) if (key.startsWith('anomaly.case.')) sessionStorage.removeItem(key)
    location.hash = '#/'
  })
  await page.waitForSelector('[data-testid="title-quick-play"]')
  await page.click('[data-testid="title-quick-play"]')
  await page.waitForSelector('[data-testid="briefing"]')
  await checkCaseOptions(page, 'title Play')

  // A displayed question snapshots help rules. Only the next question changes.
  await setToCaseItems(page, { settings: { helpLevel: 'regular', textSize: 0, lineSpacing: 0 } })
  // Keys on Done must not select answers, toggle crossing out, or spend hints and Intel.
  const questionState = () => page.evaluate(() => JSON.stringify({
    options: document.querySelector('.options')?.innerHTML,
    crossout: document.querySelector('[data-testid="crossout-toggle"]')?.outerHTML,
    status: document.querySelector('[data-testid="crossout-status"]')?.textContent,
    dispatch: document.querySelector('[data-testid="dispatch-msg"]')?.textContent,
    chips: [...document.querySelectorAll('[data-lit]')].map((el) => el.outerHTML),
  }))
  for (const crossingOut of [false, true]) {
    if (crossingOut) await page.click('[data-testid="crossout-toggle"]')
    const before = await questionState()
    await page.click('[data-testid="case-options"]')
    await page.waitForSelector('[data-testid="case-options-dialog"]')
    await page.focus('[data-testid="case-options-close"]')
    for (const key of ['2', 'b', 'x', '1', 'x', '3']) await page.keyboard.press(key)
    await page.keyboard.press('Escape')
    check(`Options blocks question shortcuts with crossing out ${crossingOut}`, before === await questionState())
  }
  await page.click('[data-testid="crossout-toggle"]')
  await checkCaseOptions(page, 'Regular question')
  await page.click('[data-testid="case-options"]')
  await page.click('[data-testid="help-level-challenge"]')
  await page.keyboard.press('Escape')
  check('changing help leaves the displayed question unchanged', !!(await page.$('[data-testid="crossout-toggle"]')))
  await page.click('[data-testid="option-0"]')
  await page.click('[data-testid="lock-in"]')
  await page.waitForSelector('[data-testid="next-item"]')
  await page.click('[data-testid="next-item"]')
  await page.waitForFunction(() => !document.querySelector('[data-testid="crossout-toggle"]'))
  check('next question uses the new help level', !(await page.$('[data-testid="crossout-toggle"]')))

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

  // 7b. Real input: wheel the evidence column until the last table row is fully on screen, then check headings follow.
  const mainBox = await page.$eval('.item-main .panel', (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 40 } })
  await page.mouse.move(mainBox.x, mainBox.y)
  for (let i = 0; i < 30; i++) {
    await page.mouse.wheel({ deltaY: 120 })
    await new Promise((r) => setTimeout(r, 30))
  }
  const lastRow = await page.evaluate(() => {
    const main = document.querySelector('.item-main')?.getBoundingClientRect()
    const rows = document.querySelectorAll('.data-table tbody tr')
    const r = rows[rows.length - 1]?.getBoundingClientRect()
    const th = document.querySelector('.data-table th')?.getBoundingClientRect()
    if (!main || !r) return { ok: false, detail: 'missing table' }
    const top = Math.max(main.top, 0)
    const bottom = Math.min(main.bottom, window.innerHeight)
    return { ok: r.top >= top - 1 && r.bottom <= bottom + 1, headOk: !!th && th.bottom > top && th.top < bottom, detail: `row=${Math.round(r.top)}..${Math.round(r.bottom)} clip=${Math.round(top)}..${Math.round(bottom)}` }
  })
  check('wheel scrolling reaches the whole last table row inside its clipping ancestors', lastRow.ok, lastRow.detail)
  check('table column headings stay on screen after wheel scrolling', lastRow.headOk)

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

  // 9. Portrait tablet hub: the scroll cue is visible and the final mission controls can all be reached.
  await page.setViewport({ width: 810, height: 1080, deviceScaleFactor: 1, isMobile: true, hasTouch: true })
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('anomaly.v1') || '{}')
    if (raw?.state) {
      raw.state.settings = { ...raw.state.settings, textSize: 0, lineSpacing: 0 }
      localStorage.setItem('anomaly.v1', JSON.stringify(raw))
    }
    location.hash = '#/hub'
  })
  await page.reload({ waitUntil: 'load' })
  await page.waitForSelector('[data-testid="hub"]')
  await sleep(500)
  const fade = await page.evaluate(() => {
    const panel = document.querySelector('.hub-panel')
    const cue = document.querySelector('.hub-scroll-fade')
    return panel?.getAttribute('data-more-below') === 'true' && cue && getComputedStyle(cue).display !== 'none'
  })
  check('portrait hub shows a fade when more missions are below', !!fade)
  await page.screenshot({ path: `${SHOTS_DIR}/pr12-hub-810x1080.png` })
  await page.evaluate(() => {
    const cells = [...document.querySelectorAll('[data-testid="other-units"] .case-cell')]
    cells.at(-1)?.scrollIntoView({ block: 'start' })
  })
  await sleep(200)
  const hubReach = await page.evaluate(() => {
    const panel = document.querySelector('.hub-panel')
    const cells = [...document.querySelectorAll('[data-testid="other-units"] .case-cell')]
    const last = cells.at(-1)
    const card = last?.querySelector('.case-btn')
    const standards = last?.querySelector('.case-standards summary')
    const cold = document.querySelector('[data-testid="cold-marker"]')
    const coldCode = cold?.querySelector('.case-code')
    const p = panel?.getBoundingClientRect()
    const inside = (el) => {
      const r = el?.getBoundingClientRect()
      return !!r && !!p && r.top >= p.top - 1 && r.bottom <= p.bottom + 1 && r.left >= p.left - 1 && r.right <= p.right + 1 && r.bottom <= innerHeight
    }
    return {
      card: inside(card),
      standards: inside(standards),
      cold: inside(coldCode),
      coldFits: !!cold && !!coldCode && cold.scrollWidth <= cold.clientWidth + 1 && coldCode.scrollWidth <= coldCode.clientWidth + 1,
    }
  })
  check('last unit card, Standards and Cold Case label are fully reachable at 810x1080', Object.values(hubReach).every(Boolean), JSON.stringify(hubReach))
  await page.screenshot({ path: `${SHOTS_DIR}/pr12-hub-810x1080-reached.png` })

  await page.close()

  // =========================================================================
  // PR 3: Make the first lab task visible, readable, and fully spoken
  // =========================================================================

  async function installSpeechProbe(targetPage) {
    await targetPage.evaluate(() => {
      const calls = []
      const synth = {
        speaking: false,
        pending: false,
        cancel() {
          calls.push({ type: 'cancel' })
          this.speaking = false
        },
        getVoices() {
          return [
            { name: 'Remote English', lang: 'en-US', localService: false },
            { name: 'Local English', lang: 'en-GB', localService: true },
          ]
        },
        speak(u) {
          calls.push({ type: 'speak', text: u.text, voice: u.voice?.name, local: u.voice?.localService })
          this.speaking = true
          u.onstart?.({})
        },
      }
      class SpeechProbeUtterance {
        constructor(text) {
          this.text = text
          this.rate = 1
          this.voice = null
          this.onstart = null
          this.onboundary = null
          this.onend = null
          this.onerror = null
        }
      }
      Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true })
      Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: SpeechProbeUtterance, configurable: true })
      window.__labSpeechCalls = calls
    })
  }

  async function openSolventLab(targetPage) {
    await targetPage.evaluate(() => { location.hash = '#/case/04-1' })
    await targetPage.waitForSelector('[data-testid="briefing"]', { timeout: 15000 })
    await sleep(500)
    await targetPage.click('[data-testid="briefing-continue"]')
    await targetPage.waitForSelector('[data-testid="lab-generic"][data-kind="match"]', { timeout: 15000 })
    await sleep(700)
  }

  function labVisibility() {
    const fullyVisible = (el) => {
      if (!el) return false
      const r = el.getBoundingClientRect()
      const clip = { top: 0, right: innerWidth, bottom: innerHeight, left: 0 }
      for (let parent = el.parentElement; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent)
        const p = parent.getBoundingClientRect()
        if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) {
          clip.top = Math.max(clip.top, p.top + parent.clientTop)
          clip.bottom = Math.min(clip.bottom, p.top + parent.clientTop + parent.clientHeight)
        }
        if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) {
          clip.left = Math.max(clip.left, p.left + parent.clientLeft)
          clip.right = Math.min(clip.right, p.left + parent.clientLeft + parent.clientWidth)
        }
      }
      return r.width > 0 && r.height > 0 && r.top >= clip.top - 1 && r.right <= clip.right + 1 && r.bottom <= clip.bottom + 1 && r.left >= clip.left - 1
    }
    const list = document.querySelector('[data-testid="lab-tool-list"]')
    const tools = [...document.querySelectorAll('[data-testid^="lab-right-"]')]
    const descriptions = [...document.querySelectorAll('[data-testid^="lab-right-"] .target-sub')]
    const heights = tools.map((el) => el.getBoundingClientRect().height)
    const more = document.querySelector('.lab-more-tools')
    const last = document.querySelector('[data-testid="lab-right-water-filter"]')
    const lastRect = last?.getBoundingClientRect()
    const hit = lastRect && document.elementFromPoint(lastRect.left + lastRect.width / 2, lastRect.top + lastRect.height / 2)
    const hiddenBelow = !!list && list.scrollHeight - list.clientHeight - list.scrollTop > 1
    return {
      count: tools.length,
      minDescription: Math.min(...descriptions.map((el) => parseFloat(getComputedStyle(el).fontSize))),
      minTargetWidth: Math.min(...tools.map((el) => el.getBoundingClientRect().width)),
      minTargetHeight: Math.min(...heights),
      maxChoiceHeight: Math.max(...heights),
      choiceFits: !!list && list.clientHeight >= Math.max(...heights),
      textFits: tools.every((el) => el.scrollHeight <= el.clientHeight + 1),
      columns: list ? getComputedStyle(list).gridTemplateColumns.split(' ').length : 0,
      overflow: !!list && list.scrollHeight > list.clientHeight + 1,
      hiddenBelow,
      more: !!more,
      moreVisible: !!more && fullyVisible(more),
      listVisible: fullyVisible(list),
      allVisible: tools.every(fullyVisible),
      lastVisible: fullyVisible(last),
      actionable: !!last && !last.disabled && fullyVisible(last) && (hit === last || last.contains(hit)),
      atEnd: !!list && !hiddenBelow,
      listHeight: list?.clientHeight ?? 0,
      current: document.querySelector('[data-testid="lab-current-mixture"]')?.textContent || '',
      feedback: document.querySelector('[data-testid="lab-feedback"]')?.textContent || '',
      task: document.querySelector('.lab-task-copy')?.textContent || '',
      icons: document.querySelectorAll('[data-testid="lab-tool-list"] img').length,
      detail: `scroll=${list?.scrollTop}/${list?.scrollHeight}, client=${list?.clientHeight}, last=${lastRect?.top}..${lastRect?.bottom}`,
    }
  }

  async function labLayout(targetPage, name, mode = 'wheel') {
    await targetPage.waitForSelector('[data-testid="lab-tool-list"]', { timeout: 15000 })
    await targetPage.waitForFunction(() => {
      const list = document.querySelector('[data-testid="lab-tool-list"]')
      const hidden = !!list && list.scrollHeight - list.clientHeight - list.scrollTop > 1
      return !!list && hidden === !!document.querySelector('.lab-more-tools')
    }, { timeout: 3000 }).catch(() => {})
    // Growing text may move the list below the panel fold. Reach it using
    // real input on the panel padding, then exercise the inner choice list.
    if (mode === 'keyboard') await targetPage.focus('[data-testid="lab-tool-list"]')
    for (let i = 0; i < 16; i++) {
      const panel = await targetPage.$eval('.side-panel', (el) => {
        const r = el.getBoundingClientRect()
        return { x: r.left + 4, top: r.top + 40, bottom: r.bottom - 40, end: el.scrollTop + el.clientHeight >= el.scrollHeight - 1 }
      })
      if (panel.end || mode === 'keyboard') break
      if (mode === 'touch') {
        const touch = await targetPage.touchscreen.touchStart(panel.x, panel.bottom)
        await touch.move(panel.x, panel.top)
        await touch.end()
      } else {
        await targetPage.mouse.move(panel.x, panel.bottom)
        await targetPage.mouse.wheel({ deltaY: 240 })
      }
      await sleep(100)
    }
    const report = await targetPage.evaluate(labVisibility)
    await scrollRegion(targetPage, mode, '[data-testid="lab-tool-list"]')
    await targetPage.waitForFunction(() => {
      const list = document.querySelector('[data-testid="lab-tool-list"]')
      return !!list && list.scrollHeight - list.clientHeight - list.scrollTop <= 1 && !document.querySelector('.lab-more-tools')
    }, { timeout: 3000 }).catch(() => {})
    const end = await targetPage.evaluate(labVisibility)
    return { ...report, lastVisible: end.lastVisible, actionable: end.actionable, atEnd: end.atEnd, endMore: end.more, endDetail: end.detail, name }
  }

  async function setLabSettings(targetPage, settings) {
    await targetPage.evaluate((s) => {
      const raw = JSON.parse(localStorage.getItem('anomaly.v1') || '{}')
      if (raw?.state) {
        raw.state.settings = { ...raw.state.settings, ...s }
        localStorage.setItem('anomaly.v1', JSON.stringify(raw))
      }
    }, settings)
    await targetPage.reload({ waitUntil: 'load' })
    await targetPage.waitForSelector('[data-testid="lab-generic"][data-kind="match"]', { timeout: 15000 })
    await sleep(400)
  }

  const labPage = await profilePage(browser, base, '?tier=low', { width: 810, height: 1080 }, errors)
  await installSpeechProbe(labPage)
  await openSolventLab(labPage)

  await labPage.click('[data-testid="read-aloud-lab"]')
  await sleep(120)
  const initialSpeech = await labPage.evaluate(() => {
    const calls = window.__labSpeechCalls || []
    return [...calls].reverse().find((call) => call.type === 'speak')
  })
  const expectedSpeech = [
    'The warehouse bins are all mixed up!',
    'Choose a tool for the mixture shown. Tap a tool name below.',
    'A correct match moves to the next mixture on its own.',
    'Iron filings and sand',
    'Gray metal bits mixed into beach sand',
    'Hold a magnet over it',
    'Pulls on anything made of iron',
    'Shake it through a screen',
    'Small pieces fall through the holes',
    'Pick them out by color',
    'Sort by what you see',
    'Tilt the tray',
    'Round things roll, flat sides stay put',
    'Add water, then pour through a filter',
    'One part dissolves and flows through',
    'Which card does this one go with?',
  ]
  check('lab read aloud contains the visible task and every tool', !!initialSpeech && expectedSpeech.every((text) => initialSpeech.text.includes(text)))
  check('lab read aloud chooses a local English voice', initialSpeech?.voice === 'Local English' && initialSpeech?.local === true)

  for (const st of [
    { label: 'normal', textSize: 0, lineSpacing: 0 },
    { label: 'Extra large Loose', textSize: 2, lineSpacing: 2 },
  ]) {
    for (const vp of [
      { name: '810x1080', width: 810, height: 1080 },
      { name: '1920x1080', width: 1920, height: 1080 },
      { name: '1366x768', width: 1366, height: 768 },
      { name: '1024x768', width: 1024, height: 768 },
    ]) {
      await labPage.setViewport({ ...vp, deviceScaleFactor: 1, isMobile: false, hasTouch: false })
      await setLabSettings(labPage, { textSize: st.textSize, lineSpacing: st.lineSpacing })
      if (st.textSize === 2) {
        await labPage.evaluate(() => Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: undefined }))
        await labPage.click('[data-testid="read-aloud-lab"]')
        await labPage.waitForSelector('[data-testid="read-aloud-unavailable"]')
      }
      const report = await labLayout(labPage, `${vp.name}, ${st.label}`)
      check(
        `lab tools are readable at ${report.name}`,
        report.count === 5 && report.minDescription >= 16 && report.minTargetWidth >= 44 && report.minTargetHeight >= 44 && report.textFits,
        `description=${report.minDescription}px, target=${report.minTargetWidth}x${report.minTargetHeight}px`,
      )
      check(
        `reachable choices and overflow label clear their clipping ancestors at ${report.name}`,
        report.listVisible && report.choiceFits && report.hiddenBelow === report.more && (report.overflow ? report.moreVisible : report.allVisible),
        `scrollport=${report.listHeight}px, choice=${report.maxChoiceHeight}px, overflow=${report.overflow}, more=${report.more}`,
      )
      check(`wheel reveals an actionable last choice at ${report.name}`, report.lastVisible && report.actionable && report.atEnd && !report.endMore, report.endDetail)
      check(`lab task and current mixture are identifiable at ${report.name}`,
        report.current.includes('Iron filings and sand') && report.task.includes('Choose a tool for the mixture shown.') && report.icons === 0)
      if (vp.name === '810x1080') check(`tablet lab uses two columns at ${report.name}`, report.columns === 2, `columns=${report.columns}`)
      if (vp.name === '1920x1080' && st.textSize === 0) await labPage.screenshot({ path: `${SHOTS_DIR}/pr3-lab-1920x1080.png` })
    }
  }

  for (const vp of [{ width: 810, height: 1080 }, { width: 1024, height: 768 }, { width: 1366, height: 768 }]) for (const mode of ['wheel', 'touch', 'keyboard']) {
    await labPage.setViewport({ ...vp, deviceScaleFactor: 1, isMobile: false, hasTouch: mode === 'touch' })
    await setLabSettings(labPage, { textSize: 2, lineSpacing: 2 })
    const report = await labLayout(labPage, `${vp.width}x${vp.height}, ${mode} activation`, mode)
    if (mode === 'wheel') await labPage.click('[data-testid="lab-right-water-filter"]')
    if (mode === 'touch') await labPage.tap('[data-testid="lab-right-water-filter"]')
    if (mode === 'keyboard') {
      await labPage.focus('[data-testid="lab-right-water-filter"]')
      await labPage.keyboard.press('Enter')
    }
    await labPage.waitForFunction(() => document.querySelector('[data-testid="lab-feedback"]')?.getAttribute('data-ok') === 'no')
    check(`${mode} reveals and activates the last tool at ${vp.width}x${vp.height}, Extra large Loose`, report.lastVisible && report.actionable && report.atEnd && !report.endMore, report.endDetail)
    if (mode === 'touch') await labPage.screenshot({ path: `${SHOTS_DIR}/pr3-lab-810x1080.png` })
  }

  await labPage.setViewport({ width: 810, height: 1080, deviceScaleFactor: 1, isMobile: false, hasTouch: false })
  await setLabSettings(labPage, { textSize: 0, lineSpacing: 0 })
  await installSpeechProbe(labPage)
  await sleep(500)
  await labPage.click('[data-testid="read-aloud-lab"]')
  await sleep(100)
  const beforeAdvance = await labPage.evaluate(() => (window.__labSpeechCalls || []).length)
  await labPage.click('[data-testid="lab-right-magnet"]')
  await labPage.waitForFunction(() => document.querySelector('[data-testid="lab-feedback"]')?.getAttribute('data-ok') === 'yes')
  check('mouse completes a mixture match', (await labPage.$eval('[data-testid="lab-current-mixture"]', (el) => el.textContent))?.includes('Gravel and sand'))
  const cancelOnAdvance = await labPage.evaluate((before) => (window.__labSpeechCalls || []).slice(before).some((call) => call.type === 'cancel'), beforeAdvance)
  check('card advance cancels stale speech immediately', cancelOnAdvance)
  await labPage.click('[data-testid="read-aloud-lab"]')
  await sleep(120)
  const advanceSpeech = await labPage.evaluate((before) => (window.__labSpeechCalls || []).slice(before).find((call) => call.type === 'speak' && call.text.includes('Gravel and sand')), beforeAdvance)
  check('advanced speech names the new mixture and current hint', !!advanceSpeech && advanceSpeech.text.includes('A magnet attracts the iron bits'))

  for (const vp of [{ width: 1920, height: 1080 }, { width: 1366, height: 768 }, { width: 1024, height: 768 }]) {
    await labPage.setViewport({ ...vp, deviceScaleFactor: 1, isMobile: false, hasTouch: false })
    const report = await labLayout(labPage, `${vp.width}x${vp.height}`)
    check(`selected mixture and feedback stay identifiable at ${vp.width}x${vp.height}`,
      report.current.includes('Gravel and sand') && report.feedback.includes('Correct') && report.minDescription >= 16)
  }

  for (const vp of VIEWPORTS.slice(1)) {
    await labPage.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 1, isMobile: false, hasTouch: false })
    await checkCaseOptions(labPage, vp.name, vp.name === '1366x768')
    check(`first lab match survives Options: ${vp.name}`, (await labPage.$eval('[data-testid="lab-current-mixture"]', (el) => el.textContent)).includes('Gravel and sand'))
  }

  await labPage.setViewport({ width: 810, height: 1080, deviceScaleFactor: 1, isMobile: false, hasTouch: false })
  await sleep(500)
  await labPage.tap('[data-testid="lab-right-screen"]')
  await labPage.waitForFunction(() => document.querySelector('[data-testid="lab-current-mixture"]')?.textContent?.includes('Red and blue beads'))
  check('touch completes a mixture match', (await labPage.$eval('[data-testid="lab-feedback"]', (el) => el.getAttribute('data-ok'))) === 'yes')

  await sleep(500)
  await labPage.focus('[data-testid="lab-right-by-color"]')
  await labPage.keyboard.press('Enter')
  await labPage.waitForFunction(() => document.querySelector('[data-testid="lab-current-mixture"]')?.textContent?.includes('Marbles and wooden cubes'))
  check('keyboard completes a mixture match', (await labPage.$eval('[data-testid="lab-feedback"]', (el) => el.getAttribute('data-ok'))) === 'yes')

  await labPage.evaluate(() => {
    const key = 'anomaly.case.case.04-1'
    const checkpoint = JSON.parse(sessionStorage.getItem(key))
    sessionStorage.setItem(key, JSON.stringify({ ...checkpoint, lab: null }))
    const raw = JSON.parse(localStorage.getItem('anomaly.v1') || '{}')
    if (raw?.state) {
      raw.state.settings = { ...raw.state.settings, reducedMotion: true }
      localStorage.setItem('anomaly.v1', JSON.stringify(raw))
    }
  })
  await labPage.reload({ waitUntil: 'load' })
  await labPage.waitForSelector('[data-testid="lab-generic"][data-kind="match"]', { timeout: 15000 })
  await installSpeechProbe(labPage)
  await sleep(500)
  check('reduced motion keeps the lab available', await labPage.evaluate(() => document.documentElement.dataset.reducedMotion === 'true'))
  await labPage.click('[data-testid="read-aloud-lab"]')
  await sleep(500)
  await labPage.click('[data-testid="lab-right-magnet"]')
  await labPage.waitForFunction(() => document.querySelector('[data-testid="lab-feedback"]')?.getAttribute('data-ok') === 'yes')
  const reducedSpeech = await labPage.evaluate(() => {
    const calls = window.__labSpeechCalls || []
    return [...calls].reverse().find((call) => call.type === 'speak')
  })
  check('reduced motion preserves match logic and speech', reducedSpeech?.text.includes('Iron filings and sand') && reducedSpeech?.local === true)
  await checkCaseOptions(labPage, 'reduced motion')

  await labPage.click('[data-testid="read-aloud-lab"]')
  await sleep(100)
  const beforeExit = await labPage.evaluate(() => (window.__labSpeechCalls || []).length)
  await labPage.click('[data-testid="back-to-hub-top"]')
  await labPage.waitForSelector('[data-testid="hub"]', { timeout: 15000 })
  const exitCancel = await labPage.evaluate((before) => (window.__labSpeechCalls || []).slice(before).some((call) => call.type === 'cancel'), beforeExit)
  check('leaving the lab cancels active speech', exitCancel)
  await labPage.close()

  // PR 5: keyboard recovery on the same tab and device, never from a Results code.
  for (const width of [1366, 1024]) {
    for (const reducedMotion of [false, true]) {
      const recovery = await profilePage(browser, base, '?tier=low', { width, height: 768 }, errors)
      await recovery.evaluate((reducedMotion) => {
        const raw = JSON.parse(localStorage.getItem('anomaly.v1'))
        raw.state.settings.reducedMotion = reducedMotion
        localStorage.setItem('anomaly.v1', JSON.stringify(raw))
      }, reducedMotion)
      await recovery.reload({ waitUntil: 'load' })
      await openSolventLab(recovery)
      const label = `${width}x768, reduced motion ${reducedMotion}`
      const activate = async (id) => {
        await recovery.focus(`[data-testid="${id}"]`)
        await recovery.keyboard.press('Enter')
      }
      await activate('lab-right-magnet')
      await recovery.waitForFunction(() => document.body.textContent.includes('PLACED 1 OF 5'))
      await recovery.reload({ waitUntil: 'load' })
      await recovery.waitForSelector('[data-testid="lab-generic"]')
      check(`reload keeps PLACED 1 OF 5: ${label}`, await recovery.evaluate(() => document.body.textContent.includes('PLACED 1 OF 5')))
      const lab = CONTENT.cases.find((c) => c.id === '04-1').lab
      for (const pair of lab.pairs.slice(1)) {
        await sleep(450)
        await activate(`lab-right-${pair.right}`)
      }
      await recovery.waitForSelector('[data-testid="lab-next"]')
      check(`finished lab clears placements: ${label}`, await recovery.evaluate(() => !JSON.parse(sessionStorage.getItem('anomaly.case.case.04-1')).lab))
      await activate('lab-next')
      await recovery.waitForSelector('[data-testid="item-player"]')
      const before = await recovery.$eval('[data-testid="stem"]', (el) => el.textContent)
      await activate('option-0')
      await activate('lock-in')
      await recovery.waitForSelector('[data-testid="item-result"]')
      const feedback = await recovery.$eval('[data-testid="item-result"]', (el) => el.textContent)
      const score = () => recovery.evaluate(() => {
        const { progress, itemHistory, intel } = JSON.parse(localStorage.getItem('anomaly.v1')).state
        return JSON.stringify({ progress, itemHistory, intel })
      })
      const scored = await score()
      await recovery.reload({ waitUntil: 'load' })
      await recovery.waitForSelector('[data-testid="item-result"]')
      check(`reload keeps the selected answer and feedback: ${label}`,
        await recovery.$eval('[data-testid="option-0"]', (el) => el.getAttribute('aria-pressed') === 'true') &&
        await recovery.$eval('[data-testid="stem"]', (el) => el.textContent) === before &&
        await recovery.$eval('[data-testid="item-result"]', (el) => el.textContent) === feedback)
      check(`reload adds no attempts or Intel: ${label}`, await score() === scored)
      const nextId = await recovery.evaluate(() => JSON.parse(sessionStorage.getItem('anomaly.case.case.04-1')).itemIds[1])
      await activate('next-item')
      await recovery.waitForSelector('[data-testid="lock-in"]')
      check(`continue reaches the correct next question: ${label}`,
        await recovery.$eval('[data-testid="stem"]', (el) => el.textContent.trim()) === CONTENT.items.find((it) => it.id === nextId).stem &&
        await recovery.evaluate(() => !JSON.parse(sessionStorage.getItem('anomaly.case.case.04-1')).pendingFeedback))
      await recovery.close()
    }
  }
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
