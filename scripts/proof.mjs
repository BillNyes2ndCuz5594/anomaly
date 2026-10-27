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
import { fitReport, profilePage, svgReport, setTextSize, toCaseStep } from './lib/drive.mjs'
import { setTimeout as sleep } from 'node:timers/promises'

const OUT = process.env.PROOF_OUT || '/workspace/anomaly-proof'
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
// Every screenshot run pins tier High (bloom, vignette, grain, contact shadow) so the proof shows the real look.
const QS = '?tier=high&still=1'
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
  '--disable-dev-shm-usage',
  '--renderer-process-limit=2',
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
  const proc = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'], cwd: ROOT })
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

function checkSvg(name, r) {
  const bad = [...r.outside.map((x) => `outside ${x}`), ...r.overlaps.map((x) => `overlap ${x}`), ...r.small.map((x) => `small ${x}`), ...r.letterboxed.map((x) => `letterbox ${x}`)]
  check(`${name}: ${r.svgs} svgs, ${r.texts} texts inside viewBox, no label overlap, min ${r.minPx == null ? 'n/a' : r.minPx.toFixed(1)}px`, r.svgs > 0 && bad.length === 0, bad.join('; '))
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
  await page.goto(BASE + QS + hash, { waitUntil: 'load' })
  await page.evaluate(() => localStorage.clear())
  await page.goto(BASE + QS + hash, { waitUntil: 'load' })
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
const ORDER = ['title', 'firstrun', 'hub', 'settings', 'briefing', 'lab-a', 'lab-b', 'lab-c', 'item-rkea', 'item-result', 'debrief', 'results-with-code', 'cold-intro', 'cold-item', 'teacher-sample', 'teacher-decoded', 'visuals-scenes', 'visuals-models', 'debrief-burst', 'results-burst', 'visuals-scenes-xl', 'cold-item-xl']
/** Pauses every light-burst animation at its midpoint so the screenshot catches the particles. */
async function freezeBursts(page) {
  return page.evaluate(() => {
    let n = 0
    for (const a of document.getAnimations()) {
      const el = a.effect?.target
      if (el && el.closest && el.closest('.burst')) {
        const t = a.effect.getTiming()
        a.pause()
        a.currentTime = Number(t.delay) + Number(t.duration) * 0.3
        n++
      }
    }
    return n
  })
}
const sceneStats = {}
/** The art check grid scrolls inside the screen, so grow the viewport to the content for the shot, then restore it. */
async function shotTall(page, name, w, vp) {
  const need = await page.evaluate(() => {
    const g = document.querySelector('.visuals-grid')
    return g ? Math.ceil(g.scrollHeight + g.getBoundingClientRect().top + 24) : 0
  })
  const h = Math.max(vp.height, need)
  await page.setViewport({ width: vp.width, height: h, deviceScaleFactor: 1 })
  await sleep(1500)
  await shot(page, name, w)
  await page.setViewport({ ...vp, deviceScaleFactor: 1 })
  await sleep(500)
}
async function shot(page, name, w, opts = {}) {
  if (!name.startsWith('teacher')) {
    // Software GPUs are slow: wait for several fresh frames (and the post pipeline) before capturing.
    const f0 = await page.evaluate(() => window.__anomaly?.frame ?? 0)
    await page.waitForFunction((f) => (window.__anomaly?.frame ?? 0) >= f + 3, { timeout: 60000, polling: 200 }, f0).catch(() => {})
    const a = await page.evaluate(() => window.__anomaly)
    if (a && w === VIEWPORTS[0].width) sceneStats[name] = { tier: a.tier, backend: a.backend, calls: a.calls, triangles: a.triangles, geometries: a.geometries, textures: a.textures }
  }
  const write = async (nm) => {
    const n = String(ORDER.indexOf(nm) + 1).padStart(2, '0')
    const file = `${n}-${nm}-${w}.png`
    await page.screenshot({ path: `${OUT}/${file}`, ...opts })
    shots.push(file)
  }
  if (name === 'debrief' || name === 'results-with-code') {
    // Catch the burst mid flight for the particle check and one extra shot, then settle and shoot the real screen.
    const frozen = await freezeBursts(page)
    check(`light burst particles present on ${name} (${w})`, frozen >= 10, `${frozen} animations`)
    if (frozen) await write(name === 'debrief' ? 'debrief-burst' : 'results-burst')
    await page.evaluate(() => document.getAnimations().forEach((a) => a.finish()))
    const leftover = await page.evaluate(() => [...document.querySelectorAll('.burst i')].filter((e) => getComputedStyle(e).opacity !== '0').length)
    check(`burst is fully faded on the settled ${name} screen (${w})`, leftover === 0, `${leftover} visible parts`)
  }
  // Every model viewport must show its whole model: projected bbox inside the canvas rect.
  const fits = await fitReport(page)
  for (const f of fits) check(`${name} model bbox fully inside canvas ${f.canvasW}x${f.canvasH} (${w})`, f.over <= 0.001, `over ${f.over.toFixed(3)}`)
  await write(name)
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
writeFileSync(`/tmp/an${(process.env.AN_TAG ? '-' + process.env.AN_TAG : '')}-preview.pid`, String(preview.pid))
let browser
let exitCode = 0
let lastStore = null
let lastCode = ''
try {
  browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: true, protocolTimeout: 300000, args: CHROME_ARGS })
  writeFileSync(`/tmp/an${(process.env.AN_TAG ? '-' + process.env.AN_TAG : '')}-chrome.pid`, String(browser.process()?.pid ?? ''))
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
    check(`proof screenshots run at tier high (${w})`, info.tier === 'high', info.tier)
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
      await rp.goto(BASE + QS, { waitUntil: 'load' })
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

    // Art check page: scene diagrams and the specimen models
    await page.goto(BASE + QS + '#/visuals', { waitUntil: 'load' })
    await page.waitForSelector('[data-testid="visuals-scenes"] svg')
    check(`visuals page shows every scene diagram (${w})`, (await page.$$('[data-testid="visuals-scenes"] svg')).length >= 8, `${(await page.$$('[data-testid="visuals-scenes"] svg')).length}`)
    await sleep(1800)
    await shotTall(page, 'visuals-scenes', w, vp)
    await page.evaluate(() => (location.hash = '#/visuals/models'))
    await page.waitForSelector('[data-testid="visuals-models"] canvas', { timeout: 60000 })
    await sleep(9000)
    await shot(page, 'visuals-models', w)

    // Diagram labels: Normal, then Extra large text. Art check page and the cold item in the real player.
    await page.goto(BASE + QS + '#/visuals', { waitUntil: 'load' })
    await page.waitForSelector('[data-testid="visuals-scenes"] svg')
    await sleep(900)
    const rep0 = await svgReport(page)
    checkSvg(`art check diagrams at Normal text (${w})`, rep0)
    await setTextSize(page, 2)
    await page.goto(BASE + QS + '#/visuals', { waitUntil: 'load' })
    await page.waitForSelector('[data-testid="visuals-scenes"] svg')
    await sleep(1200)
    checkSvg(`art check diagrams at Extra large text (${w})`, await svgReport(page))
    await shotTall(page, 'visuals-scenes-xl', w, vp)
    await page.evaluate(() => (location.hash = '#/cold/cold-1'))
    await page.waitForSelector('[data-testid="cold-intro"]')
    await sleep(600)
    await click(page, 'cold-continue')
    await page.waitForSelector('[data-testid="item-player"]')
    // The cold pool is shuffled: answer items until one with a diagram is on screen.
    for (let n = 0; n < 4 && !(await page.$('svg.scene-svg')); n++) {
      const stemText = (await text(page, 'stem')).replace(/\s+/g, ' ').trim()
      const it = CONTENT.items.find((x) => tokenize(x.stem).join(' ') === stemText)
      await click(page, `option-${it.key}`)
      await click(page, 'lock-in')
      await page.waitForSelector('[data-testid="item-result"]')
      await click(page, 'next-item')
      await page.waitForSelector('[data-testid="stem"]')
      await sleep(600)
    }
    await sleep(2500)
    checkSvg(`cold item diagram at Extra large text (${w})`, await svgReport(page))
    await shot(page, 'cold-item-xl', w)
    // every other text size, on the cold item and every art check diagram
    for (const t of [1, 0]) {
      await setTextSize(page, t)
      await page.goto(BASE + QS + '#/visuals', { waitUntil: 'load' })
      await page.waitForSelector('[data-testid="visuals-scenes"] svg')
      await sleep(900)
      checkSvg(`art check diagrams at text size ${t} (${w})`, await svgReport(page))
    }

    // Teacher HQ (must not load three)
    const tp = await browser.newPage()
    watch(tp, `teacher-${w}`)
    await tp.setViewport({ ...vp, deviceScaleFactor: 1 })
    const urls = []
    tp.on('request', (r) => urls.push(r.url()))
    const cdp = await browser.target().createCDPSession()
    const dl = `/tmp/anomaly-proof-dl${(process.env.AN_TAG ? '-' + process.env.AN_TAG : '')}-${w}`
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
    // S20: summary, legend, sort, reteach filter, copy, no horizontal page overflow
    const sumTxt = await tp.$eval('[data-testid="summary"]', (e) => e.textContent)
    check(`teacher summary shows students, average and reteach count (${w})`, /Students\s*24/.test(sumTxt) && /Average mastery\s*\d+%/.test(sumTxt) && /Need reteach\s*\d+ of \d+/.test(sumTxt), sumTxt.slice(0, 120))
    check(`teacher legend lists three marked levels (${w})`, (await text(tp, 'band-legend')).includes('Reteach') && (await text(tp, 'band-legend')).includes('Secure'))
    const flagged = await tp.$$eval('[data-testid="row-reteach"]', (e) => e.length)
    check(`reteach rows are tagged with text (${w})`, flagged > 0 && (await tp.$$eval('[data-testid="row-reteach"] .pill', (e) => e.every((x) => x.textContent === 'Reteach'))), `${flagged}`)
    await tp.select('[data-testid="sort-benchmarks"]', 'low')
    const classCol = await tp.$$eval('[data-testid="heatmap"] tbody tr', (rows) => rows.map((r) => parseInt(r.querySelector('td.avg').textContent, 10)))
    check(`sort benchmarks lowest first (${w})`, classCol.every((v, i) => i === 0 || classCol[i - 1] <= v), classCol.join(','))
    await tp.select('[data-testid="sort-agents"]', 'low')
    const avgs = await tp.$$eval('[data-testid="heatmap"] tfoot td.val', (c) => c.map((x) => parseInt(x.textContent, 10)))
    check(`sort agents lowest average first (${w})`, avgs.length === 24 && avgs.every((v, i) => i === 0 || avgs[i - 1] <= v), avgs.join(','))
    await click(tp, 'only-reteach')
    const onlyRows = await tp.$$eval('[data-testid="heatmap"] tbody tr', (e) => e.length)
    check(`reteach rows only filter (${w})`, onlyRows === flagged, `${onlyRows} vs ${flagged}`)
    await click(tp, 'only-reteach')
    await tp.select('[data-testid="sort-benchmarks"]', 'catalog')
    await tp.select('[data-testid="sort-agents"]', 'agent')
    await click(tp, 'copy-tsv')
    await tp.waitForFunction(() => document.querySelector('[data-testid="copy-status"]')?.textContent.startsWith('Copied'))
    check(`copy for gradebook confirms (${w})`, (await text(tp, 'copy-status')).includes('24 agents'))
    const overflow = await tp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    check(`teacher page has no horizontal overflow (${w})`, overflow <= 0, `${overflow}`)
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
    check(`teacher cell matches the game for ${id0} (${w})`, (await text(tp, `cell-${id0}-14`)).trim().match(/^\d+/)?.[0] === String(expectPct), `${await text(tp, `cell-${id0}-14`)} vs ${expectPct}`)
    await sleep(300)
    await shot(tp, 'teacher-decoded', w, { fullPage: true })
    await tp.close()
    await page.close()
  }

  // Narrow laptop check: the organ item at 1280x720 shows the whole body and the base ring.
  {
    const vp720 = { width: 1280, height: 720 }
    const page = await profilePage(browser, BASE, QS, vp720, errors)
    await toCaseStep(page, 'items')
    await sleep(4500)
    await shot(page, 'item-rkea', 1280)
    const fits = await fitReport(page)
    check('organ item model fits at 1280x720', fits.length >= 1 && fits.every((f) => f.over <= 0.001), fits.map((f) => f.over.toFixed(3)).join(','))
    await page.close()
  }

  // S11: specimens in the real item player. ?qaitems deep links the case to the organ item, owl and pelican,
  // grasshopper and spider, panther and crab, and the four-animal group item, shot at 1920 as s11-gameplay-<id>-1920.png.
  {
    const ids = ['L14-01', 'L315-03', 'L315-07', 'L142-02', 'L315-01', 'L142-07']
    const page = await profilePage(browser, BASE, `${QS}&qaitems=${ids.join(",")}`, VIEWPORTS.find((v) => v.width === 1920), errors)
    await toCaseStep(page, 'items')
    for (const id of ids) {
      const item = CONTENT.items.find((x) => x.id === id)
      await page.waitForSelector('[data-testid="stem"]')
      check(`gameplay deep link shows ${id} in the real item player`, tokenize(await text(page, 'stem')).join(' ') === tokenize(item.stem).join(' '))
      await sleep(5500)
      const f0 = await page.evaluate(() => window.__anomaly?.frame ?? 0)
      await page.waitForFunction((f) => (window.__anomaly?.frame ?? 0) >= f + 3, { timeout: 60000, polling: 200 }, f0).catch(() => {})
      const a = await page.evaluate(() => window.__anomaly)
      sceneStats[`gameplay-${id}`] = { tier: a.tier, backend: a.backend, calls: a.calls, triangles: a.triangles, geometries: a.geometries, textures: a.textures }
      const fits = await fitReport(page)
      check(`gameplay ${id} model fully inside its canvas with margin (1920)`, fits.length >= 1 && fits.every((f) => f.over <= -0.02), fits.map((f) => f.over.toFixed(3)).join(','))
      const inside = await page.evaluate(() => {
        const c = document.querySelector('[data-testid="item-visual"] canvas')
        if (!c) return null
        const r = c.getBoundingClientRect()
        return (Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)) * Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0))) / (r.width * r.height)
      })
      check(`gameplay ${id} specimen canvas at least 60% inside the first viewport (1920)`, inside !== null && inside >= 0.6, String(inside?.toFixed(2)))
      await page.screenshot({ path: `${OUT}/s11-gameplay-${id}-1920.png` })
      shots.push(`s11-gameplay-${id}-1920.png`)
      // S15: the two stage showcase items again under the s15-stage name, for before and after review.
      if (id === 'L142-02' || id === 'L315-07') {
        await page.screenshot({ path: `${OUT}/s15-stage-${id}-1920.png` })
        shots.push(`s15-stage-${id}-1920.png`)
      }
      await click(page, `option-${item.key}`)
      await click(page, 'lock-in')
      await page.waitForSelector('[data-testid="item-result"]')
      await sleep(300)
      await click(page, 'next-item')
      await sleep(400)
    }
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

  // ---------- fps under 4x CPU throttle, hub and lab A, per backend (Auto tier, no ?tier pin) ----------
  const vp = VIEWPORTS[0]
  const BACKENDS = { webgpu: '', webgl2: '?backend=webgl2' }
  async function sampleFps(label, search, goTo, { throttle = 4, seconds = 10 } = {}) {
    console.log(`\n== fps ${label} (${throttle}x CPU, ${seconds} s) ==`)
    const page = await browser.newPage()
    watch(page, `fps-${label}`)
    await page.setViewport({ ...vp, deviceScaleFactor: 1 })
    await page.goto(BASE + search, { waitUntil: 'load' })
    await page.evaluate((s) => localStorage.setItem('anomaly.v1', s), lastStore)
    const cdp = await page.createCDPSession()
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle })
    await goTo(page, search)
    await waitRendered(page, 1500)
    const first = await page.evaluate(() => window.__anomaly)
    const samples = []
    const n = seconds * 2
    for (let i = 0; i < n; i++) {
      await sleep(500)
      samples.push((await page.evaluate(() => window.__anomaly)).fps)
    }
    const last = await page.evaluate(() => window.__anomaly)
    const avg = Math.round((samples.reduce((a, b) => a + b, 0) / samples.length) * 10) / 10
    const result = { backend: last.backend, tierStart: first.tier, tierEnd: last.tier, quality: 'auto', throttle, durationSeconds: seconds, fpsAvg: avg, fpsMin: Math.min(...samples), fpsMax: Math.max(...samples), calls: last.calls, fpsSamples: samples }
    console.log(JSON.stringify({ ...result, fpsSamples: `${samples.length} samples` }))
    check(`fps samples collected on ${label}`, samples.length === n && avg > 0, `avg ${avg}, min ${result.fpsMin}, tier ${result.tierStart} to ${result.tierEnd}`)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
    await page.close()
    return result
  }
  const goHub = async (page, search) => {
    await page.goto(BASE + search + '#/hub', { waitUntil: 'load' })
    await page.waitForSelector('[data-testid="hub"]', { timeout: 120000 })
  }
  const goLabA = async (page, search) => {
    await page.goto(BASE + search + '#/case/03-1', { waitUntil: 'load' })
    await page.waitForSelector('[data-testid="briefing"]', { timeout: 120000 })
    await sleep(1500)
    await page.click('[data-testid="briefing-continue"]')
    await page.waitForSelector('[data-testid="lab-a"]', { timeout: 120000 })
  }
  const fpsByBackend = {}
  for (const [name, search] of Object.entries(BACKENDS)) {
    const hub = await sampleFps(`hub ${name}`, search, goHub)
    const labA = await sampleFps(`lab-a ${name}`, search, goLabA)
    const hubFree = await sampleFps(`hub ${name} unthrottled`, search, goHub, { throttle: 1, seconds: 5 })
    check(`backend ${name} honoured by the URL override`, hub.backend === name && labA.backend === name, `${hub.backend}`)
    fpsByBackend[name] = { hub, labA, hubUnthrottled: hubFree }
  }
  const hubFps = fpsByBackend.webgpu.hub
  const labFps = fpsByBackend.webgpu.labA

  // ---------- draw calls per scene, tier pins, Low tier really drops the extras, no leaks on unmount ----------
  console.log('\n== draw calls and tier pins ==')
  async function readScene(search, goTo, settleMs = 2500) {
    const page = await browser.newPage()
    watch(page, 'scene-stats')
    await page.setViewport({ ...vp, deviceScaleFactor: 1 })
    await page.goto(BASE + search, { waitUntil: 'load' })
    await page.evaluate((s) => localStorage.setItem('anomaly.v1', s), lastStore)
    await goTo(page, search)
    await waitRendered(page, settleMs)
    const f0 = await page.evaluate(() => window.__anomaly.frame)
    await page.waitForFunction((f) => window.__anomaly.frame >= f + 3, { timeout: 60000, polling: 200 }, f0)
    const a = await page.evaluate(() => window.__anomaly)
    const post = await page.evaluate(() => !!document.querySelector('canvas'))
    await page.close()
    return { tier: a.tier, calls: a.calls, triangles: a.triangles, geometries: a.geometries, textures: a.textures, canvas: post }
  }
  const pins = {}
  for (const tier of ['low', 'medium', 'high', 'ultra']) {
    pins[tier] = { hub: await readScene(`?tier=${tier}`, goHub), labA: await readScene(`?tier=${tier}`, goLabA) }
    check(`?tier=${tier} pins the tier on hub and lab A`, pins[tier].hub.tier === tier && pins[tier].labA.tier === tier, `${pins[tier].hub.tier}/${pins[tier].labA.tier}`)
  }
  check('Low tier draws fewer calls than High (no post, shadow or extra particles) on hub', pins.low.hub.calls < pins.high.hub.calls, `${pins.low.hub.calls} vs ${pins.high.hub.calls}`)
  check('Low tier draws fewer calls than High on lab A', pins.low.labA.calls < pins.high.labA.calls, `${pins.low.labA.calls} vs ${pins.high.labA.calls}`)

  {
    // Scene churn: hub, settings, hub, settings ... geometry and texture counts must plateau (dispose on unmount).
    const page = await browser.newPage()
    watch(page, 'churn')
    await page.setViewport({ ...vp, deviceScaleFactor: 1 })
    await page.goto(BASE + '?tier=low', { waitUntil: 'load' })
    await page.evaluate((s) => localStorage.setItem('anomaly.v1', s), lastStore)
    await goHub(page, '?tier=low')
    await waitRendered(page, 1500)
    const counts = []
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => (location.hash = '#/case/03-1'))
      await page.waitForSelector('[data-testid="briefing"]')
      await sleep(1500)
      await page.evaluate(() => (location.hash = '#/hub'))
      await page.waitForSelector('[data-testid="hub"]')
      await sleep(1500)
      const a = await page.evaluate(() => window.__anomaly)
      counts.push({ geometries: a.geometries, textures: a.textures })
    }
    const grow = counts[4].geometries - counts[1].geometries
    const growT = counts[4].textures - counts[1].textures
    check('geometry and texture counts plateau across scene churn (dispose on unmount)', grow <= 2 && growT <= 2, JSON.stringify(counts))
    pins.churn = counts
    await page.close()
  }

  // ---------- accessibility: settings apply everywhere, keyboard reach, visible focus, live regions ----------
  console.log('\n== accessibility ==')
  {
    const st = JSON.parse(lastStore)
    st.state.settings = { ...st.state.settings, textSize: 2, lineSpacing: 2, reducedMotion: false }
    const big = JSON.stringify(st)
    const page = await browser.newPage()
    watch(page, 'a11y')
    await page.setViewport({ ...vp, deviceScaleFactor: 1 })
    await page.goto(BASE + '?tier=low', { waitUntil: 'load' })
    await page.evaluate((s) => localStorage.setItem('anomaly.v1', s), big)
    await page.goto(BASE + '?tier=low#/', { waitUntil: 'load' })
    await page.reload({ waitUntil: 'load' })
    await page.waitForSelector('[data-testid="title"]')
    const rootPx = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize))
    check('text size Extra large scales the root to 20.8 px', Math.abs(rootPx - 20.8) < 0.1, `${rootPx}`)
    const ratio = (sel) => page.$eval(sel, (e) => { const cs = getComputedStyle(e); const lh = parseFloat(cs.lineHeight); return { fs: parseFloat(cs.fontSize), ratio: (Number.isNaN(lh) ? 1.2 * parseFloat(cs.fontSize) : lh) / parseFloat(cs.fontSize) } })

    // Focus walk: every focusable element is reachable by Tab and shows a visible indicator.
    async function focusWalk(label, pg) {
      const stops = await pg.evaluate(async () => {
        const sel = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'
        const all = [...document.querySelectorAll(sel)].filter((e) => e.offsetParent !== null || getComputedStyle(e).position === 'fixed')
        // A radio group is one Tab stop (arrow keys move inside it).
        const radios = new Set(all.filter((e) => e.type === 'radio').map((e) => e.name))
        return all.filter((e) => e.type !== 'radio').length + radios.size
      })
      const seen = new Set()
      const bad = []
      await pg.evaluate(() => document.activeElement && document.activeElement.blur())
      for (let i = 0; i < stops + 3; i++) {
        await pg.keyboard.press('Tab')
        const info = await pg.evaluate(() => {
          const e = document.activeElement
          if (!e || e === document.body) return null
          const cs = getComputedStyle(e)
          const visible = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || (cs.boxShadow && cs.boxShadow !== 'none')
          return { key: e.getAttribute('data-testid') || e.id || e.tagName + ':' + (e.textContent || '').trim().slice(0, 20), visible: !!visible, focusVisible: e.matches(':focus-visible') }
        })
        if (info) {
          seen.add(info.key)
          if (!info.visible || !info.focusVisible) bad.push(info.key)
        }
      }
      check(`${label}: ${stops} focusable controls reachable by Tab (${seen.size} stops)`, stops > 0 && seen.size >= Math.min(stops, 3) && seen.size >= stops - 2, `${seen.size} of ${stops}`)
      check(`${label}: every focused control shows a focus ring`, bad.length === 0, bad.join(','))
    }
    await focusWalk('title', page)
    await page.goto(BASE + '?tier=low#/hub', { waitUntil: 'load' })
    await page.waitForSelector('[data-testid="hub"]')
    await sleep(900)
    await focusWalk('hub', page)
    check('hub text uses the extra large scale', (await ratio('[data-testid="codename"]')).fs > 1.5 * 20.8 * 0.95)
    await page.goto(BASE + '?tier=low#/settings', { waitUntil: 'load' })
    await page.waitForSelector('[data-testid="settings"]')
    await sleep(700)
    await focusWalk('settings', page)

    // Case screens: briefing, lab A, item player, results all follow the spacing setting.
    await page.goto(BASE + '?tier=low#/case/03-1', { waitUntil: 'load' })
    await page.waitForSelector('[data-testid="briefing"]')
    await sleep(900)
    const rb = await ratio('[data-testid="briefing-text"]')
    check('briefing text follows Loose line spacing', rb.ratio >= 1.9, `${rb.ratio.toFixed(2)} at ${rb.fs}px`)
    await focusWalk('briefing', page)
    await click(page, 'briefing-continue')
    await page.waitForSelector('[data-testid="lab-a"]')
    await sleep(700)
    const rl = await ratio('[data-testid="task-text"]')
    check('lab A job text follows Loose line spacing and the larger text size', rl.ratio >= 1.6 && rl.fs > 1.35 * 20.8 * 0.95, `${rl.ratio.toFixed(2)} at ${rl.fs}px`)
    await click(page, 'organ-liver')
    await sleep(500)
    const live = await page.$eval('[data-testid="announcer"]', (e) => e.textContent)
    check('lab feedback is announced through the live region', /Not that one/.test(live), live)
    await focusWalk('lab A', page)
    await page.close()

    // Item player: stem spacing, result announcement, with the same settings
    const ip = await browser.newPage()
    watch(ip, 'a11y-items')
    await ip.setViewport({ ...vp, deviceScaleFactor: 1 })
    await ip.goto(BASE + '?tier=low', { waitUntil: 'load' })
    await ip.evaluate((s) => localStorage.setItem('anomaly.v1', s), big)
    await ip.goto(BASE + '?tier=low#/cold/cold-1', { waitUntil: 'load' })
    await ip.reload({ waitUntil: 'load' })
    await ip.waitForSelector('[data-testid="cold-intro"]')
    await sleep(800)
    await click(ip, 'cold-continue')
    await ip.waitForSelector('[data-testid="item-player"]')
    await sleep(1200)
    const rs = await ip.$eval('[data-testid="stem"]', (e) => { const cs = getComputedStyle(e); return { fs: parseFloat(cs.fontSize), lh: parseFloat(cs.lineHeight) } })
    check('item stem follows Loose spacing and the larger text size', rs.lh / rs.fs >= 2.6 && rs.fs > 1.12 * 20.8 * 0.95, `${(rs.lh / rs.fs).toFixed(2)} at ${rs.fs}px`)
    await ip.keyboard.press('1')
    await ip.keyboard.press('Enter')
    await ip.waitForSelector('[data-testid="item-result"]')
    await sleep(400)
    const live2 = await ip.$eval('[data-testid="announcer"]', (e) => e.textContent)
    check('item result is announced through the live region', /Correct|Not quite/.test(live2), live2)
    await focusWalk('item player', ip)
    await ip.close()
  }

  // Reduced motion: no veil, no particles, no stamp shake
  {
    const st = JSON.parse(lastStore)
    st.state.settings = { ...st.state.settings, reducedMotion: true }
    const page = await browser.newPage()
    watch(page, 'reduced')
    await page.setViewport({ ...vp, deviceScaleFactor: 1 })
    await page.goto(BASE + '?tier=low', { waitUntil: 'load' })
    await page.evaluate((s) => localStorage.setItem('anomaly.v1', s), JSON.stringify(st))
    await page.goto(BASE + '?tier=low#/hub', { waitUntil: 'load' })
    await page.reload({ waitUntil: 'load' })
    await page.waitForSelector('[data-testid="hub"]')
    check('reduced motion flag is on the document', (await page.evaluate(() => document.documentElement.dataset.reducedMotion)) === 'true')
    await page.evaluate(() => (location.hash = '#/settings'))
    await page.waitForSelector('[data-testid="settings"]')
    const veil = await page.$eval('.veil', (e) => ({ display: getComputedStyle(e).display, phase: e.getAttribute('data-phase') }))
    check('reduced motion swaps screens with no scan veil', veil.display === 'none' && veil.phase === 'idle', JSON.stringify(veil))
    await page.close()
  }

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

  writeFileSync(`${OUT}/fps.json`, JSON.stringify({ throttle: 4, viewport: vp, hub: hubFps, labA: labFps, backends: fpsByBackend, drawCalls: { screenshotScenesAtHigh: sceneStats, byTier: pins }, transfer }, null, 2))

  // ---------- test counts and summary ----------
  console.log('\n== unit tests ==')
  const jsonOut = `/tmp/anomaly-vitest${(process.env.AN_TAG ? '-' + process.env.AN_TAG : '')}.json`
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
  const expected = ORDER.length * VIEWPORTS.length + 1 + 6 + 2 // 6 = s11-gameplay shots at 1920, 2 = s15-stage shots
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
        fps: {
          note: 'Software GPU (SwiftShader) with 4x CPU throttle on hub and lab A, Auto tier; unthrottled is the 5 s hub reading.',
          ...Object.fromEntries(Object.entries(fpsByBackend).map(([k, v]) => [k, { hub: { avg: v.hub.fpsAvg, min: v.hub.fpsMin, tierStart: v.hub.tierStart, tierEnd: v.hub.tierEnd }, labA: { avg: v.labA.fpsAvg, min: v.labA.fpsMin, tierStart: v.labA.tierStart, tierEnd: v.labA.tierEnd }, hubUnthrottled: { avg: v.hubUnthrottled.fpsAvg, min: v.hubUnthrottled.fpsMin, tierEnd: v.hubUnthrottled.tierEnd } }])),
        },
        drawCalls: { screenshotScenesAtHigh: sceneStats, byTier: pins },
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
