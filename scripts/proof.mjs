// Proof (SPEC section 12). One run walks the whole product at 1366x768 and 1920x1080:
// title, first run, hub, settings, case 03-1 (briefing, labs, RKEA items, debrief, results with report code),
// cold case RESIDUE, resume with code, Teacher HQ (sample class and a real decoded code),
// then fps under 4x CPU throttle on the hub and lab A, initial load size, and a summary.
// Output goes to /workspace/anomaly-proof/. Exit code is non-zero on any console error, page error or failed check.
// Usage: npm run build && node scripts/proof.mjs
import puppeteer from 'puppeteer-core'
import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { createServer } from 'node:net'
import { setTimeout as sleep } from 'node:timers/promises'

const OUT = '/workspace/anomaly-proof'
const ROOT = new URL('..', import.meta.url).pathname
const CONTENT = JSON.parse(readFileSync(new URL('../src/content/anomaly-content.json', import.meta.url), 'utf8'))
// A free port, so a stale preview server from an earlier run can never be tested by accident.
const PORT = await new Promise((resolve) => {
  const srv = createServer()
  srv.listen(0, () => {
    const { port } = srv.address()
    srv.close(() => resolve(port))
  })
})
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
for (const f of readdirSync(OUT)) if (/\.(png|json)$/.test(f)) rmSync(join(OUT, f))

const errors = []
const checks = []
const shots = []
const check = (name, ok, detail = '') => {
  checks.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`)
}

async function startPreview() {
  const proc = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'], cwd: ROOT })
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

// ---------- helpers ----------
const tokenize = (stem) => stem.split(/\s+/).filter(Boolean)
const norm = (w) => w.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '')
const has = async (page, id) => !!(await page.$(`[data-testid="${id}"]`))
const click = async (page, id) => {
  await page.waitForSelector(`[data-testid="${id}"]:not([disabled])`, { timeout: 30000 })
  await page.click(`[data-testid="${id}"]`)
}
const text = (page, id) => page.$eval(`[data-testid="${id}"]`, (e) => e.textContent)
const attr = (page, id, a) => page.$eval(`[data-testid="${id}"]`, (e, a) => e.getAttribute(a), a)

/** Screenshots are numbered in flow order: NN-name-WIDTH.png. */
const ORDER = ['title', 'firstrun', 'hub', 'settings', 'briefing', 'lab-a', 'lab-b', 'lab-c', 'item-rkea', 'item-result', 'debrief', 'results-with-code', 'cold-intro', 'cold-item', 'teacher-sample', 'teacher-decoded']
async function shot(page, name, w, opts = {}) {
  const n = String(ORDER.indexOf(name) + 1).padStart(2, '0')
  const file = `${n}-${name}-${w}.png`
  await page.screenshot({ path: `${OUT}/${file}`, ...opts })
  shots.push(file)
}

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

/** Plays the evidence items. `kind` is case or cold. Returns the item objects asked. */
async function playItems(page, w, kind, total) {
  await page.waitForSelector('[data-testid="item-player"]')
  const asked = []
  for (let n = 0; n < total; n++) {
    await page.waitForSelector('[data-testid="stem"]')
    const stemText = (await text(page, 'stem')).replace(/\s+/g, ' ').trim()
    const item = CONTENT.items.find((it) => tokenize(it.stem).join(' ') === stemText)
    if (!item) throw new Error('item not found for stem: ' + stemText)
    asked.push(item)
    const key = item.key
    check(`${kind} item ${n + 1} has alt text and visual (${w})`, (await text(page, 'visual-alt')).trim() === item.alt && (await has(page, 'item-visual')))
    await sleep(n === 0 ? 3500 : 1200)

    if (kind === 'case' && n === 0) {
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
      await shot(page, 'item-rkea', w)
      await click(page, 'lock-in')
      await page.waitForSelector('[data-testid="item-result"]')
      check(`item 1 result is correct with icon and word (${w})`, (await attr(page, 'item-result', 'data-ok')) === 'yes' && (await text(page, 'item-result')).includes('Correct'))
      const whys = await page.$$eval('[data-testid^="why-"]', (els) => els.filter((e) => !e.hidden && e.textContent.length > 10).length)
      check(`all four why lines shown after lock-in (${w})`, whys === 4, `${whys}`)
      await sleep(800)
      await shot(page, 'item-result', w)
      await click(page, 'next-item')
    } else if (kind === 'cold' && n === 0) {
      // Cold item: tag a key word so the shot shows the same RKEA player in use.
      const t = firstKeyTokenIndex(item)
      if (t >= 0) await click(page, `word-${t}`)
      await sleep(500)
      await shot(page, 'cold-item', w)
      await click(page, `option-${key}`)
      await click(page, 'lock-in')
      await page.waitForSelector('[data-testid="item-result"]')
      await click(page, 'next-item')
    } else if (kind === 'case' && n === 1) {
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
  return asked
}

/** Reads the report code from the screen and tests the Copy button against the real clipboard. */
async function readCode(page, w, label) {
  await page.waitForSelector('[data-testid="report-code"]')
  const code = (await text(page, 'report-code')).trim()
  check(`${label} shows a report code (${w})`, /^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{1,4}){3,}$/.test(code), code)
  await click(page, 'copy-code')
  await sleep(300)
  let clip = ''
  try {
    clip = await page.evaluate(() => navigator.clipboard.readText())
  } catch (e) {
    clip = `error: ${e.message}`
  }
  check(`${label} Copy puts the code on the clipboard (${w})`, clip === code, clip === code ? '' : clip.slice(0, 60))
  check(`${label} Copy confirms in words (${w})`, /Copied|Ctrl\+C/.test(await text(page, 'copy-status')))
  return code
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
  await shot(page, 'briefing', w)
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
      await shot(page, 'lab-a', w)
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
  await shot(page, 'lab-b', w)
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
    await click(page, `sort-backbone-${sp.backbone ? 'yes' : 'no'}`)
    if (i === 0) {
      await sleep(1500)
      await shot(page, 'lab-c', w)
    }
    await click(page, `sort-group-${sp.group}`)
    await click(page, 'lab-next')
    await sleep(200)
  }

  // Evidence check
  await playItems(page, w, 'case', 5)

  // Debrief
  await page.waitForSelector('[data-testid="debrief"]')
  await sleep(1400)
  check(`case closed stamp at 100 percent (${w})`, (await attr(page, 'case-stamp', 'data-closed')) === 'yes', await text(page, 'debrief-score'))
  const dItems = await page.$$('[data-testid^="debrief-item-"]')
  check(`debrief lists 5 items (${w})`, dItems.length === 5, `${dItems.length}`)
  await shot(page, 'debrief', w)
  await click(page, 'debrief-continue')

  // Results
  await page.waitForSelector('[data-testid="results"]')
  await sleep(2400)
  const bars = await page.$$('[data-testid^="mastery-bar-"]')
  check(`results shows a bar per benchmark (${w})`, bars.length === 3, `${bars.length}`)
  check(`intel earned shown (${w})`, Number((await text(page, 'intel-earned')).match(/\d+/)?.[0] ?? 0) > 0)
  check(`drone paint unlocked on first stage-up (${w})`, (await attr(page, 'paint-unlock', 'data-unlocked')) === 'yes')
  const code1 = await readCode(page, w, 'results')
  await shot(page, 'results-with-code', w)
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
  await page.click('[data-testid="codex-panel"] summary')
  check(`hub shows the same report code (${w})`, (await text(page, 'report-code')).trim() === code1)
  return code1
}

// ---------- S3: cold case RESIDUE ----------
async function playCold(page, w) {
  const cc = CONTENT.coldCase
  await page.evaluate(() => (location.hash = '#/hub'))
  await page.waitForSelector('[data-testid="hub"]')
  await sleep(500)
  check(`cold marker is playable and not due on day one (${w})`, (await attr(page, 'cold-marker', 'data-due')) === 'no')
  await click(page, 'cold-marker')
  await page.waitForSelector('[data-testid="cold-intro"]')
  check(`cold route is #/cold/cold-1 (${w})`, (await page.evaluate(() => location.hash)) === '#/cold/cold-1')
  check(`cold step bar starts at Scan (${w})`, (await text(page, 'step-indicator')).includes('Scan'))
  await waitRendered(page, 4500)
  await click(page, 'read-aloud')
  await sleep(1200)
  const lines = await text(page, 'briefing-text')
  check(`cold intro shows the coldCase briefing (${w})`, cc.briefing.every((l) => lines.includes(l.slice(0, 20))))
  await shot(page, 'cold-intro', w)
  await click(page, 'cold-continue')

  const asked = await playItems(page, w, 'cold', 4)
  check(`cold case has 4 items from the cold pool (${w})`, asked.length === 4 && asked.every((i) => i.pool === 'cold'), asked.map((i) => i.id).join(','))
  check(`cold items are distinct and span 2 categories (${w})`, new Set(asked.map((i) => i.id)).size === 4 && new Set(asked.map((i) => i.category)).size >= 2)

  await page.waitForSelector('[data-testid="debrief"]')
  await sleep(1000)
  check(`cold debrief uses coldCase.debriefClosed (${w})`, (await text(page, 'debrief')).includes(cc.debriefClosed))
  check(`cold debrief stamp (${w})`, (await attr(page, 'case-stamp', 'data-closed')) === 'yes')
  await click(page, 'debrief-continue')
  await page.waitForSelector('[data-testid="results"]')
  await sleep(1800)
  const nb = new Set(asked.map((i) => i.benchmark)).size
  const bars = await page.$$('[data-testid^="mastery-bar-"]')
  check(`cold results shows a bar per benchmark (${w})`, bars.length === nb, `${bars.length} of ${nb}`)
  const code2 = await readCode(page, w, 'cold results')
  await click(page, 'back-to-hub')
  await page.waitForSelector('[data-testid="hub"]')
  return code2
}

const preview = await startPreview()
let browser
let exitCode = 0
let lastStore = null
let lastCode = ''
try {
  browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: CHROME_ARGS })
  await browser.defaultBrowserContext().overridePermissions(BASE.slice(0, -1), ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write'])

  for (const vp of VIEWPORTS) {
    const w = vp.width
    console.log(`\n== viewport ${w}x${vp.height} ==`)
    const page = await freshPage(browser, vp, `${w}`)

    // Title
    await page.waitForSelector('[data-testid="title"]')
    await waitRendered(page)
    await shot(page, 'title', w)
    const info = await page.evaluate(() => window.__anomaly)
    check(`title renders (${w})`, !!info && info.backend !== 'none', JSON.stringify(info))
    check(`start button present (${w})`, !!(await page.$('[data-testid="start-shift"]')))

    // Resume modal opens from the title and rejects junk with a clear message
    await page.click('[data-testid="resume-code"]')
    await page.waitForSelector('[data-testid="resume-modal"]')
    await page.type('[data-testid="resume-input"]', 'ABCD-EFGH-JKMN-PQRS')
    await sleep(200)
    check(`resume rejects a bad code with a message (${w})`, /checksum|short/i.test(await text(page, 'resume-error')), await text(page, 'resume-error'))
    await page.keyboard.press('Escape')
    await sleep(200)

    // First run modal
    await page.click('[data-testid="start-shift"]')
    await page.waitForSelector('[data-testid="firstrun-modal"]')
    await page.type('[data-testid="classcode-input"]', 'demo!x')
    const code = await page.$eval('[data-testid="classcode-input"]', (el) => el.value)
    check(`class code sanitized (${w})`, code === 'DEMOX', code)
    await page.click('[data-testid="classcode-input"]', { clickCount: 3 })
    await page.keyboard.press('Backspace')
    await page.type('[data-testid="classcode-input"]', 'DEMO')
    await page.click('[data-testid="agent-input"]', { clickCount: 3 })
    await page.type('[data-testid="agent-input"]', '14')
    await sleep(500)
    const preview14 = await page.$eval('[data-testid="codename-preview"]', (el) => el.textContent)
    check(`codename preview (${w})`, /^AGENT [A-Z]+-14$/.test(preview14), preview14)
    await shot(page, 'firstrun', w)
    await page.click('[data-testid="firstrun-confirm"]')

    // Hub
    await page.waitForSelector('[data-testid="hub"]')
    await sleep(3500)
    await shot(page, 'hub', w)
    const codename = await page.$eval('[data-testid="codename"]', (el) => el.textContent)
    check(`hub shows codename (${w})`, codename === preview14, codename)
    check(`case marker button (${w})`, !!(await page.$('[data-testid="case-marker-03-1"]')))
    check(`cold marker button (${w})`, !!(await page.$('[data-testid="cold-marker"]')))
    check(`hub shows a report code with Copy (${w})`, (await has(page, 'report-code')) && (await has(page, 'copy-code')))
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
    await shot(page, 'settings', w)
    if (w === 1366) await page.click('[data-testid="setting-show-fps"]')

    page.setDefaultTimeout(60000)
    const code1 = await playCase(page, w)
    const code2 = await playCold(page, w)
    check(`the code grows after the cold case (${w})`, code2.length > code1.length, `${code1.length} to ${code2.length} chars`)
    lastCode = code2

    if (w === 1366) {
      // Hub marker: due only when a cold benchmark review date has passed.
      await page.evaluate(() => {
        const raw = JSON.parse(localStorage.getItem('anomaly.v1'))
        for (const r of Object.values(raw.state.progress)) r.nextDue = '2026-01-05'
        localStorage.setItem('anomaly.v1', JSON.stringify(raw))
      })
      await page.reload({ waitUntil: 'load' })
      await page.waitForSelector('[data-testid="hub"]')
      await sleep(800)
      check('cold marker shows Review due when a review date has passed', (await attr(page, 'cold-marker', 'data-due')) === 'yes' && (await text(page, 'cold-marker')).includes('Review due'))
      await page.evaluate(() => {
        const raw = JSON.parse(localStorage.getItem('anomaly.v1'))
        for (const r of Object.values(raw.state.progress)) r.nextDue = '2099-01-05'
        localStorage.setItem('anomaly.v1', JSON.stringify(raw))
      })
      await page.reload({ waitUntil: 'load' })
      await page.waitForSelector('[data-testid="hub"]')
      check('cold marker not due when reviews are in the future', (await attr(page, 'cold-marker', 'data-due')) === 'no')
    }
    lastStore = await page.evaluate(() => localStorage.getItem('anomaly.v1'))
    const storeState = JSON.parse(lastStore).state

    // Resume on a clean device (separate browser context, empty storage)
    if (w === 1366) {
      const ctx = await browser.createBrowserContext()
      const rp = await ctx.newPage()
      watch(rp, 'resume')
      await rp.setViewport({ ...vp, deviceScaleFactor: 1 })
      await rp.goto(BASE, { waitUntil: 'load' })
      await rp.waitForSelector('[data-testid="title"]')
      await rp.click('[data-testid="resume-code"]')
      await rp.waitForSelector('[data-testid="resume-modal"]')
      await rp.type('[data-testid="resume-input"]', lastCode.toLowerCase())
      await rp.type('[data-testid="resume-class-input"]', 'WRONG')
      await sleep(200)
      check('resume refuses a mismatched class code', /class code/i.test(await text(rp, 'resume-error')))
      await rp.click('[data-testid="resume-class-input"]', { clickCount: 3 })
      await rp.keyboard.press('Backspace')
      await rp.type('[data-testid="resume-class-input"]', 'DEMO')
      await sleep(200)
      check('resume previews the codename', (await text(rp, 'resume-preview')).startsWith(codename))
      await rp.click('[data-testid="resume-confirm-btn"]')
      await rp.waitForSelector('[data-testid="hub"]')
      const restored = await rp.evaluate(() => JSON.parse(localStorage.getItem('anomaly.v1')).state)
      check('resume restores profile and progress on a clean device', restored.profile.agentNumber === 14 && restored.profile.classCode === 'DEMO' && Object.keys(restored.progress).length === Object.keys(storeState.progress).length, `${Object.keys(restored.progress).length} benchmarks`)
      const sameStage = Object.entries(storeState.progress).every(([id, r]) => restored.progress[id]?.stage === r.stage && restored.progress[id]?.attempts === r.attempts)
      check('restored stages and attempts match the original', sameStage)
      // Merge, never wipe: a different agent needs an explicit confirm.
      await rp.evaluate(() => (location.hash = '#/'))
      await rp.waitForSelector('[data-testid="resume-code"]')
      await rp.click('[data-testid="resume-code"]')
      await rp.waitForSelector('[data-testid="resume-modal"]')
      await rp.$eval('[data-testid="resume-input"]', (e) => (e.value = ''))
      await rp.type('[data-testid="resume-input"]', lastCode)
      const sameAgentWarn = await has(rp, 'resume-warn')
      check('same agent resumes without a switch warning', !sameAgentWarn)
      await ctx.close()
    }

    // Teacher HQ (must not load three)
    const tp = await browser.newPage()
    watch(tp, `teacher-${w}`)
    await tp.setViewport({ ...vp, deviceScaleFactor: 1 })
    const urls = []
    tp.on('request', (r) => urls.push(r.url()))
    const cdp = await browser.target().createCDPSession()
    const dl = `/tmp/anomaly-proof-dl-${w}`
    rmSync(dl, { recursive: true, force: true })
    mkdirSync(dl, { recursive: true })
    await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dl })
    await tp.goto(BASE + 'teacher.html', { waitUntil: 'networkidle0' })
    await tp.waitForSelector('[data-testid="teacher-hq"]')
    check(`teacher page loads no three chunk (${w})`, urls.filter((u) => /three|Stage|Scene/i.test(u)).length === 0, urls.filter((u) => /three|Stage|Scene/i.test(u)).join(','))
    check(`teacher page has paste, decode, sample and Canvas help (${w})`, (await has(tp, 'teacher-paste')) && (await has(tp, 'teacher-decode')) && (await has(tp, 'load-sample')) && (await has(tp, 'canvas-help')))

    await click(tp, 'load-sample')
    await tp.waitForSelector('[data-testid="heatmap"]')
    const cols = await tp.$$eval('[data-testid="heatmap"] thead .agent-h', (e) => e.length)
    check(`sample class decodes 24 agents (${w})`, cols === 24, `${cols}`)
    check(`teacher status counts agents (${w})`, (await text(tp, 'teacher-status')).startsWith('24 agents decoded'))
    const cellInfo = await tp.$$eval('[data-testid="heatmap"] td', (tds) => ({ total: tds.length, blank: tds.filter((t) => !t.textContent.trim()).length, vals: tds.filter((t) => t.classList.contains('val')).length }))
    check(`every heatmap cell shows a number or a dash (${w})`, cellInfo.blank === 0 && cellInfo.vals > 100, JSON.stringify(cellInfo))
    const cats = await tp.$$eval('[data-testid="categories"] li', (e) => e.map((x) => x.textContent))
    check(`four reporting category bars (${w})`, cats.length === 4 && cats[0].includes('Nature of Science') && cats[1].includes('Earth and Space') && cats[2].includes('Physical') && cats[3].includes('Life'))
    check(`weakest 5 benchmarks (${w})`, (await tp.$$eval('[data-testid="weakest"] li', (e) => e.length)) === 5)
    const missed = await tp.$$eval('[data-testid="most-missed"] tbody tr', (e) => e.map((x) => x.textContent))
    check(`most missed items show id and stem (${w})`, missed.length >= 3 && /^[A-Z]\d+-\d+/.test(missed[0]), missed[0]?.slice(0, 70))
    await sleep(300)
    await shot(tp, 'teacher-sample', w, { fullPage: true })

    // CSV download
    await click(tp, 'download-csv')
    let csvFile = null
    for (let i = 0; i < 30 && !csvFile; i++) {
      await sleep(200)
      csvFile = readdirSync(dl).find((f) => f.endsWith('.csv'))
    }
    const csv = csvFile ? readFileSync(join(dl, csvFile), 'utf8') : ''
    check(`CSV download has a header and rows (${w})`, csv.startsWith('class,agent,benchmark') && csv.trim().split('\n').length > 100, `${csv.trim().split('\n').length} lines`)

    // Decode the real code from the results screen, wrapped in other text like a Canvas export would be.
    await tp.click('[data-testid="teacher-paste"]', { clickCount: 1 })
    await tp.$eval('[data-testid="teacher-paste"]', (e) => {
      e.focus()
      e.select()
    })
    await tp.keyboard.press('Backspace')
    await tp.type('[data-testid="teacher-paste"]', `Student,Submission\n"Agent 14","${lastCode}"\nnot-a-code and some words\n`, { delay: 0 })
    await click(tp, 'teacher-decode')
    await tp.waitForFunction(() => document.querySelectorAll('[data-testid="heatmap"] thead .agent-h').length === 1)
    check(`teacher decodes the code copied from the results screen (${w})`, (await text(tp, 'teacher-status')).startsWith('1 agent decoded'), await text(tp, 'teacher-status'))
    const prog = storeState.progress
    const rows = Object.keys(prog).length
    const heatRows = await tp.$$eval('[data-testid="heatmap"] tbody tr', (e) => e.length)
    check(`heatmap has a row per benchmark played (${w})`, heatRows === rows, `${heatRows} of ${rows}`)
    const id0 = Object.keys(prog).find((k) => k === 'SC.5.L.14.1')
    const expectPct = Math.round((prog[id0].correct / prog[id0].attempts) * 100)
    check(`teacher cell matches the game for ${id0} (${w})`, (await text(tp, `cell-${id0}-14`)).trim() === String(expectPct), `${await text(tp, `cell-${id0}-14`)} vs ${expectPct}`)
    await sleep(300)
    await shot(tp, 'teacher-decoded', w, { fullPage: true })
    await tp.close()
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

  // ---------- fps under 4x CPU throttle, hub and lab A ----------
  const vp = VIEWPORTS[0]
  async function sampleFps(label, goTo) {
    console.log(`\n== fps under 4x CPU throttle (${label}) ==`)
    const page = await browser.newPage()
    watch(page, `fps-${label}`)
    await page.setViewport({ ...vp, deviceScaleFactor: 1 })
    await page.goto(BASE, { waitUntil: 'load' })
    await page.evaluate((s) => localStorage.setItem('anomaly.v1', s), lastStore)
    const cdp = await page.createCDPSession()
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
    await goTo(page)
    await waitRendered(page, 1500)
    const first = await page.evaluate(() => window.__anomaly)
    const samples = []
    for (let i = 0; i < 20; i++) {
      await sleep(500)
      samples.push((await page.evaluate(() => window.__anomaly)).fps)
    }
    const last = await page.evaluate(() => window.__anomaly)
    const avg = Math.round((samples.reduce((a, b) => a + b, 0) / samples.length) * 10) / 10
    const result = { backend: last.backend, tierStart: first.tier, tierEnd: last.tier, quality: 'auto', durationSeconds: 10, fpsAvg: avg, fpsMin: Math.min(...samples), fpsMax: Math.max(...samples), fpsSamples: samples }
    console.log(JSON.stringify({ ...result, fpsSamples: `${samples.length} samples` }))
    check(`fps samples collected on ${label}`, samples.length === 20 && avg > 0, `avg ${avg}, min ${result.fpsMin}, tier ${result.tierStart} to ${result.tierEnd}`)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
    await page.close()
    return result
  }
  const hubFps = await sampleFps('hub', async (page) => {
    await page.goto(BASE + '#/hub', { waitUntil: 'load' })
    await page.waitForSelector('[data-testid="hub"]', { timeout: 120000 })
  })
  const labFps = await sampleFps('lab-a', async (page) => {
    await page.goto(BASE + '#/case/03-1', { waitUntil: 'load' })
    await page.waitForSelector('[data-testid="briefing"]', { timeout: 120000 })
    await sleep(1500)
    await page.click('[data-testid="briefing-continue"]')
    await page.waitForSelector('[data-testid="lab-a"]', { timeout: 120000 })
  })

  // ---------- initial load transfer (title page, clean context, cache off) ----------
  console.log('\n== initial load size ==')
  const ctx = await browser.createBrowserContext()
  const lp = await ctx.newPage()
  watch(lp, 'load')
  await lp.setViewport({ ...vp, deviceScaleFactor: 1 })
  const cdp = await lp.createCDPSession()
  await cdp.send('Network.enable')
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
  const reqs = new Map()
  let transferred = 0
  cdp.on('Network.responseReceived', (e) => reqs.set(e.requestId, { url: e.response.url, status: e.response.status, bytes: 0 }))
  cdp.on('Network.loadingFinished', (e) => {
    const r = reqs.get(e.requestId)
    if (r) {
      r.bytes = e.encodedDataLength
      transferred += e.encodedDataLength
    }
  })
  await lp.goto(BASE, { waitUntil: 'load' })
  await lp.waitForSelector('[data-testid="title"]')
  await waitRendered(lp, 2500)
  const initial = [...reqs.values()].filter((r) => r.url.startsWith(BASE))
  const largest = initial.sort((a, b) => b.bytes - a.bytes).slice(0, 5).map((r) => ({ file: r.url.replace(BASE, ''), bytes: r.bytes }))
  await ctx.close()

  const walk = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]))
  const distFiles = walk(join(ROOT, 'dist'))
  const distBytes = distFiles.reduce((n, f) => n + statSync(f).size, 0)
  const distGzipBytes = distFiles.reduce((n, f) => n + (/\.(png|woff2)$/.test(f) ? statSync(f).size : gzipSync(readFileSync(f)).length), 0)
  const transfer = { initialLoadBytes: transferred, initialLoadRequests: initial.length, initialLoadLargest: largest, distBytes, distGzipBytes, distFiles: distFiles.length }
  check('initial load is under 5 MB transferred', transferred < 5 * 1024 * 1024, `${(transferred / 1024).toFixed(0)} KB over ${initial.length} requests`)
  console.log(JSON.stringify(transfer))

  writeFileSync(`${OUT}/fps.json`, JSON.stringify({ throttle: 4, viewport: vp, hub: hubFps, labA: labFps, transfer }, null, 2))

  // ---------- test counts and summary ----------
  console.log('\n== unit tests ==')
  const jsonOut = '/tmp/anomaly-vitest.json'
  rmSync(jsonOut, { force: true })
  spawnSync('npx', ['vitest', 'run', '--reporter=json', `--outputFile=${jsonOut}`], { cwd: ROOT, stdio: 'ignore' })
  let tests = { total: 0, passed: 0, failed: 0, files: 0 }
  if (existsSync(jsonOut)) {
    const j = JSON.parse(readFileSync(jsonOut, 'utf8'))
    tests = { total: j.numTotalTests, passed: j.numPassedTests, failed: j.numFailedTests, files: j.numTotalTestSuites ?? j.testResults?.length }
    tests.files = j.testResults?.length ?? tests.files
  }
  check('unit tests all pass', tests.total > 0 && tests.failed === 0, `${tests.passed}/${tests.total} in ${tests.files} files`)

  console.log('\n== summary ==')
  const failed = checks.filter((c) => !c.ok)
  const expected = ORDER.length * VIEWPORTS.length
  check(`all ${expected} screenshots written`, shots.length === expected && shots.every((s) => existsSync(join(OUT, s))), `${shots.length}`)
  const failed2 = checks.filter((c) => !c.ok)
  console.log(`${checks.length - failed2.length}/${checks.length} checks passed`)
  console.log(`console errors / page errors: ${errors.length}`)
  for (const e of errors) console.log('  ' + e)
  writeFileSync(
    `${OUT}/proof-summary.json`,
    JSON.stringify(
      {
        ok: failed2.length === 0 && errors.length === 0,
        consoleErrors: errors.length,
        errors,
        checks: { total: checks.length, failed: failed2.map((c) => `${c.name} ${c.detail}`) },
        screenshots: shots.slice().sort(),
        tests,
        fps: { hub: { avg: hubFps.fpsAvg, min: hubFps.fpsMin, tierStart: hubFps.tierStart, tierEnd: hubFps.tierEnd }, labA: { avg: labFps.fpsAvg, min: labFps.fpsMin, tierStart: labFps.tierStart, tierEnd: labFps.tierEnd }, backend: hubFps.backend },
        transfer,
        viewports: VIEWPORTS,
      },
      null,
      2,
    ),
  )
  void failed
  if (failed2.length || errors.length) exitCode = 1
} catch (e) {
  console.error('proof crashed:', e)
  exitCode = 1
} finally {
  await browser?.close()
  preview.kill()
}
process.exit(exitCode)
