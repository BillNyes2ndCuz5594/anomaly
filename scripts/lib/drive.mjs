// Small driving helpers shared by scripts/shot.mjs (quick targeted screenshots) and the proof run.
// They reach a case step by playing the real UI with the content, only faster than the proof run.
import puppeteer from 'puppeteer-core'
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { loadContent } from './content.mjs'
import { chromePath, CHROME_ARGS } from './platform.mjs'

export const ROOT = fileURLToPath(new URL('../..', import.meta.url))
/** Merged content: `case` is VITALS, `items` holds the base items plus every listed pack (the cold case can draw any). */
export const CONTENT = loadContent()

export { CHROME_ARGS }

export const freePort = () =>
  new Promise((resolve) => {
    const srv = createServer()
    srv.listen(0, () => {
      const { port } = srv.address()
      srv.close(() => resolve(port))
    })
  })

export async function startPreview(port, host = 'localhost', outDir = 'dist') {
  const base = `http://${host}:${port}/`
  const proc = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--outDir', outDir, '--host', host, '--port', String(port), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'], cwd: ROOT })
  writeFileSync(join(tmpdir(), `an${process.env.AN_TAG ? '-' + process.env.AN_TAG : ''}-preview.pid`), String(proc.pid))
  let log = ''
  proc.stdout.on('data', (d) => (log += d))
  proc.stderr.on('data', (d) => (log += d))
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(base)
      if (r.ok) return { proc, base }
    } catch {}
    if (proc.exitCode !== null) throw new Error('vite preview exited early:\n' + log)
    await sleep(200)
  }
  proc.kill()
  throw new Error('vite preview did not start:\n' + log)
}

export async function launch(args = CHROME_ARGS) {
  const browser = await puppeteer.launch({ executablePath: chromePath(), headless: true, args })
  writeFileSync(join(tmpdir(), `an${process.env.AN_TAG ? '-' + process.env.AN_TAG : ''}-chrome.pid`), String(browser.process()?.pid ?? ''))
  return browser
}

export const has = async (page, id) => !!(await page.$(`[data-testid="${id}"]`))
export const click = async (page, id) => {
  await page.waitForSelector(`[data-testid="${id}"]:not([disabled])`, { timeout: 30000 })
  await page.click(`[data-testid="${id}"]`)
}
export const text = (page, id) => page.$eval(`[data-testid="${id}"]`, (e) => e.textContent)

export async function waitRendered(page, extraMs = 2500) {
  await page.waitForFunction(() => window.__anomaly && window.__anomaly.fps > 0, { timeout: 90000, polling: 250 })
  await sleep(extraMs)
}

/** Opens a page, clears storage and creates the agent through the first run modal. Leaves the page on the hub. */
export async function profilePage(browser, base, qs, vp, errors = []) {
  const page = await browser.newPage()
  page.on('console', (m) => m.type() === 'error' && errors.push(`console.error: ${m.text()}`))
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  await page.setViewport({ ...vp, deviceScaleFactor: 1 })
  await page.goto(base + qs + '#/', { waitUntil: 'load' })
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

/** Plays case 03-1 from the hub up to the named step: briefing, lab-a, lab-b, lab-c, items. */
export async function toCaseStep(page, step) {
  const c = CONTENT.case
  await page.evaluate(() => (location.hash = '#/case/03-1'))
  await page.waitForSelector('[data-testid="briefing"]')
  if (step === 'briefing') return
  await sleep(600)
  await click(page, 'briefing-continue')
  await page.waitForSelector('[data-testid="lab-a"]')
  if (step === 'lab-a') return
  for (const t of c.labs.organOps.tasks) {
    await click(page, `organ-${t.organ}`)
    await page.waitForFunction(() => document.querySelector('[data-testid="lab-feedback"]')?.getAttribute('data-ok') === 'yes')
    await click(page, 'lab-next')
    await sleep(120)
  }
  await page.waitForSelector('[data-testid="lab-b"]')
  if (step === 'lab-b') return
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
  if (step === 'lab-c') return
  for (const sp of c.labs.specimenSort.specimens) {
    await click(page, `sort-backbone-${sp.backbone ? 'yes' : 'no'}`)
    await click(page, `sort-group-${sp.group}`)
    await click(page, 'lab-next')
    await sleep(120)
  }
  await page.waitForSelector('[data-testid="item-player"]')
}

/** Reads every canvas fit report and returns the worst overshoot (0 or less means all inside). */
export async function fitReport(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('canvas[data-fit]')].map((c) => {
      const f = JSON.parse(c.dataset.fit)
      const r = c.getBoundingClientRect()
      return { ...f, canvasW: Math.round(r.width), canvasH: Math.round(r.height), over: Math.max(f.maxX - f.fw, -f.fw - f.minX, f.maxY - f.fh, -f.fh - f.minY) }
    }),
  )
}

/** Sets the in-game text size (0 Normal, 1 Large, 2 Extra large) in storage and reloads the current page. */
export async function setTextSize(page, t) {
  await page.evaluate((v) => {
    const raw = JSON.parse(localStorage.getItem('anomaly.v1'))
    raw.state.settings = { ...raw.state.settings, textSize: v }
    localStorage.setItem('anomaly.v1', JSON.stringify(raw))
  }, t)
  await page.reload({ waitUntil: 'load' })
}

/**
 * Waits until every scene diagram has measured its final box: the viewBox aspect matches the element
 * and data-label-size is the size diagramText.ts computes for that box (MIN_LABEL_PX 14 times the text
 * scale over the base 400x220 scale, clamped to 7..28). A diagram measures itself through a
 * ResizeObserver, and on a software GPU that callback can trail the layout by a second or two, so a
 * check taken too early would read a stale viewBox. Gives up after 8 s and lets the check report.
 */
export async function waitForDiagramsSettled(page) {
  try {
    await page.waitForFunction(
      () => {
        const ts = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--text-scale')) || 1
        for (const svg of document.querySelectorAll('svg.scene-svg')) {
          const r = svg.getBoundingClientRect()
          if (r.width < 2) continue
          const vb = svg.viewBox.baseVal
          if (Math.abs(r.width / r.height - vb.width / vb.height) > 0.03) return false
          const scale = Math.min(r.width / 400, r.height / 220)
          const want = Math.min(28, Math.max(7, (14 * Math.max(0.5, ts)) / Math.max(0.05, scale)))
          if (Math.abs(parseFloat(svg.dataset.labelSize) - want) > 0.06) return false
        }
        return true
      },
      { timeout: 8000, polling: 100 },
    )
  } catch {}
}

/**
 * Checks every scene diagram on the page: each text bbox inside the svg viewBox, no two label bboxes
 * intersecting, no letterboxing (viewBox aspect equals the element aspect) and the rendered font size
 * at least 14px times the text scale.
 */
export async function svgReport(page) {
  await waitForDiagramsSettled(page)
  return page.evaluate(() => {
    const ts = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--text-scale')) || 1
    const tol = 0.75
    const out = { svgs: 0, texts: 0, outside: [], overlaps: [], small: [], letterboxed: [], minPx: Infinity, textScale: ts }
    for (const svg of document.querySelectorAll('svg.scene-svg')) {
      const r = svg.getBoundingClientRect()
      if (r.width < 2) continue
      out.svgs++
      const vb = svg.viewBox.baseVal
      const scene = svg.getAttribute('data-scene')
      const scale = Math.min(r.width / vb.width, r.height / vb.height)
      if (Math.abs(r.width / r.height - vb.width / vb.height) > 0.03) out.letterboxed.push(`${scene} ${Math.round(r.width)}x${Math.round(r.height)} vb ${vb.width.toFixed(0)}x${vb.height.toFixed(0)}`)
      const boxes = []
      for (const t of svg.querySelectorAll('text')) {
        const b = t.getBBox()
        out.texts++
        const px = parseFloat(t.getAttribute('font-size')) * scale
        const name = `${scene}/${t.getAttribute('data-label') ?? t.textContent}`
        if (t.getAttribute('data-label')) {
          out.minPx = Math.min(out.minPx, px)
          if (px < 14 * ts - 0.6) out.small.push(`${name} ${px.toFixed(1)}px`)
        }
        if (b.x < vb.x - tol || b.y < vb.y - tol || b.x + b.width > vb.x + vb.width + tol || b.y + b.height > vb.y + vb.height + tol) out.outside.push(name)
        if (t.getAttribute('data-label')) boxes.push({ name, x0: b.x, y0: b.y, x1: b.x + b.width, y1: b.y + b.height })
      }
      for (let i = 0; i < boxes.length; i++)
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i]
          const c = boxes[j]
          if (a.x0 < c.x1 && c.x0 < a.x1 && a.y0 < c.y1 && c.y0 < a.y1) out.overlaps.push(`${a.name} x ${c.name}`)
        }
    }
    return out
  })
}

/** Answers every remaining evidence item correctly and lands on the debrief. */
export async function finishItems(page) {
  for (let n = 0; n < 8; n++) {
    if (await page.$('[data-testid="debrief"]')) return
    await page.waitForSelector('[data-testid="stem"], [data-testid="debrief"]')
    if (await page.$('[data-testid="debrief"]')) return
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
}
