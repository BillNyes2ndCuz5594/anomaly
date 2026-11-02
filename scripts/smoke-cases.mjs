// S6 smoke: the hub and the generic Field Lab only, so a slow software GPU does not need the full proof run.
// Usage: npm run build && node scripts/smoke-cases.mjs
// It walks the first pack in PACK_ORDER at 1366x768 (Medium tier, to read draw calls) and checks the hub and the
// lab at 360x780 (phone portrait). With no pack listed it checks the hub and logs that the walk was skipped.
// Exits non-zero on any console error or failed check. Screenshots go to $PROOF_OUT (default /workspace/anomaly-proof).
import { mkdirSync, writeFileSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'
import { fitReport, freePort, launch, profilePage, startPreview } from './lib/drive.mjs'
import { loadContent, loadPacks } from './lib/content.mjs'
import { playGenericLab, walkPack } from './lib/caseWalk.mjs'

const OUT = process.env.PROOF_OUT || '/workspace/anomaly-proof'
mkdirSync(OUT, { recursive: true })
const content = loadContent()
const packs = loadPacks()
const errors = []
const checks = []
const check = (name, ok, detail = '') => {
  checks.push({ name, ok: !!ok, detail })
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? `  [${detail}]` : ''}`)
}
const ran = []

const port = await freePort()
const { proc, base } = await startPreview(port)
let browser
let code = 0
try {
  browser = await launch()

  // Desktop, Medium tier: hub, then the whole first pack.
  const page = await profilePage(browser, base, '?tier=medium', { width: 1366, height: 768 }, errors)
  await page.waitForFunction(() => window.__anomaly && window.__anomaly.fps > 0, { timeout: 120000, polling: 250 })
  for (const c of content.cases) check(`hub has case-marker-${c.id}`, await page.$(`[data-testid="case-marker-${c.id}"]`))
  check('hub keeps case-marker-03-1', await page.$('[data-testid="case-marker-03-1"]'))
  const groups = await page.$$eval('[data-testid^="mastery-group-"]', (els) => els.map((e) => ({ id: e.getAttribute('data-testid'), open: e.open })))
  check('hub mastery list is grouped and open on desktop', groups.length > 0 && groups.every((g) => g.open), JSON.stringify(groups))
  await page.screenshot({ path: `${OUT}/s6-hub-1366.png` })
  ran.push('hub 1366')

  if (packs.length === 0) {
    console.log('note: no case pack is listed in PACK_ORDER, so the generic lab walk is skipped')
  } else {
    const pack = packs[0]
    const res = await walkPack(page, pack, content, {
      check,
      label: '1366',
      shot: async (name) => page.screenshot({ path: `${OUT}/s6-${name}-1366.png` }),
      readCalls: async () => {
        const fits = await fitReport(page)
        check('generic lab scene fits inside its canvas', fits.length > 0 && fits.every((f) => f.over <= 0.001), fits.map((f) => f.over.toFixed(3)).join(','))
        return page.evaluate(() => ({ calls: window.__anomaly?.calls, tier: window.__anomaly?.tier, backend: window.__anomaly?.backend }))
      },
    })
    ran.push(...res.steps.map((s) => `${s} 1366`))
    console.log('lab draw calls', JSON.stringify(res.calls))
    check('generic lab draws under 70 calls on Medium', res.calls && res.calls.tier === 'medium' && res.calls.calls < 70, JSON.stringify(res.calls))
    writeFileSync(`${OUT}/s6-smoke-calls.json`, JSON.stringify(res.calls, null, 1))
  }
  await page.close()

  // Phone portrait: the hub sheet fits with the groups collapsed, and the lab fits too.
  const phone = { width: 360, height: 780, isMobile: true, hasTouch: true }
  const p2 = await profilePage(browser, base, '?tier=low', phone, errors)
  await p2.waitForFunction(() => window.__anomaly && window.__anomaly.fps > 0, { timeout: 120000, polling: 250 })
  await sleep(800)
  const hubFit = await p2.evaluate(() => {
    const panel = document.querySelector('.hub-panel').getBoundingClientRect()
    const groups = [...document.querySelectorAll('[data-testid^="mastery-group-"]')].map((d) => d.open)
    const small = [...document.querySelectorAll('.hub-panel button, .hub-panel summary')]
      .filter((e) => e.offsetParent !== null)
      .map((e) => e.getBoundingClientRect())
      .filter((r) => r.height < 43.5).length
    return { left: panel.left, right: panel.right, top: panel.top, bottom: panel.bottom, scrollW: document.documentElement.scrollWidth, groups, small }
  })
  check('phone hub sheet fits the width', hubFit.left >= 0 && hubFit.right <= 360 && hubFit.scrollW <= 360, JSON.stringify(hubFit))
  check('phone hub sheet fits the height', hubFit.top >= 0 && hubFit.bottom <= 780, JSON.stringify(hubFit))
  check('phone mastery groups start closed', hubFit.groups.length > 0 && hubFit.groups.every((o) => o === false), JSON.stringify(hubFit.groups))
  check('phone hub targets are at least 44 px', hubFit.small === 0, `${hubFit.small} small`)
  await p2.screenshot({ path: `${OUT}/s6-hub-360.png` })
  ran.push('hub 360')
  if (packs.length > 0) {
    const pack = packs[0]
    await p2.evaluate((id) => (location.hash = `#/case/${id}`), pack.case.id)
    await p2.waitForSelector('[data-testid="briefing-continue"]')
    await sleep(600)
    await p2.click('[data-testid="briefing-continue"]')
    await p2.waitForSelector('[data-testid="lab-generic"]')
    await sleep(1500)
    const labFit = await p2.evaluate(() => {
      const small = [...document.querySelectorAll('[data-testid="lab-generic"] button')]
        .filter((e) => e.offsetParent !== null)
        .map((e) => e.getBoundingClientRect())
        .filter((r) => r.height < 43.5 || r.width < 43.5).length
      return { scrollW: document.documentElement.scrollWidth, small }
    })
    check('phone generic lab has no sideways scroll', labFit.scrollW <= 360, JSON.stringify(labFit))
    check('phone generic lab buttons are at least 44 px', labFit.small === 0, `${labFit.small} small`)
    await p2.screenshot({ path: `${OUT}/s6-lab-360.png` })
    await playGenericLab(p2, pack.case.lab, { check, label: '360' })
    await p2.screenshot({ path: `${OUT}/s6-lab-done-360.png` })
    ran.push('field lab 360')
  }
  await p2.close()
} catch (e) {
  console.error(e)
  code = 1
} finally {
  await browser?.close()
  proc.kill()
}

const failed = checks.filter((c) => !c.ok)
console.log(`\nsteps run: ${ran.join(', ')}`)
console.log(`checks: ${checks.length - failed.length} of ${checks.length} passed`)
console.log(`console errors: ${errors.length}`)
for (const e of errors) console.log('  ' + e)
writeFileSync(`${OUT}/s6-smoke.json`, JSON.stringify({ ran, checks, errors }, null, 1))
process.exit(code || failed.length || errors.length ? 1 : 0)
