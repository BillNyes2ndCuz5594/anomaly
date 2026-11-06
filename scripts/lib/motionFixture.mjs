import assert from 'node:assert/strict'

// Update the live store through controls. A raw storage edit can be overwritten
// by setLastCaseId while the previous case route is still committing.
export async function setMotionFixture(page) {
  const route = await page.evaluate(() => location.hash)
  assert.match(route, /^#\/case\/[A-Z0-9-]+$/i)
  await page.evaluate(() => { location.hash = '#/settings' })
  await page.waitForFunction(() => document.querySelector('[data-testid="settings"]') &&
    !document.querySelector('.screen-host')?.inert)
  for (const id of ['setting-text-size', 'setting-line-spacing']) {
    const selector = `[data-testid="${id}"] input`
    await page.focus(selector)
    await page.keyboard.press('Space')
  }
  const motion = '[data-testid="setting-reduced-motion"]'
  if (!(await page.$eval(motion, (el) => el.checked))) {
    await page.focus(motion)
    await page.keyboard.press('Space')
  }
  await page.evaluate((hash) => { location.hash = hash }, route)
  const ready = () => page.waitForFunction(() => {
    const id = location.hash.split('/').at(-1)
    return document.querySelector('.dispatch-title')?.textContent?.startsWith(`CASE ${id} `) &&
      document.querySelector('[data-testid="briefing"]') &&
      !document.querySelector('.screen-host')?.inert &&
      document.querySelector('.veil')?.dataset.phase === 'idle'
  })
  const readSettings = () => page.evaluate(() => {
    const { reducedMotion, textSize, lineSpacing } = JSON.parse(localStorage.getItem('anomaly.v1')).state.settings
    return { reducedMotion, textSize, lineSpacing }
  })
  const expected = { reducedMotion: true, textSize: 0, lineSpacing: 0 }
  await ready()
  assert.deepEqual(await readSettings(), expected, 'motion fixture before reload')
  await page.reload({ waitUntil: 'load' })
  await ready()
  assert.deepEqual(await readSettings(), expected, 'motion fixture after reload')
  // The caller asserts the applied dataset immediately, without polling it.
}
