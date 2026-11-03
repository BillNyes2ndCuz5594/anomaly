// Proof extras (ledger #28). Small and self-contained, so it does not depend on scripts/proof.mjs or scripts/lib.
//   a) Results with ?still=1: data-motion is still and no <video> is mounted (SealSting poster only).
//   b) Every step runs through a hardened runner: a detached frame, "Target closed" or a page crash relaunches the
//      browser once and retries that step from a fresh page.
//   c) The summary always prints and the exit code is non-zero on any failed check, console error or page error.
// Also checks that Low tier shows data-motion fade once saved reduced motion is off and the page reloads.
// Also checks the hub case preview: no <video> while nothing is hovered, and none at all in still or Low tier.
// Also covers BEDROCK (case 02-2 and LabD):
//   - Creek backdrop poster per tier, still, and reduced motion vs video on High.
//   - Lab keyboard path (Tab to specimen card, Enter, test, identify) keyboard-only.
//   - List view fallback renders all 10 specimens.
//   - 390x844 phone viewport pass over hub, briefing, and LabD with no overflow and tap targets >= 44px.
//   - LabD screenshots on High, Low, and phone saved to /tmp/anomaly-proof/bedrock-{high,low,phone}.png.
//   - Zero console errors across High, Low, ?still=1, and reduced motion.
// Usage: npm run build && node scripts/proof-extra.mjs   (or: npm run proof:extra)
import puppeteer from 'puppeteer-core'
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { setTimeout as sleep } from 'node:timers/promises'

const ROOT = new URL('..', import.meta.url).pathname
const CONTENT = JSON.parse(readFileSync(new URL('../src/content/anomaly-content.json', import.meta.url), 'utf8'))
const CHROME = process.env.PROOF_CHROME || '/usr/bin/google-chrome'
const CHROME_ARGS = [
  '--no-sandbox',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
  '--enable-unsafe-webgpu',
  '--enable-features=Vulkan',
  '--use-vulkan=swiftshader',
  '--disable-dev-shm-usage',
  '--renderer-process-limit=2',
]
const VP = { width: 1366, height: 768 }
const PHONE_VP = { width: 390, height: 844 }
const SHOT_DIR = '/tmp/anomaly-proof'
mkdirSync(SHOT_DIR, { recursive: true })

const TRANSIENT = /detached|Target closed|Session closed|Page crashed|Protocol error|Execution context was destroyed|Connection closed|Navigating frame was detached/i

const checks = []
const errors = []
const check = (name, ok, detail = '') => {
  checks.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`)
}

const port = await new Promise((resolve) => {
  const srv = createServer()
  srv.listen(0, () => {
    const { port } = srv.address()
    srv.close(() => resolve(port))
  })
})
const BASE = `http://localhost:${port}/`

async function startPreview() {
  const proc = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(port), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'], cwd: ROOT })
  let log = ''
  proc.stdout.on('data', (d) => (log += d))
  proc.stderr.on('data', (d) => (log += d))
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(BASE)).ok) return proc
    } catch {}
    if (proc.exitCode !== null) throw new Error('vite preview exited early (run npm run build first):\n' + log)
    await sleep(200)
  }
  proc.kill()
  throw new Error('vite preview did not start:\n' + log)
}

let browser = null
async function launch() {
  browser = await puppeteer.launch({ executablePath: CHROME, headless: true, protocolTimeout: 180000, args: CHROME_ARGS })
}
async function relaunch() {
  try {
    await browser?.close()
  } catch {}
  await launch()
}

const click = async (page, id) => {
  await page.waitForSelector(`[data-testid="${id}"]:not([disabled])`, { timeout: 30000 })
  await page.click(`[data-testid="${id}"]`)
}
const text = (page, id) => page.$eval(`[data-testid="${id}"]`, (e) => e.textContent)

/** A fresh page with a new agent, left on the hub. Console and page errors are collected under label. */
async function profilePage(qs, label, vp = VP) {
  const page = await browser.newPage()
  page.on('console', (m) => m.type() === 'error' && errors.push(`[${label}] console.error: ${m.text()}`))
  page.on('pageerror', (e) => errors.push(`[${label}] pageerror: ${e.message}`))
  page.on('requestfailed', (r) => errors.push(`[${label}] requestfailed: ${r.url()} ${r.failure()?.errorText}`))
  await page.setViewport({ ...vp, deviceScaleFactor: 1 })
  await page.goto(BASE + qs + '#/', { waitUntil: 'load' })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'load' })
  await page.waitForSelector('[data-testid="start-shift"]')
  await page.click('[data-testid="start-shift"]')
  await page.waitForSelector('[data-testid="firstrun-modal"]')
  await page.type('[data-testid="classcode-input"]', 'DEMO')
  await page.click('[data-testid="agent-input"]', { clickCount: 3 })
  await page.type('[data-testid="agent-input"]', '14')
  await page.click('[data-testid="firstrun-confirm"]')
  await page.waitForSelector('[data-testid="hub"]')
  page.setDefaultTimeout(60000)
  return page
}

async function setReducedMotion(page, enabled) {
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: enabled ? 'reduce' : 'no-preference' }])
  await page.evaluate((val) => {
    const raw = localStorage.getItem('anomaly.v1')
    if (!raw) return
    const st = JSON.parse(raw)
    if (st?.state?.settings) st.state.settings = { ...st.state.settings, reducedMotion: val }
    localStorage.setItem('anomaly.v1', JSON.stringify(st))
  }, enabled)
  await page.reload({ waitUntil: 'load' })
  await page.waitForSelector('[data-testid="hub"]')
}

/** Navigates from hub to BEDROCK briefing and into LabD. */
async function goToBedrockLab(page) {
  await page.evaluate(() => (location.hash = '#/case/02-2'))
  await page.waitForSelector('[data-testid="briefing"]', { timeout: 30000 })
  await sleep(400)
  await click(page, 'briefing-continue')
  await page.waitForSelector('[data-testid="lab-d"]', { timeout: 30000 })
  await sleep(600)
}

/** Evaluates phone screen for horizontal overflow and buttons or links below 44px. */
async function checkPhoneScreen(page, screenName) {
  const r = await page.evaluate(() => {
    const el = document.scrollingElement || document.documentElement
    const scrollW = el.scrollWidth
    const innerW = window.innerWidth
    const offenders = []
    const targets = document.querySelectorAll('button, a, [role="button"]')
    for (const t of targets) {
      const s = getComputedStyle(t)
      if (s.visibility === 'hidden' || s.display === 'none' || s.opacity === '0' || t.closest('[hidden]')) continue
      const rect = t.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) continue
      if (rect.width < 43.5 || rect.height < 43.5) {
        const id = t.getAttribute('data-testid') || t.getAttribute('aria-label') || (t.textContent || '').trim().slice(0, 24) || t.className
        offenders.push(`${id} (${Math.round(rect.width)}x${Math.round(rect.height)})`)
      }
    }
    return { scrollW, innerW, noOverflow: scrollW <= innerW, offenders }
  })
  check(`phone ${screenName}: no horizontal overflow`, r.noOverflow, `scrollWidth=${r.scrollW} innerWidth=${r.innerW}`)
  check(`phone ${screenName}: every visible button/link at least 44 px`, r.offenders.length === 0, r.offenders.length ? `offenders: ${r.offenders.join(', ')}` : 'all >= 44px')
}

/** Plays case 03-1 through labs, items and debrief to the Results screen. */
async function playToResults(page) {
  const c = CONTENT.case
  await page.evaluate(() => (location.hash = '#/case/03-1'))
  await page.waitForSelector('[data-testid="briefing"]')
  await sleep(600)
  await click(page, 'briefing-continue')
  await page.waitForSelector('[data-testid="lab-a"]')
  for (const t of c.labs.organOps.tasks) {
    await click(page, `organ-${t.organ}`)
    await page.waitForFunction(() => document.querySelector('[data-testid="lab-feedback"]')?.getAttribute('data-ok') === 'yes')
    await click(page, 'lab-next')
    await sleep(120)
  }
  await page.waitForSelector('[data-testid="lab-b"]')
  for (const p of c.labs.structureMatch.pairs) {
    await click(page, `match-${p.id}-animal`)
    await click(page, `match-${p.id}-plant`)
    await sleep(120)
  }
  await click(page, 'lab-next')
  for (const cc of c.labs.structureMatch.contrast) {
    await click(page, `contrast-${cc.id}-${cc.choices.indexOf(cc.job)}`)
    await page.waitForFunction(() => document.querySelector('[data-testid="lab-feedback"]')?.getAttribute('data-ok') === 'yes')
    await click(page, 'lab-next')
    await sleep(120)
  }
  await page.waitForSelector('[data-testid="lab-c"]')
  for (const sp of c.labs.specimenSort.specimens) {
    await click(page, `sort-backbone-${sp.backbone ? 'yes' : 'no'}`)
    await click(page, `sort-group-${sp.group}`)
    await click(page, 'lab-next')
    await sleep(120)
  }
  for (let n = 0; n < 8; n++) {
    await page.waitForSelector('[data-testid="stem"], [data-testid="debrief"]')
    if (await page.$('[data-testid="debrief"]')) break
    const stem = (await text(page, 'stem')).replace(/\s+/g, ' ').trim()
    const item = CONTENT.items.find((it) => it.stem.split(/\s+/).join(' ') === stem)
    await click(page, `option-${item.key}`)
    await click(page, 'lock-in')
    await page.waitForSelector('[data-testid="item-result"]')
    await sleep(300)
    await click(page, 'next-item')
    await sleep(300)
  }
  await page.waitForSelector('[data-testid="debrief"]')
  await sleep(800)
  await click(page, 'debrief-continue')
  await page.waitForSelector('[data-testid="results"]')
  await sleep(1500)
}

const videos = (page) => page.evaluate(() => document.querySelectorAll('video').length)

/** Hover or focus a hub case card and report what the preview mounted. */
async function previewState(page) {
  return page.evaluate(() => {
    const el = document.querySelector('[data-testid="case-preview"]')
    return {
      present: !!el,
      clip: el?.getAttribute('data-clip') ?? '',
      media: el?.getAttribute('data-media') ?? '',
      videos: el ? el.querySelectorAll('video').length : 0,
      all: document.querySelectorAll('video').length,
      imgs: el ? el.querySelectorAll('img').length : 0,
    }
  })
}

async function hubPreview(qs, label, expectMedia) {
  const page = await profilePage(qs, label)
  await sleep(2500)
  const base = await previewState(page)
  const still = expectMedia === 'poster'
  check(`${label}: nothing hovered, no preview <video>${still ? ' and no <video> anywhere' : ''}`, !base.present && base.videos === 0 && (!still || base.all === 0), JSON.stringify(base))
  await page.hover('[data-testid="case-marker-03-1"]')
  await page.waitForSelector('[data-testid="case-preview"]', { timeout: 10000 })
  const on = await previewState(page)
  check(`${label}: hover shows the ${expectMedia} preview`, on.media === expectMedia && (expectMedia === 'video' ? on.videos === 1 : on.all === 0 && on.imgs === 1), JSON.stringify(on))
  await page.mouse.move(5, 5)
  await sleep(300)
  const off = await previewState(page)
  check(`${label}: leaving unmounts the preview and its video`, !off.present && off.videos === 0 && (!still || off.all === 0), JSON.stringify(off))
  await page.focus('[data-testid="cold-marker"]')
  await page.keyboard.press('Tab')
  await page.keyboard.down('Shift')
  await page.keyboard.press('Tab')
  await page.keyboard.up('Shift')
  await sleep(300)
  const foc = await previewState(page)
  check(`${label}: keyboard focus shows the ${expectMedia} preview`, foc.present && foc.media === expectMedia && (expectMedia === 'video' ? foc.videos === 1 : foc.all === 0), JSON.stringify(foc))
  await page.$eval('[data-testid="cold-marker"]', (e) => e.blur())
  await sleep(300)
  const blur = await previewState(page)
  check(`${label}: blur unmounts the preview and its video`, !blur.present && blur.videos === 0 && (!still || blur.all === 0), JSON.stringify(blur))
  await page.close()
}

const STEPS = [
  [
    'results still',
    async () => {
      const page = await profilePage('?tier=high&still=1', 'results-still')
      await playToResults(page)
      const mode = await page.evaluate(() => document.documentElement.dataset.motion)
      check('results (?still=1): data-motion is still', mode === 'still', String(mode))
      check('results (?still=1): no <video> mounted', (await videos(page)) === 0, `${await videos(page)} videos`)
      const seal = await page.evaluate(() => {
        const s = document.querySelector('.seal-sting')
        return { present: !!s, poster: !!s?.querySelector('img.seal-poster'), mode: s?.getAttribute('data-mode') }
      })
      check('results (?still=1): SealSting shows its poster only', seal.present && seal.poster && seal.mode === 'still', JSON.stringify(seal))
      await page.close()
    },
  ],
  [
    'low tier fade',
    async () => {
      // Saved settings are read once at load, so a hash-only goto after editing storage keeps the old value.
      // Turn reduced motion off in storage, then reload for real before reading data-motion.
      const page = await profilePage('?tier=low', 'low-fade')
      await setReducedMotion(page, false)
      const fade = await page.waitForFunction(() => document.documentElement.dataset.motion === 'fade', { timeout: 20000, polling: 250 }).then(() => true, () => false)
      const mode = await page.evaluate(() => `motion=${document.documentElement.dataset.motion} tier=${document.documentElement.dataset.tier}`)
      check('Low tier (reduced motion off, after reload) uses data-motion fade', fade, mode)
      await page.close()
    },
  ],
  ['hub preview still', () => hubPreview('?tier=high&still=1', 'hub still', 'poster')],
  ['hub preview low', () => hubPreview('?tier=low', 'hub low', 'poster')],
  ['hub preview high', () => hubPreview('?tier=high', 'hub high', 'video')],

  // BEDROCK section: case 02-2 and LabD
  [
    'bedrock creek preview',
    async () => {
      // Note: No in-case creek backdrop exists for 02-2 (in-case 3D environment uses water clip);
      // checking hub preview of 02-2 for creek loop instead per brief.
      // 1. High tier: video present and muted/playsInline/aria-hidden
      const pHigh = await profilePage('?tier=high', 'bedrock-creek-high')
      await pHigh.hover('[data-testid="case-marker-02-2"]')
      await pHigh.waitForSelector('[data-testid="case-preview"]', { timeout: 10000 })
      const vProps = await pHigh.evaluate(() => {
        const el = document.querySelector('[data-testid="case-preview"]')
        const v = el?.querySelector('video')
        return {
          clip: el?.getAttribute('data-clip'),
          media: el?.getAttribute('data-media'),
          hasVideo: !!v,
          muted: !!v?.muted,
          playsInline: !!v?.hasAttribute('playsinline'),
          ariaHidden: v?.getAttribute('aria-hidden') === 'true',
        }
      })
      check(
        'BEDROCK hub creek preview (High): video element present and muted/playsInline/aria-hidden',
        vProps.clip === 'creek' && vProps.media === 'video' && vProps.hasVideo && vProps.muted && vProps.playsInline && vProps.ariaHidden,
        JSON.stringify(vProps),
      )
      await pHigh.close()

      // 2. Low tier: poster shown, no playing video
      const pLow = await profilePage('?tier=low', 'bedrock-creek-low')
      await pLow.hover('[data-testid="case-marker-02-2"]')
      await pLow.waitForSelector('[data-testid="case-preview"]', { timeout: 10000 })
      const sLow = await previewState(pLow)
      check('BEDROCK hub creek preview (Low): poster shown, no playing video', sLow.clip === 'creek' && sLow.media === 'poster' && sLow.videos === 0, JSON.stringify(sLow))
      await pLow.close()

      // 3. ?still=1: poster shown, no playing video
      const pStill = await profilePage('?tier=high&still=1', 'bedrock-creek-still')
      await pStill.hover('[data-testid="case-marker-02-2"]')
      await pStill.waitForSelector('[data-testid="case-preview"]', { timeout: 10000 })
      const sStill = await previewState(pStill)
      check('BEDROCK hub creek preview (?still=1): poster shown, no playing video', sStill.clip === 'creek' && sStill.media === 'poster' && sStill.videos === 0, JSON.stringify(sStill))
      await pStill.close()

      // 4. Reduced motion: poster shown, no playing video
      const pRed = await profilePage('?tier=high', 'bedrock-creek-reduced')
      await setReducedMotion(pRed, true)
      await pRed.hover('[data-testid="case-marker-02-2"]')
      await pRed.waitForSelector('[data-testid="case-preview"]', { timeout: 10000 })
      const sRed = await previewState(pRed)
      check('BEDROCK hub creek preview (reduced motion): poster shown, no playing video', sRed.clip === 'creek' && sRed.media === 'poster' && sRed.videos === 0, JSON.stringify(sRed))
      await pRed.close()
    },
  ],
  [
    'bedrock lab high and keyboard',
    async () => {
      const page = await profilePage('?tier=high', 'bedrock-lab-high')
      await goToBedrockLab(page)

      // In-case backdrop check on High tier: video present, muted, playsInline, aria-hidden
      const sceneVideo = await page.evaluate(() => {
        const v = document.querySelector('video')
        return {
          hasVideo: !!v,
          muted: !!v?.muted,
          playsInline: !!v?.hasAttribute('playsinline'),
          ariaHidden: v?.getAttribute('aria-hidden') === 'true',
        }
      })
      check(
        'BEDROCK LabD (High): in-case sky video present and muted/playsInline/aria-hidden',
        sceneVideo.hasVideo && sceneVideo.muted && sceneVideo.playsInline && sceneVideo.ariaHidden,
        JSON.stringify(sceneVideo),
      )

      // Save screenshot of LabD on High tier
      await page.screenshot({ path: `${SHOT_DIR}/bedrock-high.png` })
      check('BEDROCK LabD: screenshot saved to /tmp/anomaly-proof/bedrock-high.png', true)

      // Keyboard path: Tab to specimen card, Enter, run a test, identify with keyboard only
      await page.focus('[data-testid="back-to-hub-top"]')
      let activeTestId = ''
      let tabCount = 0
      while (tabCount < 30) {
        await page.keyboard.press('Tab')
        tabCount++
        activeTestId = await page.evaluate(() => document.activeElement?.getAttribute('data-testid') || '')
        if (activeTestId.startsWith('mineral-card-')) break
      }
      const pickedCardId = activeTestId
      await page.keyboard.press('Enter')
      await sleep(200)

      while (tabCount < 50) {
        await page.keyboard.press('Tab')
        tabCount++
        activeTestId = await page.evaluate(() => document.activeElement?.getAttribute('data-testid') || '')
        if (activeTestId.startsWith('test-')) break
      }
      const testRanId = activeTestId
      await page.keyboard.press('Enter')
      await sleep(250)
      const evidenceCount = await page.evaluate(() => document.querySelectorAll('.evidence-list li').length)

      while (tabCount < 80) {
        await page.keyboard.press('Tab')
        tabCount++
        activeTestId = await page.evaluate(() => document.activeElement?.getAttribute('data-testid') || '')
        if (activeTestId.startsWith('identify-')) break
      }
      const chosenId = activeTestId
      await page.keyboard.press('Enter')
      await sleep(250)
      const verdict = await page.evaluate(() => {
        const fb = document.querySelector('[data-testid="lab-feedback"]')
        return { present: !!fb, ok: fb?.getAttribute('data-ok') }
      })

      const keyboardOk = pickedCardId.startsWith('mineral-card-') && testRanId.startsWith('test-') && evidenceCount > 0 && chosenId.startsWith('identify-') && verdict.present
      check(
        'BEDROCK: lab keyboard path (Tab to specimen, Enter, test, identify) works keyboard-only',
        keyboardOk,
        `card=${pickedCardId} test=${testRanId} evidence=${evidenceCount} identify=${chosenId} verdictOk=${verdict.ok}`,
      )

      // List view fallback check: renders all 10 specimens (7 minerals + 3 rocks)
      await click(page, 'toggle-list-view')
      await page.waitForSelector('[data-testid="list-view-panel"]', { timeout: 10000 })
      const listInfo = await page.evaluate(() => {
        const panel = document.querySelector('[data-testid="list-view-panel"]')
        const cards = panel ? Array.from(panel.querySelectorAll('.list-item-card')) : []
        const textContent = panel?.textContent || ''
        const specimens = ['Talc', 'Graphite', 'Mica', 'Calcite', 'Feldspar', 'Quartz', 'Pyrite', 'Granite', 'Limestone', 'Gneiss']
        const missing = specimens.filter((s) => !textContent.includes(s))
        return { count: cards.length, missing }
      })
      check('BEDROCK: list view fallback renders all 10 specimens', listInfo.count === 10 && listInfo.missing.length === 0, `count=${listInfo.count} missing=${listInfo.missing.join(',')}`)
      await click(page, 'toggle-list-view')
      await sleep(200)

      await page.close()
    },
  ],
  [
    'bedrock lab low, still, and reduced motion',
    async () => {
      // Low tier: poster shown, no playing video in LabD
      const pLow = await profilePage('?tier=low', 'bedrock-lab-low')
      await goToBedrockLab(pLow)
      const lowVideos = await videos(pLow)
      check('BEDROCK LabD (Low): no playing video mounted (poster only)', lowVideos === 0, `${lowVideos} videos`)
      await pLow.screenshot({ path: `${SHOT_DIR}/bedrock-low.png` })
      check('BEDROCK LabD: screenshot saved to /tmp/anomaly-proof/bedrock-low.png', true)
      await pLow.close()

      // Still tier: ?still=1 has no playing video in LabD
      const pStill = await profilePage('?tier=high&still=1', 'bedrock-lab-still')
      await goToBedrockLab(pStill)
      const stillVideos = await videos(pStill)
      check('BEDROCK LabD (?still=1): no playing video mounted (poster only)', stillVideos === 0, `${stillVideos} videos`)
      await pStill.close()

      // Reduced motion: no playing video in LabD
      const pRed = await profilePage('?tier=high', 'bedrock-lab-reduced')
      await setReducedMotion(pRed, true)
      await goToBedrockLab(pRed)
      const redVideos = await videos(pRed)
      check('BEDROCK LabD (reduced motion): no playing video mounted (poster only)', redVideos === 0, `${redVideos} videos`)
      await pRed.close()
    },
  ],
  [
    'bedrock phone pass',
    async () => {
      // Phone viewport 390x844 pass over hub, BEDROCK briefing, and LabD
      const page = await profilePage('?tier=high', 'bedrock-phone', PHONE_VP)

      // 1. Hub
      await checkPhoneScreen(page, 'hub')

      // 2. BEDROCK briefing
      await page.evaluate(() => (location.hash = '#/case/02-2'))
      await page.waitForSelector('[data-testid="briefing"]', { timeout: 30000 })
      await sleep(600)
      await checkPhoneScreen(page, 'BEDROCK briefing')

      // 3. LabD
      await click(page, 'briefing-continue')
      await page.waitForSelector('[data-testid="lab-d"]', { timeout: 30000 })
      await sleep(600)
      await checkPhoneScreen(page, 'LabD')

      // Save screenshot of LabD on phone viewport
      await page.screenshot({ path: `${SHOT_DIR}/bedrock-phone.png` })
      check('BEDROCK LabD: screenshot saved to /tmp/anomaly-proof/bedrock-phone.png', true)

      await page.close()
    },
  ],
]

/** Runs a step. A transient browser failure relaunches Chrome once and retries the step from a fresh page. */
async function runStep(name, fn) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await fn()
      return
    } catch (e) {
      const msg = String(e?.message ?? e)
      if (attempt === 0 && (TRANSIENT.test(msg) || !browser?.connected)) {
        console.log(`  relaunching browser and retrying "${name}": ${msg.split('\n')[0].slice(0, 140)}`)
        await relaunch()
        continue
      }
      check(`step "${name}" completed`, false, msg.split('\n')[0].slice(0, 200))
      return
    }
  }
}

let preview
try {
  preview = await startPreview()
  await launch()
  for (const [name, fn] of STEPS) {
    console.log(`\n== ${name} ==`)
    await runStep(name, fn)
  }
} catch (e) {
  check('proof-extra setup', false, String(e?.message ?? e).split('\n')[0].slice(0, 300))
} finally {
  try {
    await browser?.close()
  } catch {}
  preview?.kill()
  check('zero console and page errors', errors.length === 0, errors.slice(0, 5).join(' | '))
  const failed = checks.filter((c) => !c.ok)
  console.log(`\nproof-extra summary: ${checks.length - failed.length} of ${checks.length} checks passed, ${errors.length} console or page errors`)
  for (const f of failed) console.log(`  FAILED: ${f.name}${f.detail ? '  ' + f.detail : ''}`)
  process.exitCode = failed.length ? 1 : 0
}
