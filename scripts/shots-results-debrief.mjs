// Before/after frames of the Results and Debrief payoff.
// Needs a fresh `npm run build` (vite preview serves dist).
//   SHOT_LABEL=before SHOT_OUT=docs/devlog/shots node scripts/shots-results-debrief.mjs
// Writes <label>-debrief-<viewport>.png and <label>-results-<viewport>.png.
import { mkdirSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'
import { finishItems, freePort, launch, profilePage, startPreview, toCaseStep } from './lib/drive.mjs'

const OUT = process.env.SHOT_OUT || 'docs/devlog/shots'
const LABEL = process.env.SHOT_LABEL || 'after'
mkdirSync(OUT, { recursive: true })

const VIEWS = [
  { name: '1920', width: 1920, height: 1080 },
  { name: 's23-portrait', width: 360, height: 780 },
  { name: 'tab-portrait', width: 800, height: 1280 },
]

/** Stamp and score text must sit inside the verdict panel, with controls at least 44px. */
function layoutReport() {
  const stamp = document.querySelector('[data-testid="case-stamp"]')
  const score = document.querySelector('[data-testid="debrief-score"]')
  const panel = stamp?.closest('.panel')
  const box = (el) => {
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom), w: Math.round(r.width) }
  }
  const texts = []
  if (panel) {
    const b = panel.getBoundingClientRect()
    for (const e of panel.querySelectorAll('*')) {
      if (![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue
      const r = e.getBoundingClientRect()
      if (r.width < 2) continue
      if (r.right > b.right + 1 || r.left < b.left - 1) texts.push((e.textContent || '').trim().slice(0, 40))
    }
  }
  const controls = [...document.querySelectorAll('button')].map((e) => {
    const r = e.getBoundingClientRect()
    return { id: e.dataset.testid || e.textContent.trim().slice(0, 18), w: Math.round(r.width), h: Math.round(r.height) }
  })
  return {
    vw: innerWidth,
    vh: innerHeight,
    scrollX: document.documentElement.scrollWidth - innerWidth,
    stamp: box(stamp),
    panel: box(panel),
    score: score?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
    spill: texts,
    controls,
  }
}

const port = await freePort()
const { proc, base } = await startPreview(port)
const browser = await launch()
const errors = []
let failed = false
try {
  for (const vp of VIEWS) {
    const page = await profilePage(browser, base, '?still=1&tier=low&mute=1', vp, errors)
    await toCaseStep(page, 'items')
    await finishItems(page)
    await page.waitForSelector('[data-testid="debrief"]')
    await page.evaluate(() => document.getAnimations().forEach((a) => a.finish()))
    await sleep(400)
    const debrief = `${OUT}/${LABEL}-debrief-${vp.name}.png`
    await page.screenshot({ path: debrief })
    const dReport = await page.evaluate(layoutReport)
    console.log(LABEL, 'debrief', vp.name, JSON.stringify(dReport))
    if (dReport.spill.length || dReport.scrollX > 1) failed = true
    await page.click('[data-testid="debrief-continue"]')
    await page.waitForSelector('[data-testid="results"]')
    await page.evaluate(() => document.getAnimations().forEach((a) => a.finish()))
    await sleep(500)
    const results = `${OUT}/${LABEL}-results-${vp.name}.png`
    await page.screenshot({ path: results })
    const rReport = await page.evaluate(() => ({
      vw: innerWidth,
      scrollX: document.documentElement.scrollWidth - innerWidth,
      score: document.querySelector('[data-testid="case-status"]')?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 80) ?? '',
      intel: document.querySelector('[data-testid="intel-earned"]')?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 60) ?? '',
    }))
    console.log(LABEL, 'results', vp.name, JSON.stringify(rReport))
    if (rReport.scrollX > 1) failed = true
    console.log('wrote', debrief)
    console.log('wrote', results)

    await page.evaluate(() => {
      location.hash = '#/cold/cold-1'
    })
    await page.waitForSelector('[data-testid="cold-intro"]')
    await page.click('[data-testid="cold-continue"]')
    await finishItems(page)
    await page.waitForSelector('[data-testid="case-stamp"]')
    await page.evaluate(() => document.getAnimations().forEach((a) => a.finish()))
    await sleep(300)
    const cold = `${OUT}/${LABEL}-cold-debrief-${vp.name}.png`
    await page.screenshot({ path: cold })
    const cReport = await page.evaluate(layoutReport)
    console.log(LABEL, 'cold-debrief', vp.name, JSON.stringify(cReport))
    if (cReport.spill.length || cReport.scrollX > 1) failed = true
    const small = cReport.controls.filter((b) => b.h < 44 || b.w < 44)
    if (small.length) {
      failed = true
      console.log('small controls', JSON.stringify(small))
    }
    console.log('wrote', cold)
    await page.close()
  }
} finally {
  await browser.close()
  proc.kill()
}
if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}
if (failed && process.env.SHOT_STRICT === '1') process.exit(2)
