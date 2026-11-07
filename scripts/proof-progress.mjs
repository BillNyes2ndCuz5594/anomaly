// Proof script for progress panel and standards UI updates.
import { readFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { freePort, launch, profilePage, startPreview, CONTENT } from './lib/drive.mjs'

const OUT = process.env.PROOF_OUT || '/workspace/anomaly-runs/proof-progress-out'
mkdirSync(OUT, { recursive: true })

// Parse CATALOG_BENCHMARKS from src/lib/catalog.generated.ts DATA block
const catalogTs = readFileSync(new URL('../src/lib/catalog.generated.ts', import.meta.url), 'utf8')
const catalogDataMatch = catalogTs.match(/\/\*DATA\n([\s\S]*?)\nDATA\*\//)
if (!catalogDataMatch) {
  throw new Error('Could not parse /*DATA ... DATA*/ block from src/lib/catalog.generated.ts')
}
const catalogData = JSON.parse(catalogDataMatch[1])
const CATALOG_BENCHMARKS = catalogData.benchmarks
const LABEL_OF = new Map(CATALOG_BENCHMARKS.map((b) => [b.id, b.label]))

const errors = []
const port = await freePort()
const { proc, base } = await startPreview(port)
let browser

try {
  browser = await launch()

  for (const vp of [
    { width: 1280, height: 720, label: '1280x720' },
    { width: 834, height: 1194, label: '834x1194' },
  ]) {
    console.log(`Starting proof for viewport ${vp.label}`)
    // low tier and still query to avoid GPU-heavy proof
    const qs = '?tier=low&still=1'
    const page = await profilePage(browser, base, qs, vp, errors)

    // Check heading: 'Your science progress'
    const headingText = await page.$eval('#mastery-h', (el) => el.textContent?.trim())
    if (headingText !== 'Your science progress') {
      throw new Error(`Expected heading 'Your science progress', got '${headingText}'`)
    }

    // Check notebook: visible CODEX summary renamed to 'Science notebook' and empty-state Codex mention to 'science notebook'
    const codexSummaryText = await page.$eval('[data-testid="codex-panel"] summary', (el) => el.textContent)
    if (!codexSummaryText?.includes('Science notebook')) {
      throw new Error(`Expected codex panel summary to include 'Science notebook', got '${codexSummaryText}'`)
    }
    const codexEmptyText = await page.$eval('[data-testid="codex-panel"] p', (el) => el.textContent)
    if (!codexEmptyText?.includes('science notebook')) {
      throw new Error(`Expected codex empty text to include 'science notebook', got '${codexEmptyText}'`)
    }

    // Check exactly one Standards details per regular case
    const regularCases = CONTENT.cases || []
    const standardsDetails = await page.$$('.case-cell details.case-standards')
    if (standardsDetails.length !== regularCases.length) {
      throw new Error(`Expected ${regularCases.length} Standards details, found ${standardsDetails.length}`)
    }

    // For each regular case, verify closed initially and summary labeled 'Science goals'
    for (const c of regularCases) {
      const detailsSel = `[data-testid="case-standards-${c.id}"]`
      const isOpen = await page.$eval(detailsSel, (el) => el.hasAttribute('open'))
      if (isOpen) {
        throw new Error(`Expected standards details for case ${c.id} to be closed initially`)
      }
      const sumText = await page.$eval(`${detailsSel} summary`, (el) => el.textContent?.trim())
      if (sumText !== 'Science goals') {
        throw new Error(`Expected summary text to be 'Science goals', got '${sumText}'`)
      }
    }

    const initialUrl = page.url()

    // Keyboard open every dropdown, compare code and nonempty human label,
    // assert opening second does not close first, assert URL exactly unchanged before/after.
    // Keep them open for screenshot.
    for (let i = 0; i < regularCases.length; i++) {
      const c = regularCases[i]
      const detailsSel = `[data-testid="case-standards-${c.id}"]`
      const summaryHandle = await page.$(`${detailsSel} summary`)
      if (!summaryHandle) {
        throw new Error(`Could not find summary handle for case ${c.id}`)
      }
      await summaryHandle.focus()
      await page.keyboard.press('Enter')
      await sleep(100)

      const isNowOpen = await page.$eval(detailsSel, (el) => el.hasAttribute('open'))
      if (!isNowOpen) {
        throw new Error(`Expected standards details for case ${c.id} to be open after Enter key press`)
      }

      // Assert opening second does not close first
      if (i > 0) {
        const firstCaseSel = `[data-testid="case-standards-${regularCases[0].id}"]`
        const firstStillOpen = await page.$eval(firstCaseSel, (el) => el.hasAttribute('open'))
        if (!firstStillOpen) {
          throw new Error(`Opening case ${c.id} closed the first case (${regularCases[0].id})`)
        }
      }

      // Assert code and nonempty human label for every benchmark
      const renderedItems = await page.$$eval(`${detailsSel} li`, (lis) =>
        lis.map((li) => ({
          code: li.querySelector('.mono')?.textContent?.trim() ?? '',
          full: li.textContent?.trim() ?? '',
        }))
      )

      if (renderedItems.length !== c.benchmarks.length) {
        throw new Error(`Case ${c.id}: expected ${c.benchmarks.length} benchmarks, found ${renderedItems.length}`)
      }

      for (let bIdx = 0; bIdx < c.benchmarks.length; bIdx++) {
        const expectedCode = c.benchmarks[bIdx]
        const expectedLabel = LABEL_OF.get(expectedCode) ?? expectedCode
        const item = renderedItems[bIdx]

        if (item.code !== expectedCode) {
          throw new Error(`Case ${c.id} benchmark ${bIdx}: expected code '${expectedCode}', got '${item.code}'`)
        }
        if (!expectedLabel || expectedLabel.trim().length === 0) {
          throw new Error(`Expected label for benchmark '${expectedCode}' is empty in catalog`)
        }
        if (!item.full.includes(expectedLabel)) {
          throw new Error(`Case ${c.id} benchmark ${bIdx}: expected rendered text to include '${expectedLabel}', got '${item.full}'`)
        }
      }

      // Assert URL exactly unchanged
      const currentUrl = page.url()
      if (currentUrl !== initialUrl) {
        throw new Error(`URL changed during standards interaction! Expected '${initialUrl}', got '${currentUrl}'`)
      }
    }

    // Keep all details open for screenshot
    const screenshotPath = join(OUT, `proof-progress-${vp.label}.png`)
    await page.screenshot({ path: screenshotPath, fullPage: false })
    console.log(`Saved screenshot to ${screenshotPath}`)

    await page.close()
  }

  if (errors.length > 0) {
    throw new Error(`Console or page errors detected:\n${errors.join('\n')}`)
  }

  console.log('Proof passed successfully with zero errors!')
} finally {
  if (browser) await browser.close()
  proc.kill()
}
