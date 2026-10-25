// S1 proof: starts `vite preview`, walks title, first run, hub, settings, teacher, and measures fps under 4x CPU throttle.
// Usage: node scripts/proof.mjs   (run `npm run build` first)
import puppeteer from 'puppeteer-core'
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'

const OUT = '/workspace/anomaly-proof'
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
    check(`title renders (${w})`, !!info && info.fps > 0, JSON.stringify(info))
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
    await page.waitForSelector('[data-testid="case-placeholder"]')
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
