// Run against a fresh build. TAP_BASELINE=1 captures the unfixed build for comparison.
import { readFileSync, writeFileSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'
import { freePort, startPreview, launch, profilePage, toCaseStep, click, CONTENT } from './lib/drive.mjs'
import { loadPacks } from './lib/content.mjs'
import { nextMove } from './lib/caseWalk.mjs'

const baselineFile = new URL('./rapid-taps-before.json', import.meta.url)
const preview = await startPreview(await freePort(), '127.0.0.1', process.env.TAP_DIST || 'dist')
const base = preview.base.replace('localhost', '127.0.0.1')
const browser = await launch(['--no-sandbox', '--use-angle=gl', '--ignore-gpu-blocklist', '--disable-dev-shm-usage'])
const rows = []
const errors = []
async function instrument(page) {
  await page.evaluateOnNewDocument(() => {
    const stats = { contexts: 0, sources: 0, peakSources: 0 }
    const AC = window.AudioContext
    window.AudioContext = class extends AC {
      constructor(...args) {
        super(...args)
        stats.contexts++
        for (const method of ['createOscillator', 'createBufferSource']) {
          const original = this[method].bind(this)
          this[method] = (...a) => {
            const node = original(...a)
            const start = node.start.bind(node)
            node.start = (...b) => {
              stats.sources++
              stats.peakSources = Math.max(stats.peakSources, stats.sources)
              node.addEventListener('ended', () => stats.sources--, { once: true })
              return start(...b)
            }
            return node
          }
        }
      }
    }
    window.__tapAudio = stats
  })
}
async function burst(page, name, id, submit = false) {
  console.log('BURST', name)
  await page.waitForSelector(`[data-testid="${id}"]`)
  await page.$eval(`[data-testid="${id}"]`, e => e.scrollIntoView({ block: 'center' }))
  await sleep(1800) // Exclude scene compilation and route entrance from the measured window.
  await page.evaluate(() => {
    const m = window.__taps = { longTasks: [], rafGap: 0, chips: 0, chipsPerTarget: 0, bursts: 0, confetti: 0, animations: 0, recordings: 0, active: true }
    const orig = Storage.prototype.setItem
    m.restore = () => { Storage.prototype.setItem = orig }
    let history = JSON.parse(localStorage.getItem('anomaly.v1'))?.state.itemHistory?.length ?? 0
    Storage.prototype.setItem = function(k, v) {
      if (k === 'anomaly.v1') {
        const n = JSON.parse(v).state.itemHistory.length
        if (n > history) m.recordings += n - history
        history = n
      }
      return orig.call(this, k, v)
    }
    m.observer = new PerformanceObserver(list => {
      for (const e of list.getEntries()) if (e.startTime >= m.start && e.startTime < m.end) m.longTasks.push(e.duration)
    })
    m.observer.observe({ type: 'longtask' })
    m.start = performance.now()
    m.end = Infinity
    const sample = () => {
      m.chips = Math.max(m.chips, document.querySelectorAll('.fly-chip').length)
      const targets = new Map()
      for (const chip of document.querySelectorAll('.fly-chip')) {
        const key = chip.dataset.flyTarget ?? 'unlabelled'
        targets.set(key, (targets.get(key) ?? 0) + 1)
      }
      m.chipsPerTarget = Math.max(m.chipsPerTarget, 0, ...targets.values())
      m.bursts = Math.max(m.bursts, document.querySelectorAll('.burst').length)
      m.confetti = Math.max(m.confetti, document.querySelectorAll('.case-confetti').length)
      m.animations = Math.max(m.animations, document.getAnimations().length)
    }
    m.mutations = new MutationObserver(sample)
    m.mutations.observe(document.body, { childList: true, subtree: true })
    let last = performance.now()
    const tick = now => {
      m.rafGap = Math.max(m.rafGap, now - last)
      last = now
      sample()
      if (m.active) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
    window.__tapAudio.peakSources = window.__tapAudio.sources
  })
  const started = performance.now()
  await page.evaluate((id) => {
    const el = document.querySelector(`[data-testid="${id}"]`)
    // A single event turn exposes stale React state as well as ordinary rapid input.
    for (let i = 0; i < 30; i++) {
      el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', button: 0 }))
      el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch', button: 0 }))
      el.click()
    }
  }, id)
  const touchId = submit === 'touch' ? 'lock-in' : id
  if (submit === 'click') await page.evaluate(() => {
    const el = document.querySelector('[data-testid="lock-in"]')
    for (let i = 0; i < 30; i++) el?.click()
    for (let i = 0; i < 30; i++) window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', repeat: true, bubbles: true }))
  })
  if (submit === 'keyboard') await page.evaluate(() => {
    for (let i = 0; i < 30; i++) window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  })
  const el = await page.$(`[data-testid="${touchId}"]`)
  if (el) await el.evaluate(e => e.scrollIntoView({ block: 'center' }))
  const box = el && await el.boundingBox()
  if (box) {
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
    // Queue single-finger taps in order without a frame round-trip per event.
    const cdp = await page.createCDPSession()
    try {
      const pending = []
      for (let n = 0; n < 29; n++) {
        pending.push(cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2, id: 0 }] }))
        pending.push(cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }))
      }
      await Promise.all(pending)
    } finally { await cdp.detach() }
  }
  const inputMs = Math.round(performance.now() - started)
  await sleep(600)
  const row = await page.evaluate(() => {
    const m = window.__taps
    m.end = performance.now()
    m.active = false
    m.restore()
    m.mutations.disconnect()
    m.observer.disconnect()
    return { maxLongTask: Math.round(Math.max(0, ...m.longTasks)), longTasks: m.longTasks.length, rafGap: Math.round(m.rafGap), chips: m.chips, chipsPerTarget: m.chipsPerTarget, bursts: m.bursts, confetti: m.confetti, animations: m.animations, recordings: m.recordings, audio: window.__tapAudio }
  })
  rows.push({ name, inputMs, ...row })
  console.log(JSON.stringify(rows.at(-1)))
}
try {
  // Install instrumentation before the app loads, including the single shared audio context.
  const originalNewPage = browser.newPage.bind(browser)
  browser.newPage = async () => { const p = await originalNewPage(); await instrument(p); const setViewport = p.setViewport.bind(p); p.setViewport = v => setViewport({ ...v, deviceScaleFactor: 0.25 }); return p }
  const page = await profilePage(browser, base, '?tier=low&backend=webgl2', { width: 800, height: 600, hasTouch: true }, errors)
  await page.evaluate(() => { location.hash = '#/hub' }); await page.waitForSelector('[data-testid="hub"]'); await toCaseStep(page, 'lab-a')
  await burst(page, 'Lab A wrong', `organ-${CONTENT.case.labs.organOps.tasks[0].organ === 'heart' ? 'brain' : 'heart'}`)
  await burst(page, 'Lab A correct', `organ-${CONTENT.case.labs.organOps.tasks[0].organ}`)
  await page.evaluate(() => { location.hash = '#/hub' }); await page.waitForSelector('[data-testid="hub"]'); await toCaseStep(page, 'lab-b')
  const pair = CONTENT.case.labs.structureMatch.pairs[0]
  await burst(page, 'Lab B unarmed', `match-${pair.id}-plant`)
  await burst(page, 'Lab B animal', `match-${pair.id}-animal`)
  await burst(page, 'Lab B match', `match-${pair.id}-plant`)
  for (const other of CONTENT.case.labs.structureMatch.pairs.slice(1)) {
    await click(page, `match-${other.id}-animal`)
    await click(page, `match-${other.id}-plant`)
  }
  await click(page, 'lab-next')
  const contrast = CONTENT.case.labs.structureMatch.contrast[0]
  const correct = contrast.choices.indexOf(contrast.job)
  await burst(page, 'Lab B contrast wrong', `contrast-${contrast.id}-${(correct + 1) % contrast.choices.length}`)
  await burst(page, 'Lab B contrast correct', `contrast-${contrast.id}-${correct}`)
  await page.evaluate(() => { location.hash = '#/hub' }); await page.waitForSelector('[data-testid="hub"]'); await toCaseStep(page, 'lab-c')
  const sp = CONTENT.case.labs.specimenSort.specimens[0]
  await burst(page, 'Lab C wrong', `sort-backbone-${sp.backbone ? 'no' : 'yes'}`)
  await burst(page, 'Lab C backbone', `sort-backbone-${sp.backbone ? 'yes' : 'no'}`)
  await burst(page, 'Lab C group', `sort-group-${sp.group}`)
  await page.evaluate(() => { location.hash = '#/hub' }); await page.waitForSelector('[data-testid="hub"]'); await toCaseStep(page, 'items')
  const stem = await page.$eval('[data-testid="stem"]', e => e.textContent.replace(/\s+/g, ' ').trim())
  const item = CONTENT.items.find(it => it.stem.split(/\s+/).join(' ') === stem)
  const word = await page.$$eval('[data-testid^="word-"]', (els, key) => els.find(e => e.textContent.toLowerCase().replace(/[^a-z0-9]/g, '') === key)?.dataset.testid, item.keyWords[0].split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, ''))
  if (!word) throw new Error('Keyword button not found')
  await burst(page, 'RKEA keyword', word)
  await click(page, 'eliminate-toggle')
  await burst(page, 'RKEA eliminate', `option-${(item.key + 1) % 4}`)
  await click(page, 'eliminate-toggle')
  await burst(page, 'RKEA click lock', `option-${item.key}`, 'click')
  for (const mode of ['touch', 'keyboard']) {
    await click(page, 'next-item')
    await burst(page, `RKEA ${mode} lock`, 'option-0', mode)
  }
  for (const pack of loadPacks().filter((p, i, all) => p.case.id === '02-2' || all.findIndex(q => q.case.lab.kind === p.case.lab.kind) === i)) {
    await page.evaluate(id => { location.hash = `#/case/${id}` }, pack.case.id)
    await page.waitForSelector('[data-testid="briefing"]')
    await sleep(600)
    await click(page, 'briefing-continue')
    await page.waitForSelector('[data-testid="lab-generic"], [data-testid="lab-d"]')
    if (await page.$('[data-testid="lab-d"]')) {
      await burst(page, 'Lab D identify', 'identify-quartz')
      await click(page, 'next-phase-btn')
      await burst(page, 'Lab D classify', 'classify-igneous')
      await click(page, 'phase-3-btn')
      await burst(page, 'Lab D sort', 'lab-bin-weathering')
    } else {
      const move = await nextMove(page, pack.case.lab)
      if (move.wrong) await burst(page, `Generic ${pack.case.lab.kind} wrong`, move.wrong)
      await burst(page, `Generic ${pack.case.lab.kind} correct`, move.right)
    }
  }
  if (!rows.some(r => r.name.startsWith('Lab D'))) throw new Error('Lab D was not exercised')
  if (process.env.TAP_BASELINE === '1') writeFileSync(baselineFile, JSON.stringify(rows, null, 2) + '\n')
  else {
    console.log('CONFIG: 800x600, DPR 0.25 (app floor 0.5), Low, WebGL2, ANGLE GL, sound on; full visual proof runs separately')
    console.log('BEFORE', readFileSync(baselineFile, 'utf8'))
    console.log('AFTER', JSON.stringify(rows, null, 2))
    const failed = rows.filter(r => r.recordings > 1 || r.chips > 2 || r.chipsPerTarget > 1 || r.audio.contexts > 1 || r.maxLongTask > 200 || (r.name.startsWith('RKEA ') && r.name.endsWith(' lock') && r.recordings !== 1))
    if (failed.length) { console.error('Rapid-tap failures:', failed); process.exitCode = 1 }
    if (errors.length) { console.error(errors); process.exitCode = 1 }
  }
} finally {
  await browser.close()
  preview.proc.kill()
}
