// Bounded browser regression for the live-store settings fixture contract.
// Uses the supported no-GPU fallback, without changing motion media or still mode.
import assert from 'node:assert/strict'
import { setMotionFixture } from './lib/motionFixture.mjs'
import { freePort, launch, profilePage, startPreview } from './lib/drive.mjs'

const { proc, base } = await startPreview(await freePort())
let browser
try {
  browser = await launch(['--no-sandbox', '--disable-gpu', '--disable-webgpu', '--disable-software-rasterizer'])
  const errors = []
  const page = await profilePage(browser, base, '?tier=low&backend=webgl2', { width: 1024, height: 768 }, errors)
  const briefing = async (id) => {
    await page.waitForFunction((id) =>
      document.querySelector('.dispatch-title')?.textContent?.startsWith(`CASE ${id} `) &&
      document.querySelector('[data-testid="briefing"]') &&
      !document.querySelector('.screen-host')?.inert &&
      document.querySelector('.veil')?.dataset.phase === 'idle', {}, id)
  }
  await page.evaluate(() => { location.hash = '#/case/04-1' })
  await briefing('04-1')
  console.log('page inventory', JSON.stringify((await browser.pages()).map((p) => p.url())))
  // Deliberately order the old fixture write before the pending route effect.
  // This removes scheduler luck while retaining the real App/persist writer.
  const immediate = await page.evaluate(() => {
    window.__motionWrites = []
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key === 'anomaly.v1') window.__motionWrites.push({
        motion: JSON.parse(value).state.settings.reducedMotion,
        lastCaseId: JSON.parse(value).state.lastCaseId,
        stack: new Error().stack,
      })
      return original.call(this, key, value)
    }
    location.hash = '#/case/03-1'
    const raw = JSON.parse(localStorage.getItem('anomaly.v1'))
    raw.state.settings.reducedMotion = true
    localStorage.setItem('anomaly.v1', JSON.stringify(raw))
    return JSON.parse(localStorage.getItem('anomaly.v1')).state.settings.reducedMotion
  })
  assert.equal(immediate, true)
  await briefing('03-1')
  const trace = await page.evaluate(() => ({ writes: window.__motionWrites,
    stored: JSON.parse(localStorage.getItem('anomaly.v1')).state.settings.reducedMotion,
    applied: document.documentElement.dataset.reducedMotion }))
  console.log('ordered old-fixture diagnostic', JSON.stringify(trace))
  assert.equal(trace.stored, false, 'pending app persist overwrites the external edit')
  assert.equal(trace.applied, 'false')
  assert.equal(trace.writes[0].motion, true)
  assert.ok(trace.writes.some((w) => w.motion === false && w.lastCaseId === '03-1'))
  console.log('old fixture contract: RED, requested true but persisted false')
  // Diagnostic mode asserts the requested contract against the old raw write.
  if (process.argv.includes('--assert-raw-contract')) {
    assert.equal(trace.stored, true, 'raw fixture must preserve requested reducedMotion=true')
  }
  // Start with nonzero reading settings so resets cannot pass as no-ops.
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('anomaly.v1'))
    raw.state.settings.textSize = 2
    raw.state.settings.lineSpacing = 2
    localStorage.setItem('anomaly.v1', JSON.stringify(raw))
  })
  await page.reload({ waitUntil: 'load' })
  await briefing('03-1')
  // Enter from the same outgoing case as the failed proof.
  await page.evaluate(() => { location.hash = '#/case/04-1' })
  await briefing('04-1')
  await page.evaluate(() => { location.hash = '#/case/03-1' })
  await setMotionFixture(page)
  const result = await page.evaluate(() => {
    const r = document.querySelector('[data-testid="briefing-continue"]').getBoundingClientRect()
    return { applied: document.documentElement.dataset.reducedMotion,
      inside: r.top >= 0 && r.bottom <= innerHeight,
      media: matchMedia('(prefers-reduced-motion: reduce)').matches }
  })
  assert.equal(result.media, false, 'device preference must not mask the setting')
  assert.equal(result.applied, 'true', 'reduced motion sets document dataset flag')
  assert.equal(result.inside, true, 'reduced motion keeps actions fully visible')
  assert.deepEqual(errors, [], 'zero console errors')
  console.log('real controls and reload: GREEN', JSON.stringify(result))

} finally {
  if (browser) await browser.close()
  proc.kill()
}
