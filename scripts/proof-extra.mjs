// Proof extras (ledger #28). Small and self-contained, so it does not depend on scripts/proof.mjs or scripts/lib.
//   a) Results with ?still=1: data-motion is still and no <video> is mounted (SealSting poster only).
//   b) Every step runs through a hardened runner: a detached frame, "Target closed" or a page crash relaunches the
//      browser once and retries that step from a fresh page.
//   c) The summary always prints and the exit code is non-zero on any failed check, console error or page error.
// Also checks the hub case preview: no <video> while nothing is hovered, and none at all in still or Low tier.
// Usage: npm run build && node scripts/proof-extra.mjs   (or: npm run proof:extra)
// Case 03-1 is played from the content file, the same way scripts/proof.mjs does it.
import puppeteer from 'puppeteer-core'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
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

/** A fresh page with a new agent, left on the hub. Console and page errors are collected under `label`. */
async function profilePage(qs, label) {
  const page = await browser.newPage()
  page.on('console', (m) => m.type() === 'error' && errors.push(`[${label}] console.error: ${m.text()}`))
  page.on('pageerror', (e) => errors.push(`[${label}] pageerror: ${e.message}`))
  page.on('requestfailed', (r) => errors.push(`[${label}] requestfailed: ${r.url()} ${r.failure()?.errorText}`))
  await page.setViewport({ ...VP, deviceScaleFactor: 1 })
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
    // videos: inside the preview. all: anywhere on the page (the High tier sky backdrop owns one of its own).
    return { present: !!el, media: el?.getAttribute('data-media') ?? '', videos: el ? el.querySelectorAll('video').length : 0, all: document.querySelectorAll('video').length, imgs: el ? el.querySelectorAll('img').length : 0 }
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
  ['hub preview still', () => hubPreview('?tier=high&still=1', 'hub still', 'poster')],
  ['hub preview low', () => hubPreview('?tier=low', 'hub low', 'poster')],
  ['hub preview high', () => hubPreview('?tier=high', 'hub high', 'video')],
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
