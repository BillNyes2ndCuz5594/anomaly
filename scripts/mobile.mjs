// Mobile and tablet proof (S8). Plays the whole loop by touch only (page.tap / touchscreen.tap) on four emulated
// devices, one headless Chrome at a time, against a local `vite preview` of the build:
//   s23-portrait 360x780 dpr3, s23-landscape 780x360 dpr3, tab-portrait 800x1280, tab-landscape 1280x800.
// Flow: title, Start shift, first run, hub, settings, case 03-1 briefing, Lab A (including one tap directly on the
// 3D hologram), Lab B, Lab C, 5 evidence items, debrief, results, cold case, results, plus a rotation on Lab A.
// Every screen is screenshotted to /workspace/anomaly-proof/mobile/ and checked. The exit code is non-zero on:
// console or page error, failed request, horizontal document scroll, a visible control outside the viewport
// horizontally, a tapped element whose center is covered, a control under 44x44 CSS px (inline stem words only
// need 44 tall), visible text under 12px (HTML and SVG), text overflowing its box, overlapping header/panel
// boxes, a 3D canvas fit overshoot, a hologram tap that does not select the organ, or a reload on rotation.
// Usage: npm run build && node scripts/mobile.mjs [s23-portrait s23-landscape tab-portrait tab-landscape] [--tab-dpr=1]
import puppeteer from 'puppeteer-core'
import { copyFileSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { CHROME_ARGS, CONTENT, freePort, startPreview } from './lib/drive.mjs'

const OUT = '/workspace/anomaly-proof/mobile'
const PHONE_UA = 'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'
const TAB_UA = 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
const args = process.argv.slice(2)
const tabDpr = Number((args.find((a) => a.startsWith('--tab-dpr=')) ?? '--tab-dpr=2').split('=')[1])
const ALL = [
  { tag: 's23-portrait', width: 360, height: 780, dpr: 3, ua: PHONE_UA, landscape: false },
  { tag: 's23-landscape', width: 780, height: 360, dpr: 3, ua: PHONE_UA, landscape: true },
  { tag: 'tab-portrait', width: 800, height: 1280, dpr: tabDpr, ua: TAB_UA, landscape: false },
  { tag: 'tab-landscape', width: 1280, height: 800, dpr: tabDpr, ua: TAB_UA, landscape: true },
]
const wanted = args.filter((a) => !a.startsWith('--'))
const DEVICES = wanted.length ? ALL.filter((d) => wanted.includes(d.tag)) : ALL
// S11: ?qaitems makes the case play the human organ item, owl and pelican, grasshopper and spider, panther and crab
// and manatee, so specimens are shown and checked in the real item player on every device.
const GAMEPLAY = ['L14-01', 'L315-03', 'L315-07', 'L142-02', 'L142-07']
const QS = `?tier=low&qaitems=${GAMEPLAY.join(',')}`
const PROOF = '/workspace/anomaly-proof'

mkdirSync(OUT, { recursive: true })
// Clear only what this run regenerates: a full run clears every PNG and JSON, a subset run only its own devices.
for (const f of readdirSync(OUT)) if (/\.(png|json)$/.test(f) && (!wanted.length || f === 'summary.json' || wanted.some((t) => f.startsWith(t + '-') || f === t + '.json'))) rmSync(join(OUT, f))

const tid = (id) => `[data-testid="${id}"]`
const c = CONTENT.case

/** Runs inside the page: every check on the current screen. Returns metrics and a list of problem strings. */
function pageChecks() {
  const vw = innerWidth
  const vh = innerHeight
  const de = document.documentElement
  const problems = []
  const label = (e) => e.dataset?.testid || e.getAttribute('aria-label') || (e.textContent || '').trim().slice(0, 28) || e.className
  const vis = (e) => {
    const s = getComputedStyle(e)
    if (s.visibility === 'hidden' || s.display === 'none') return false
    const r = e.getBoundingClientRect()
    return r.width > 0 && r.height > 0 && !e.closest('[hidden]')
  }
  if (de.scrollWidth > vw + 1 || document.body.scrollWidth > vw + 1) problems.push(`document scrolls horizontally (${de.scrollWidth} > ${vw})`)

  // Controls: inside the viewport horizontally, at least 44x44 (stem words: 44 tall).
  const seen = new Set()
  const ctrls = []
  for (const e of document.querySelectorAll('button, a[href], input:not([type="hidden"]), select, textarea, [role="button"], summary')) {
    if (!vis(e) && !(e.matches('input') && e.closest('label') && vis(e.closest('label')))) continue
    const t = e.matches('input[type="checkbox"], input[type="radio"]') && e.closest('label') ? e.closest('label') : e
    if (seen.has(t)) continue
    seen.add(t)
    ctrls.push(t)
  }
  for (const e of ctrls) {
    const r = e.getBoundingClientRect()
    if (r.width < 2) continue
    const id = label(e)
    if (r.right > vw + 1 || r.left < -1) problems.push(`control outside viewport: ${id} x ${Math.round(r.left)}..${Math.round(r.right)}`)
    const word = e.classList.contains('word')
    if (r.height < 43.5 || (!word && r.width < 43.5)) problems.push(`control under 44px: ${id} ${Math.round(r.width)}x${Math.round(r.height)}`)
  }

  // Text: at least 12px (HTML), no text past the viewport, no text past its own panel.
  const small = new Set()
  const clipped = new Set()
  const spill = new Set()
  for (const e of document.querySelectorAll('body *')) {
    if (e.closest('svg') || !vis(e)) continue
    const hiddenBox = e.closest('.sr-only, .stepbar, .chip-name')
    if (hiddenBox && hiddenBox.getBoundingClientRect().width <= 2) continue
    if (![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue
    const r = e.getBoundingClientRect()
    if (r.width <= 2 || r.height <= 2) continue
    const fs = parseFloat(getComputedStyle(e).fontSize)
    const txt = e.textContent.trim().slice(0, 28)
    if (fs < 11.99) small.add(`${fs.toFixed(1)}px "${txt}"`)
    if (r.right > vw + 1 || r.left < -1) clipped.add(txt)
    const box = e.closest('.panel, .modal, .job-card, .verdict')
    if (box && box !== e) {
      const b = box.getBoundingClientRect()
      if (r.right > b.right + 1 || r.left < b.left - 1) spill.add(txt)
    }
  }
  for (const t of small) problems.push(`text under 12px: ${t}`)
  for (const t of clipped) problems.push(`text outside viewport: "${t}"`)
  for (const t of spill) problems.push(`text overflows its box: "${t}"`)
  // SVG scene diagrams scale with their box: judge the rendered size.
  let svgMin = Infinity
  for (const t of document.querySelectorAll('svg text')) {
    const svg = t.ownerSVGElement
    if (!svg || svg.getBoundingClientRect().width < 2) continue
    const m = t.getScreenCTM()
    const fs = parseFloat(t.getAttribute('font-size') || getComputedStyle(t).fontSize) * (m ? m.a : 1)
    svgMin = Math.min(svgMin, fs)
    if (fs < 11.99) problems.push(`svg text under 12px: ${(t.textContent || '').trim().slice(0, 20)} ${fs.toFixed(1)}px`)
  }

  // Header, dock and panels must not overlap each other.
  const stepEl = [...document.querySelectorAll('.case-top .stepbar, .case-top .step-compact')].find((e) => vis(e) && e.getBoundingClientRect().width > 2)
  const named = [
    ['hub-btn', document.querySelector('.case-top .btn')],
    ['step', stepEl],
    ['title', document.querySelector('.case-tag')],
    ['job-card', document.querySelector('.job-card')],
    ['side-panel', document.querySelector('.side-panel')],
    ['item-grid', document.querySelector('.item-grid')],
    ['results', document.querySelector('.results-body')],
    ['debrief', document.querySelector('.debrief-body')],
    ['hub-panel', document.querySelector('.hub-panel')],
    ['codex', document.querySelector('.codex-panel')],
    ['settings', document.querySelector('.settings-panel')],
    ['title-bottom', document.querySelector('.title-bottom')],
    ...[...document.querySelectorAll('.hub-screen .topbar .btn, .settings-screen .topbar .btn, .title-screen .topbar .btn')].map((e, i) => [`bar-btn${i}`, e]),
    ...[...document.querySelectorAll('.topbar > .label:not(.case-tag)')].map((e, i) => [`bar-label${i}`, e]),
  ].filter(([, e]) => e && vis(e))
  for (let i = 0; i < named.length; i++)
    for (let j = i + 1; j < named.length; j++) {
      const a = named[i][1].getBoundingClientRect()
      const b = named[j][1].getBoundingClientRect()
      const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left)
      const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
      if (ox > 1 && oy > 1) problems.push(`overlap: ${named[i][0]} x ${named[j][0]} (${Math.round(ox)}x${Math.round(oy)}px)`)
    }

  // 3D fit: the model must sit inside the free frame.
  const canv = []
  for (const cv of document.querySelectorAll('canvas')) {
    if (!vis(cv)) continue
    let over = null
    if (cv.dataset.fit) {
      const f = JSON.parse(cv.dataset.fit)
      over = +Math.max(f.maxX - f.fw, -f.fw - f.minX, f.maxY - f.fh, -f.fh - f.minY).toFixed(3)
      if (over > 0) problems.push(`3D fit overshoot ${over} (${Math.round(cv.getBoundingClientRect().width)}x${Math.round(cv.getBoundingClientRect().height)})`)
    }
    canv.push({ w: Math.round(cv.getBoundingClientRect().width), h: Math.round(cv.getBoundingClientRect().height), over })
  }
  return { problems, metrics: { vw, vh, ctrls: ctrls.length, svgMin: svgMin === Infinity ? null : +svgMin.toFixed(1), canv, boxes: named.map(([n, e]) => [n, ...['left', 'top', 'right', 'bottom'].map((k) => Math.round(e.getBoundingClientRect()[k]))]), an: window.__anomaly ? { fps: Math.round(window.__anomaly.fps), tier: window.__anomaly.tier, backend: window.__anomaly.backend } : null } }
}

async function runDevice(dev, base) {
  const { tag } = dev
  const report = { tag, vp: { width: dev.width, height: dev.height, dpr: dev.dpr }, screens: [], problems: [], errors: [], shots: [] }
  const problem = (screen, msg) => {
    const m = `${tag}/${screen}: ${msg}`
    if (!report.problems.includes(m)) {
      report.problems.push(m)
      console.log('  PROBLEM', m)
    }
  }
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: true, protocolTimeout: 300000, args: CHROME_ARGS })
  writeFileSync('/tmp/an-chrome.pid', String(browser.process()?.pid ?? ''))
  let screen = 'start'
  try {
    const page = await browser.newPage()
    // Viewport for the device in its start orientation, or rotated.
    const view = (rotated = false) => {
      const land = rotated ? !dev.landscape : dev.landscape
      const long = Math.max(dev.width, dev.height)
      const short = Math.min(dev.width, dev.height)
      return { width: land ? long : short, height: land ? short : long, deviceScaleFactor: dev.dpr, isMobile: true, hasTouch: true, isLandscape: land }
    }
    await page.setUserAgent(dev.ua)
    await page.setViewport(view())
    page.setDefaultTimeout(60000)
    page.on('console', (m) => {
      if (m.type() === 'error') {
        report.errors.push(`console.error: ${m.text()}`)
        problem(screen, `console.error: ${m.text().slice(0, 160)}`)
      }
    })
    page.on('pageerror', (e) => {
      report.errors.push(`pageerror: ${e.message}`)
      problem(screen, `pageerror: ${e.message.slice(0, 160)}`)
    })
    page.on('requestfailed', (r) => {
      report.errors.push(`requestfailed: ${r.url()}`)
      problem(screen, `request failed: ${r.url()}`)
    })
    page.on('response', (r) => {
      if (r.status() >= 400) {
        report.errors.push(`HTTP ${r.status()} ${r.url()}`)
        problem(screen, `HTTP ${r.status()} ${r.url()}`)
      }
    })

    /** Tap with a hit test: the center of the target must be inside the viewport and not covered by another element. */
    async function tap(sel, name = sel) {
      await page.waitForSelector(`${sel}:not([disabled])`)
      const info = await page.$eval(sel, (e) => {
        e.scrollIntoView({ block: 'center', inline: 'center' })
        const r = e.getBoundingClientRect()
        const cx = r.x + r.width / 2
        const cy = r.y + r.height / 2
        const top = document.elementFromPoint(cx, cy)
        const lab = e.closest('label')
        const ok = !!top && (top === e || e.contains(top) || (lab && (top === lab || lab.contains(top))))
        return { ok, cx, cy, vw: innerWidth, vh: innerHeight, left: r.left, right: r.right, top: top ? `${top.tagName}.${String(top.className).slice(0, 40)}` : null }
      })
      if (!info.ok) problem(screen, `tap target covered: ${name} by ${info.top}`)
      if (info.cx < 0 || info.cx > info.vw || info.cy < 0 || info.cy > info.vh || info.left < -1 || info.right > info.vw + 1) problem(screen, `tap target outside viewport: ${name}`)
      await page.tap(sel)
    }
    const tapId = (id) => tap(tid(id), id)

    async function audit(name, wait = 1500) {
      screen = name
      await sleep(wait)
      const r = await page.evaluate(pageChecks)
      for (const p of r.problems) problem(name, p)
      report.screens.push({ name, problems: r.problems, ...r.metrics })
      const file = `${tag}-${name}.png`
      await page.screenshot({ path: join(OUT, file) })
      report.shots.push(file)
      console.log(`${tag} ${name}: ${r.problems.length} problems, ${r.metrics.ctrls} controls, canvas ${JSON.stringify(r.metrics.canv)}`)
    }
    const fail = async (e) => {
      problem(screen, `flow failed: ${e.message.slice(0, 200)}`)
      await page.screenshot({ path: join(OUT, `${tag}-FAIL-${screen}.png`) }).catch(() => {})
    }

    /** One tap on the 3D hologram itself, at the projected organ position published on the canvas (data-organs). */
    async function tapHologram(organ) {
      for (let attempt = 0; attempt < 6; attempt++) {
        const pos = await page.evaluate((id) => {
          const cv = document.querySelector('canvas[data-organs]')
          if (!cv) return null
          const o = JSON.parse(cv.dataset.organs)[id]
          if (!o) return null
          const top = document.elementFromPoint(o[0], o[1])
          return { x: o[0], y: o[1], top: top ? top.tagName : null, inside: o[0] >= 0 && o[0] <= innerWidth && o[1] >= 0 && o[1] <= innerHeight }
        }, organ)
        if (!pos) {
          await sleep(600)
          continue
        }
        if (!pos.inside) problem(screen, `hologram organ ${organ} is off screen at ${pos.x},${pos.y}`)
        else if (pos.top !== 'CANVAS') problem(screen, `hologram organ ${organ} is covered by ${pos.top} at ${pos.x},${pos.y}`)
        await page.touchscreen.tap(pos.x, pos.y)
        await sleep(900)
        const ok = await page.$eval(tid('lab-feedback'), (e) => e.getAttribute('data-ok')).catch(() => null)
        if (ok === null) problem(screen, `tap on the hologram at ${pos.x},${pos.y} selected nothing`)
        if (ok === 'yes') return attempt + 1
        // A neighbouring organ was picked (side view, organs overlap): the pick works, aim again at the new pose.
        report.hologramMisses = (report.hologramMisses ?? 0) + 1
      }
      return 0
    }

    await page.goto(base + QS + '#/', { waitUntil: 'load' })
    await page.evaluate(() => localStorage.clear())
    await page.reload({ waitUntil: 'load' })

    screen = 'title'
    await page.waitForSelector(tid('start-shift'))
    await audit('title', 4500)
    screen = 'firstrun'
    await tapId('start-shift')
    await page.waitForSelector(tid('firstrun-modal'))
    await tapId('classcode-input')
    await page.keyboard.type('DEMO')
    await audit('firstrun', 900)
    await tapId('firstrun-confirm')
    await page.waitForSelector(tid('hub'))
    await audit('hub', 4500)

    screen = 'settings'
    await tapId('open-settings')
    await page.waitForSelector(tid('settings'))
    await audit('settings', 900)
    await tap('[data-testid="setting-text-size"] .seg:nth-child(2)', 'text-size Large')
    await sleep(400)
    const scaled = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--text-scale').trim())
    if (!(parseFloat(scaled) > 1)) problem(screen, `text size tap did not apply (--text-scale ${scaled})`)
    await audit('settings-large', 500)
    await tap('[data-testid="setting-text-size"] .seg:nth-child(1)', 'text-size Normal')
    await sleep(300)
    await tapId('settings-back')
    await page.waitForSelector(tid('hub'))

    screen = 'briefing'
    await tapId('case-marker-03-1')
    await page.waitForSelector(tid('briefing'))
    await audit('briefing', 5000)

    screen = 'lab-a'
    await tapId('briefing-continue')
    await page.waitForSelector(tid('lab-a'))
    await audit('lab-a', 4500)
    const tasks = c.labs.organOps.tasks
    const tries = await tapHologram(tasks[0].organ)
    report.hologramTapTries = tries
    if (!tries) problem(screen, `a tap on the 3D hologram did not select ${tasks[0].organ}`)
    else console.log(`${tag} hologram tap selected ${tasks[0].organ} on try ${tries}`)
    if (tries) await audit('lab-a-feedback', 600)
    else await tapId(`organ-${tasks[0].organ}`)
    await page.waitForFunction(() => document.querySelector('[data-testid="lab-feedback"]')?.getAttribute('data-ok') === 'yes')
    await tapId('lab-next')
    await sleep(200)
    for (const t of tasks.slice(1)) {
      await tapId(`organ-${t.organ}`)
      await page.waitForFunction(() => document.querySelector('[data-testid="lab-feedback"]')?.getAttribute('data-ok') === 'yes')
      await tapId('lab-next')
      await sleep(200)
    }

    screen = 'lab-b'
    await page.waitForSelector(tid('lab-b'))
    await audit('lab-b', 3500)
    const pairs = c.labs.structureMatch.pairs
    for (const p of pairs) {
      await tapId(`match-${p.id}-animal`)
      await tapId(`match-${p.id}-plant`)
      await sleep(200)
    }
    await audit('lab-b-matched', 500)
    await tapId('lab-next')
    let first = true
    for (const cc of c.labs.structureMatch.contrast) {
      if (first) {
        await audit('lab-b-contrast', 1500)
        first = false
      }
      await tapId(`contrast-${cc.id}-${cc.choices.indexOf(cc.job)}`)
      await page.waitForFunction(() => document.querySelector('[data-testid="lab-feedback"]')?.getAttribute('data-ok') === 'yes')
      if (cc === c.labs.structureMatch.contrast[0]) await audit('lab-b-feedback', 500)
      await tapId('lab-next')
      await sleep(200)
    }

    screen = 'lab-c'
    await page.waitForSelector(tid('lab-c'))
    await audit('lab-c', 3500)
    let firstSp = true
    for (const sp of c.labs.specimenSort.specimens) {
      await tapId(`sort-backbone-${sp.backbone ? 'yes' : 'no'}`)
      await tapId(`sort-group-${sp.group}`)
      if (firstSp) {
        await audit('lab-c-feedback', 600)
        firstSp = false
      }
      await tapId('lab-next')
      await sleep(200)
    }

    const playItems = async (kind) => {
      for (let n = 0; n < 6; n++) {
        screen = `${kind}-item`
        const which = await Promise.race([page.waitForSelector(tid('stem')).then(() => 'item'), page.waitForSelector(tid('debrief')).then(() => 'debrief')])
        if (which === 'debrief') return n
        await sleep(800)
        const alt = await page.$eval(tid('visual-alt'), (e) => e.textContent.trim())
        const item = CONTENT.items.find((i) => i.alt === alt)
        if (!item) throw new Error('no item for alt ' + alt)
        if (n === 0) {
          await audit(`${kind}-item`, 2500)
          await tapId('word-2')
        } else if (kind === 'case') {
          await audit(`${kind}-item-${item.id}`, 3500)
        }
        if (kind === 'case') copyFileSync(join(OUT, `${tag}-${n === 0 ? 'case-item' : `case-item-${item.id}`}.png`), `${PROOF}/s11-gameplay-${item.id}-${tag}.png`)
        await tapId(`option-${item.key}`)
        await tapId('lock-in')
        await page.waitForSelector(tid('item-result'))
        if (n === 0) await audit(`${kind}-item-result`, 1000)
        await tapId('next-item')
        await sleep(400)
      }
      return 6
    }
    report.caseItems = await playItems('case')

    screen = 'debrief'
    await page.waitForSelector(tid('debrief'))
    await audit('debrief', 2500)
    await tapId('debrief-continue')
    await page.waitForSelector(tid('results'))
    await audit('results', 2800)
    await tapId('back-to-hub')
    await page.waitForSelector(tid('hub'))

    screen = 'cold-intro'
    await tapId('cold-marker')
    await page.waitForSelector(tid('cold-intro'))
    await audit('cold-intro', 3000)
    await tapId('cold-continue')
    report.coldItems = await playItems('cold')
    await audit('cold-debrief', 2000)
    await tapId('debrief-continue')
    await page.waitForSelector(tid('results'))
    await audit('cold-results', 2000)

    // Rotation on Lab A: relayout without a reload, both ways.
    screen = 'rotate'
    await page.evaluate(() => (location.hash = '#/case/03-1'))
    await page.waitForSelector(tid('briefing'))
    await tapId('briefing-continue')
    await page.waitForSelector(tid('lab-a'))
    await sleep(3000)
    await page.evaluate(() => (window.__noReload = 1))
    await page.setViewport(view(true))
    await audit('rotated-lab-a', 3000)
    await page.setViewport(view(false))
    await audit('rotated-back-lab-a', 3000)
    if (!(await page.evaluate(() => window.__noReload === 1))) problem('rotate', 'page reloaded on orientation change')
    report.ok = true
  } catch (e) {
    report.ok = false
    report.fatal = e.message.slice(0, 300)
    problem(screen, `flow aborted: ${e.message.slice(0, 200)}`)
    const pg = (await browser.pages()).at(-1)
    await pg?.screenshot({ path: join(OUT, `${tag}-FAIL-${screen}.png`) }).catch(() => {})
  }
  const pid = browser.process()?.pid
  await browser.close().catch(() => {})
  if (pid) {
    for (let i = 0; i < 20; i++) {
      try {
        process.kill(pid, 0)
        await sleep(250)
      } catch {
        break
      }
    }
  }
  writeFileSync(join(OUT, `${tag}.json`), JSON.stringify(report, null, 1))
  return report
}

const CHILD = args.includes('--child')

if (!CHILD && DEVICES.length > 1) {
  // Parent: one child node process per device. Headless swiftshader loses its WebGPU instance when a second Chrome is
  // launched inside the same node process, so every device gets a fresh process. Still only one Chrome at a time.
  const { spawnSync } = await import('node:child_process')
  const { readFileSync } = await import('node:fs')
  const DEVICE_LOST = /Device Lost|Instance dropped|popErrorScope|external Instance/
  const reports = []
  for (const dev of DEVICES) {
    console.log(`\n=== ${dev.tag} ===`)
    const run = () => {
      spawnSync(process.execPath, [new URL(import.meta.url).pathname, dev.tag, '--child', `--tab-dpr=${tabDpr}`], { stdio: 'inherit' })
      return JSON.parse(readFileSync(join(OUT, `${dev.tag}.json`), 'utf8'))
    }
    let r = run()
    if ((r.problems.length || !r.ok) && r.problems.every((p) => DEVICE_LOST.test(p))) {
      console.log(`RETRY ${dev.tag}: only WebGPU device-lost artifacts, running it once more`)
      r = run()
      r.retried = true
    }
    reports.push(r)
  }
  summarize(reports)
} else {
  const port = await freePort()
  const { proc, base } = await startPreview(port)
  const reports = []
  try {
    for (const dev of DEVICES) reports.push(await runDevice(dev, base))
  } finally {
    proc.kill()
  }
  if (CHILD) process.exit(reports.some((r) => r.problems.length || !r.ok) ? 1 : 0)
  summarize(reports)
}

function summarize(reports) {
  console.log('\n=== SUMMARY ===')
  let bad = 0
  for (const r of reports) {
    const n = r.problems.length + (r.ok ? 0 : 1)
    bad += n
    console.log(`${n === 0 ? 'PASS' : 'FAIL'}  ${r.tag}: ${r.screens.length} screens, ${r.errors.length} console/page errors, ${r.problems.length} problems, hologram tap tries ${r.hologramTapTries ?? 'n/a'}${r.retried ? ' (retried after a WebGPU device-lost artifact)' : ''}`)
    for (const p of r.problems.slice(0, 12)) console.log('   - ' + p.slice(0, 220))
  }
  writeFileSync(join(OUT, 'summary.json'), JSON.stringify(reports.map((r) => ({ tag: r.tag, ok: r.ok, errors: r.errors, problems: r.problems, shots: r.shots })), null, 1))
  process.exit(bad ? 1 : 0)
}
