// Proof: starts `vite preview`, walks title, first run, hub, settings, the full case 03-1 flow (S2), teacher, and fps under 4x CPU throttle.
// Usage: node scripts/proof.mjs   (run `npm run build` first)
import puppeteer from 'puppeteer-core'
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'

const OUT = '/workspace/anomaly-proof'
const CONTENT = JSON.parse(readFileSync(new URL('../src/content/anomaly-content.json', import.meta.url), 'utf8'))
const GALLERY = process.env.GALLERY === '1'
const PORT = 4173
const BASE = `http://localhost:${PORT}/`
const VIEWPORTS = [
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 },
]
const CHROME_ARGS = [
  '--no-sandbox',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
  '--enable-unsafe-webgpu',
  // Without these two, headless Chrome destroys the WebGPU device on the first presented frame.
  '--enable-features=Vulkan',
  '--use-vulkan=swiftshader',
]

mkdirSync(OUT, { recursive: true })

const errors = []
const checks = []
const check = (name, ok, detail = '') => {
  checks.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`)
}

async function startPreview() {
  const proc = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] })
  let log = ''
  proc.stdout.on('data', (d) => (log += d))
  proc.stderr.on('data', (d) => (log += d))
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(BASE)
      if (r.ok) return proc
    } catch {}
    if (proc.exitCode !== null) throw new Error('vite preview exited early:\n' + log)
    await sleep(200)
  }
  proc.kill()
  throw new Error('vite preview did not start:\n' + log)
}

function watch(page, label) {
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`[${label}] console.error: ${m.text()}`)
    else if (m.type() === 'warning') console.log(`  warn [${label}] ${m.text().slice(0, 160)}`)
  })
  page.on('pageerror', (e) => errors.push(`[${label}] pageerror: ${e.message}`))
  page.on('requestfailed', (r) => errors.push(`[${label}] requestfailed: ${r.url()} ${r.failure()?.errorText}`))
  page.on('response', (r) => {
    if (r.status() >= 400) errors.push(`[${label}] http ${r.status()}: ${r.url()}`)
  })
}

async function waitRendered(page, extraMs = 3000) {
  await page.waitForFunction(() => window.__anomaly && window.__anomaly.fps > 0, { timeout: 90000, polling: 250 })
  await sleep(extraMs)
}

async function freshPage(browser, vp, label, hash = '#/') {
  const page = await browser.newPage()
  watch(page, label)
  await page.setViewport({ ...vp, deviceScaleFactor: 1 })
  await page.goto(BASE + hash, { waitUntil: 'load' })
  await page.evaluate(() => localStorage.clear())
  await page.goto(BASE + hash, { waitUntil: 'load' })
  await page.reload({ waitUntil: 'load' })
  return page
}


// ---------- S2: play the whole case through data-testids ----------
const tokenize = (stem) => stem.split(/\s+/).filter(Boolean)
const norm = (w) => w.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '')
const has = async (page, id) => !!(await page.$(`[data-testid="${id}"]`))
const click = async (page, id) => {
  await page.waitForSelector(`[data-testid="${id}"]:not([disabled])`, { timeout: 30000 })
  await page.click(`[data-testid="${id}"]`)
}
const text = (page, id) => page.$eval(`[data-testid="${id}"]`, (e) => e.textContent)
const attr = (page, id, a) => page.$eval(`[data-testid="${id}"]`, (e, a) => e.getAttribute(a), a)
const shot = (page, name, w) => page.screenshot({ path: `${OUT}/${name}-${w}.png` })

/** First index of the first key phrase inside the stem tokens. */
function firstKeyTokenIndex(item) {
  const tokens = tokenize(item.stem).map(norm)
  for (const kw of item.keyWords) {
    const words = tokenize(kw).map(norm)
    for (let i = 0; i + words.length <= tokens.length; i++) {
      if (words.every((x, j) => tokens[i + j] === x)) return i
    }
  }
  return -1
}

async function playCase(page, w) {
  const c = CONTENT.case
  await page.evaluate(() => (location.hash = '#/hub'))
  await page.waitForSelector('[data-testid="hub"]')
  await sleep(500)
  await click(page, 'case-marker-03-1')

  // Briefing
  await page.waitForSelector('[data-testid="briefing"]')
  check(`briefing route (${w})`, (await page.evaluate(() => location.hash)) === '#/case/03-1')
  check(`step indicator on briefing (${w})`, (await text(page, 'step-indicator')).includes('Briefing'))
  await waitRendered(page, 3500)
  await click(page, 'read-aloud') // must not throw with no voices
  await sleep(1800)
  check(`briefing shows dispatch lines (${w})`, (await text(page, 'briefing-text')).includes(c.briefing[0].slice(0, 20)))
  await shot(page, 's2-briefing', w)
  await click(page, 'briefing-continue')

  // Lab A
  await page.waitForSelector('[data-testid="lab-a"]')
  await sleep(3500)
  await click(page, 'organ-liver') // wrong for the first job
  await sleep(300)
  check(`lab A wrong pick says Not that one (${w})`, (await text(page, 'lab-feedback')).includes('Not that one.') && (await attr(page, 'lab-feedback', 'data-ok')) === 'no')
  for (let i = 0; i < c.labs.organOps.tasks.length; i++) {
    const t = c.labs.organOps.tasks[i]
    await click(page, `organ-${t.organ}`)
    await page.waitForFunction(() => document.querySelector('[data-testid="lab-feedback"]')?.getAttribute('data-ok') === 'yes')
    if (i === 4) {
      await sleep(450)
      await shot(page, 's2-lab-a', w)
    }
    await click(page, 'lab-next')
    await sleep(150)
  }

  // Lab B
  await page.waitForSelector('[data-testid="lab-b"]')
  await sleep(3000)
  const pairs = c.labs.structureMatch.pairs
  await click(page, `match-${pairs[0].id}-animal`)
  await click(page, `match-${pairs[1].id}-plant`) // mismatch first
  await sleep(200)
  check(`lab B mismatch is gentle (${w})`, (await text(page, 'lab-feedback')).includes('Not a match.'))
  for (const p of pairs) {
    await click(page, `match-${p.id}-animal`)
    await click(page, `match-${p.id}-plant`)
    await sleep(200)
  }
  await sleep(1500)
  await shot(page, 's2-lab-b', w)
  await click(page, 'lab-next')
  for (const cc of c.labs.structureMatch.contrast) {
    const wrong = cc.choices.findIndex((x) => x !== cc.job)
    await click(page, `contrast-${cc.id}-${wrong}`)
    await click(page, `contrast-${cc.id}-${cc.choices.indexOf(cc.job)}`)
    await page.waitForFunction(() => document.querySelector('[data-testid="lab-feedback"]')?.getAttribute('data-ok') === 'yes')
    await click(page, 'lab-next')
    await sleep(150)
  }

  // Lab C
  await page.waitForSelector('[data-testid="lab-c"]')
  await sleep(3500)
  const specs = c.labs.specimenSort.specimens
  for (let i = 0; i < specs.length; i++) {
    const sp = specs[i]
    if (GALLERY) {
      await click(page, `specimen-chip-${sp.id}`)
      await sleep(2200)
      await page.screenshot({ path: `${OUT}/s2-specimen-${sp.id}-${w}.png` })
    }
    await click(page, `sort-backbone-${sp.backbone ? 'yes' : 'no'}`)
    if (i === 0) {
      await sleep(1500)
      await shot(page, 's2-lab-c', w)
    }
    await click(page, `sort-group-${sp.group}`)
    await click(page, 'lab-next')
    await sleep(200)
  }

  // Evidence check
  await page.waitForSelector('[data-testid="item-player"]')
  const total = 5
  for (let n = 0; n < total; n++) {
    await page.waitForSelector('[data-testid="stem"]')
    const stemText = (await text(page, 'stem')).replace(/\s+/g, ' ').trim()
    const item = CONTENT.items.find((it) => tokenize(it.stem).join(' ') === stemText)
    if (!item) throw new Error('item not found for stem: ' + stemText)
    const key = item.key
    check(`item ${n + 1} has alt text and visual (${w})`, (await text(page, 'visual-alt')).trim() === item.alt && (await has(page, 'item-visual')))
    await sleep(n === 0 ? 3500 : 1200)

    if (n === 0) {
      // Full RKEA: tag a key word, eliminate a decoy (and try the key), then screenshot before locking in.
      const t = firstKeyTokenIndex(item)
      await click(page, `word-${t}`)
      await click(page, 'eliminate-toggle')
      await click(page, `option-${key}`)
      await sleep(200)
      check(`striking the key is refused (${w})`, (await text(page, 'dispatch-msg')).includes('Careful. Check that one again.'))
      const decoy = [0, 1, 2, 3].find((i) => i !== key)
      await click(page, `option-${decoy}`)
      await sleep(200)
      const why = await page.$eval(`[data-testid="why-${decoy}"]`, (e) => e.hidden === false && e.textContent.length > 10)
      check(`striking a decoy reveals its why (${w})`, why)
      await click(page, 'eliminate-toggle')
      await click(page, `option-${key}`)
      await sleep(600)
      const lit = await page.$$eval('[data-testid="rkea-chips"] [data-lit="yes"]', (els) => els.length)
      check(`RKEA chips light up (${w})`, lit >= 3, `${lit} lit`)
      check(`key word bracket shown (${w})`, await has(page, 'keyword-0'))
      await shot(page, 's2-item-rkea', w)
      await click(page, 'lock-in')
      await page.waitForSelector('[data-testid="item-result"]')
      check(`item 1 result is correct with icon and word (${w})`, (await attr(page, 'item-result', 'data-ok')) === 'yes' && (await text(page, 'item-result')).includes('Correct'))
      const whys = await page.$$eval('[data-testid^="why-"]', (els) => els.filter((e) => !e.hidden && e.textContent.length > 10).length)
      check(`all four why lines shown after lock-in (${w})`, whys === 4, `${whys}`)
      await sleep(800)
      await shot(page, 's2-item-result', w)
      await click(page, 'next-item')
    } else if (n === 1) {
      // Keyboard only: digit picks, Enter locks in, Enter again moves on.
      await page.keyboard.press(String(key + 1))
      await page.keyboard.press('Enter')
      await page.waitForSelector('[data-testid="item-result"]')
      check(`keyboard play works (${w})`, (await attr(page, 'item-result', 'data-ok')) === 'yes')
      await page.keyboard.press('Enter')
      await sleep(300)
    } else {
      await click(page, `option-${key}`)
      await click(page, 'lock-in')
      await page.waitForSelector('[data-testid="item-result"]')
      await click(page, 'next-item')
    }
    await sleep(300)
  }

  // Debrief
  await page.waitForSelector('[data-testid="debrief"]')
  await sleep(1400)
  check(`case closed stamp at 100 percent (${w})`, (await attr(page, 'case-stamp', 'data-closed')) === 'yes', await text(page, 'debrief-score'))
  const dItems = await page.$$('[data-testid^="debrief-item-"]')
  check(`debrief lists 5 items (${w})`, dItems.length === 5, `${dItems.length}`)
  await shot(page, 's2-debrief', w)
  await click(page, 'debrief-continue')

  // Results
  await page.waitForSelector('[data-testid="results"]')
  await sleep(2400)
  const bars = await page.$$('[data-testid^="mastery-bar-"]')
  check(`results shows a bar per benchmark (${w})`, bars.length === 3, `${bars.length}`)
  check(`intel earned shown (${w})`, Number((await text(page, 'intel-earned')).match(/\d+/)?.[0] ?? 0) > 0)
  check(`drone paint unlocked on first stage-up (${w})`, (await attr(page, 'paint-unlock', 'data-unlocked')) === 'yes')
  await shot(page, 's2-results', w)
  const store = await page.evaluate(() => JSON.parse(localStorage.getItem('anomaly.v1')).state)
  check(`progress persisted (${w})`, store.itemHistory.length === 5 && Object.keys(store.progress).length === 3 && store.codex.length > 0, `${store.itemHistory.length} items, ${store.codex.length} codex`)
  check(`stage rose to rookie (${w})`, Object.values(store.progress).every((r) => r.stage === 'rookie'))
  await click(page, 'back-to-hub')
  await page.waitForSelector('[data-testid="hub"]')
  await sleep(800)
  await page.click('[data-testid="codex-panel"] summary')
  await sleep(500)
  const codexCount = await text(page, 'codex-count')
  check(`hub codex lists unlocked entries (${w})`, /^[1-9]/.test(codexCount.trim()), codexCount)
  if (w === 1366) await shot(page, 's2-hub-codex', w)
}

const preview = await startPreview()
let browser
let exitCode = 0
try {
  browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: CHROME_ARGS })

  for (const vp of VIEWPORTS) {
    const w = vp.width
    const label = `${w}`
    console.log(`\n== viewport ${w}x${vp.height} ==`)
    const page = await freshPage(browser, vp, label)

    // Title
    await page.waitForSelector('[data-testid="title"]')
    await waitRendered(page)
    await page.screenshot({ path: `${OUT}/s1-title-${w}.png` })
    const info = await page.evaluate(() => window.__anomaly)
    // fps can read 0 for a moment when software rendering is slow at 1920, so only require a live backend.
    check(`title renders (${w})`, !!info && info.backend !== 'none', JSON.stringify(info))
    check(`start button present (${w})`, !!(await page.$('[data-testid="start-shift"]')))

    // First run modal
    await page.click('[data-testid="start-shift"]')
    await page.waitForSelector('[data-testid="firstrun-modal"]')
    await page.type('[data-testid="classcode-input"]', 'demo!x')
    const code = await page.$eval('[data-testid="classcode-input"]', (el) => el.value)
    check(`class code sanitized (${w})`, code === 'DEMOX', code)
    await page.$eval('[data-testid="classcode-input"]', (el) => {
      el.value = ''
    })
    await page.click('[data-testid="classcode-input"]', { clickCount: 3 })
    await page.keyboard.press('Backspace')
    await page.type('[data-testid="classcode-input"]', 'DEMO')
    await page.click('[data-testid="agent-input"]', { clickCount: 3 })
    await page.type('[data-testid="agent-input"]', '14')
    await sleep(500)
    const preview14 = await page.$eval('[data-testid="codename-preview"]', (el) => el.textContent)
    check(`codename preview (${w})`, /^AGENT [A-Z]+-14$/.test(preview14), preview14)
    await page.screenshot({ path: `${OUT}/s1-firstrun-${w}.png` })
    await page.click('[data-testid="firstrun-confirm"]')

    // Hub
    await page.waitForSelector('[data-testid="hub"]')
    await sleep(3500)
    await page.screenshot({ path: `${OUT}/s1-hub-${w}.png` })
    const codename = await page.$eval('[data-testid="codename"]', (el) => el.textContent)
    check(`hub shows codename (${w})`, codename === preview14, codename)
    check(`case marker button (${w})`, !!(await page.$('[data-testid="case-marker-03-1"]')))
    check(`cold marker button (${w})`, !!(await page.$('[data-testid="cold-marker"]')))
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('anomaly.v1') || 'null'))
    check(`persisted under anomaly.v1 (${w})`, stored?.state?.profile?.agentNumber === 14 && stored.state.profile.classCode === 'DEMO')

    // Case route
    await page.click('[data-testid="case-marker-03-1"]')
    await page.waitForSelector('[data-testid="briefing"]')
    check(`case route (${w})`, (await page.evaluate(() => location.hash)) === '#/case/03-1')
    await page.goBack()
    await page.waitForSelector('[data-testid="hub"]')

    // Settings
    await page.click('[data-testid="open-settings"]')
    await page.waitForSelector('[data-testid="settings"]')
    await sleep(1500)
    if (w === 1366) {
      check('fps readout hidden by default', !(await page.$('[data-testid="fps-readout"]')))
      await page.click('[data-testid="setting-show-fps"]')
      await sleep(900)
      const ro = await page.$('[data-testid="fps-readout"]')
      check('fps readout shown after toggle', !!ro, ro ? await ro.evaluate((e) => e.textContent) : '')
    }
    await page.screenshot({ path: `${OUT}/s1-settings-${w}.png` })

    // S2: the whole case
    page.setDefaultTimeout(60000)
    await playCase(page, w)
    await page.close()
  }

  // Teacher HQ (must not load three)
  for (const vp of VIEWPORTS) {
    const page = await browser.newPage()
    watch(page, `teacher-${vp.width}`)
    await page.setViewport({ ...vp, deviceScaleFactor: 1 })
    const urls = []
    page.on('request', (r) => urls.push(r.url()))
    await page.goto(BASE + 'teacher.html', { waitUntil: 'networkidle0' })
    await page.waitForSelector('[data-testid="teacher-hq"]')
    await page.screenshot({ path: `${OUT}/s1-teacher-${vp.width}.png` })
    const heavy = urls.filter((u) => /three|Stage|Scene/i.test(u))
    check(`teacher page loads no three chunk (${vp.width})`, heavy.length === 0, heavy.join(','))
    await page.close()
  }

  // ?debug=1 forces the readout on
  {
    const page = await browser.newPage()
    watch(page, 'debug')
    await page.setViewport({ ...VIEWPORTS[0], deviceScaleFactor: 1 })
    await page.goto(BASE + '?debug=1#/', { waitUntil: 'load' })
    await page.waitForSelector('[data-testid="fps-readout"]', { timeout: 20000 })
    check('?debug=1 shows fps readout', true)
    await page.close()
  }

  // FPS under 4x CPU throttle on the hub (profile exists from the runs above)
  {
    const vp = VIEWPORTS[0]
    console.log('\n== fps under 4x CPU throttle (hub) ==')
    const page = await browser.newPage()
    watch(page, 'fps')
    await page.setViewport({ ...vp, deviceScaleFactor: 1 })
    const cdp = await page.createCDPSession()
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
    await page.goto(BASE + '#/hub', { waitUntil: 'load' })
    await page.waitForSelector('[data-testid="hub"]')
    await waitRendered(page, 1000)
    const first = await page.evaluate(() => window.__anomaly)
    const fpsSamples = []
    for (let i = 0; i < 20; i++) {
      await sleep(500)
      const a = await page.evaluate(() => window.__anomaly)
      fpsSamples.push(a.fps)
    }
    const last = await page.evaluate(() => window.__anomaly)
    const fpsAvg = Math.round((fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length) * 10) / 10
    const result = {
      backend: last.backend,
      tierStart: first.tier,
      tierEnd: last.tier,
      fpsSamples,
      fpsAvg,
      throttle: 4,
      viewport: vp,
    }
    writeFileSync(`${OUT}/fps.json`, JSON.stringify(result, null, 2))
    console.log(JSON.stringify({ ...result, fpsSamples: `${fpsSamples.length} samples` }))
    check('fps samples collected', fpsSamples.length === 20 && fpsAvg > 0, `avg ${fpsAvg}`)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
    await page.close()
  }

  console.log('\n== summary ==')
  const failed = checks.filter((c) => !c.ok)
  console.log(`${checks.length - failed.length}/${checks.length} checks passed`)
  console.log(`console errors / page errors: ${errors.length}`)
  for (const e of errors) console.log('  ' + e)
  if (failed.length || errors.length) exitCode = 1
} catch (e) {
  console.error('proof crashed:', e)
  exitCode = 1
} finally {
  await browser?.close()
  preview.kill()
}
process.exit(exitCode)
