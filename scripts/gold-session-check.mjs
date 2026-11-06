// Run against a local Vite dev server: GOLD_CHECK_URL=http://127.0.0.1:5173 node scripts/gold-session-check.mjs
// Uses the real component and browser storage, without the unrelated app shell or GPU stage.
import assert from 'node:assert/strict'
import puppeteer from 'puppeteer-core'
import { writeFile, unlink } from 'node:fs/promises'
import { chromePath, CHROME_ARGS } from './lib/platform.mjs'

const base = process.env.GOLD_CHECK_URL || 'http://127.0.0.1:5173'
const browser = await puppeteer.launch({ executablePath: chromePath(), args: CHROME_ARGS, headless: true })
const fixtureName = `.gold-lifecycle-check-${process.pid}.html`
const fixture = new URL(`../${fixtureName}`, import.meta.url)
const errors = []
let page
const diagnostics = []
try {
  // Serve real HTML through Vite so it transforms bare imports and CJS interop.
  await writeFile(fixture, `<!doctype html><html><head><link rel="icon" href="data:,"></head><body><div id="root"></div>
        <script type="module">
          import React from 'react';
          import { createRoot } from 'react-dom/client';
          import GoldRushScreen from '/src/modes/gold/GoldRushScreen.tsx';
          const root = createRoot(document.getElementById('root'));
          window.mountGold = () => root.render(React.createElement(GoldRushScreen, { caseId: '02-2' }));
        </script></body></html>`)
  page = await browser.newPage()
  page.on('console', (msg) => diagnostics.push(`console ${msg.type()}: ${msg.text()}`))
  page.on('pageerror', (error) => diagnostics.push(`pageerror: ${error.stack || error}`))
  page.on('requestfailed', (request) => diagnostics.push(`requestfailed: ${request.url()} ${request.failure()?.errorText}`))
  page.on('response', (response) => { if (response.status() >= 400) diagnostics.push(`response: ${response.status()} ${response.url()}`) })
  page.on('pageerror', (error) => errors.push(String(error)))
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()) })
  await page.setRequestInterception(true)
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.origin !== new URL(base).origin) {
      void request.abort()
    } else void request.continue()
  })
  const open = async () => {
    await page.goto(`${base}/${fixtureName}?still=1&mute=1`)
    await page.waitForFunction(() => typeof window.mountGold === 'function')
  }
  const mount = async () => {
    await page.evaluate(() => window.mountGold())
    await page.waitForSelector('[data-testid="gold-rush"]')
  }
  const saved = () => page.evaluate(() => JSON.parse(sessionStorage.getItem('anomaly:gold:02-2')))
  const text = () => page.$eval('[data-testid="gold-rush"]', (el) => el.textContent)
  for (const reveal of [null, { index: 0, contents: '20', delta: 20 }]) {
    await open()
    const session = {
      game: { seed: 'completion-check', question: 9, intel: 120, phase: 'next', outcome: 'Found 20 intel!',
        bots: ['Quartz Scout', 'Photon Pilot', 'Fossil Finder'].map((name, i) => ({ name, intel: 60 + i })) },
      reveal,
    }
    await page.evaluate((value) => {
      sessionStorage.setItem('anomaly:gold:02-2', JSON.stringify(value))
      sessionStorage.setItem('anomaly:gold:03-1', 'other case')
      sessionStorage.setItem('anomaly:containment:02-2', 'other mode')
      localStorage.setItem('anomaly.slot.CHECK.2', 'other agent')
    }, session)
    await mount()
    assert.match(await text(), /Question 10\/10/)
    assert.deepEqual(await saved(), session, 'valid final-next save survives mount')
    await page.reload()
    await page.waitForFunction(() => typeof window.mountGold === 'function')
    await mount()
    assert.deepEqual(await saved(), session, 'valid unfinished round survives reload')
    const board = await page.$eval('.gold-board', (el) => el.textContent)
    await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent === 'See standings').click())
    await page.waitForFunction(() => document.body.textContent.includes('Expedition complete'))
    assert.equal(await page.$eval('.gold-board', (el) => el.textContent), board, 'completion preserves scoring')
    assert.equal(await saved(), null, 'completed session must clear while standings remains mounted')
    assert.deepEqual(await page.evaluate(() => [sessionStorage.getItem('anomaly:gold:03-1'),
      sessionStorage.getItem('anomaly:containment:02-2'), localStorage.getItem('anomaly.slot.CHECK.2')]),
    ['other case', 'other mode', 'other agent'])
    await page.reload()
    await page.waitForFunction(() => typeof window.mountGold === 'function')
    await mount()
    assert.match(await text(), /Question 1\/10/)
    assert.doesNotMatch(await text(), /See standings/)
    console.log(`PASS completion lifecycle, reveal=${reveal !== null}`)
  }
  assert.deepEqual(errors, [], 'zero browser console or page errors')
} catch (error) {
  console.error(JSON.stringify({ diagnostics, dom: await page?.content() }, null, 2))
  throw error
} finally {
  await browser.close()
  await unlink(fixture).catch(() => {})
}
