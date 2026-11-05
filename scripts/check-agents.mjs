// Headless proof for PR 6 shared-device agent isolation. Usage: timeout 400 node scripts/check-agents.mjs
import { mkdirSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'
import { click, freePort, has, launch, startPreview, text, CONTENT } from './lib/drive.mjs'

const OUT = '/workspace/anomaly-runs/first5/shots/merged'
mkdirSync(OUT, { recursive: true })

const VIEWS = [
  { tag: '1366x768', width: 1366, height: 768 },
  { tag: '1024x768', width: 1024, height: 768 },
]

const port = await freePort()
const { proc, base } = await startPreview(port)
const browser = await launch()
const errors = []

try {
  for (const view of VIEWS) {
    console.log(`Running check-first5 for ${view.tag}...`)
    const page = await browser.newPage()
    page.on('console', (m) => m.type() === 'error' && errors.push(`${view.tag}: ${m.text()}`))
    page.on('pageerror', (e) => errors.push(`${view.tag}: ${e.message}`))
    await page.setViewport({ width: view.width, height: view.height, deviceScaleFactor: 1 })

    // Load with normal motion (tier=low for headless stability)
    await page.goto(base + '?tier=low#/', { waitUntil: 'load' })
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
    })
    await page.reload({ waitUntil: 'load' })
    await page.waitForSelector('[data-testid="title"]')

    // 1. Initial check-in as Agent A (agent 14, class DEMO)
    await click(page, 'start-shift')
    await page.waitForSelector('[data-testid="firstrun-modal"]')

    // Check home check-in copy
    const checkinDesc = await page.$eval('[data-testid="firstrun-modal"] .form > p.muted', (el) => el.textContent)
    if (!checkinDesc?.includes('Use your roster number. Practicing at home? You can keep 1 and leave the class code blank.')) {
      throw new Error(`Unexpected home checkin copy: ${checkinDesc}`)
    }

    await page.type('[data-testid="classcode-input"]', 'DEMO')
    await page.click('[data-testid="agent-input"]', { clickCount: 3 })
    await page.type('[data-testid="agent-input"]', '14')
    await click(page, 'firstrun-confirm')

    await page.waitForSelector('[data-testid="hub"]')
    await page.screenshot({ path: `${OUT}/pr6-hub-a-${view.tag}.png` })

    // Agent A starts case 03-1 to set lastCaseId
    await page.evaluate(() => (location.hash = '#/case/03-1'))
    await page.waitForSelector('[data-testid="briefing"]')
    await sleep(400)
    await click(page, 'briefing-continue')
    await page.waitForSelector('[data-testid="lab-a"]')

    // Agent A earns science progress by answering a question correctly in cold case
    await page.evaluate(() => (location.hash = '#/cold/cold-1'))
    await page.waitForSelector('[data-testid="cold-intro"]')
    await sleep(300)
    await click(page, 'cold-continue')
    await page.waitForSelector('[data-testid="item-player"]')
    const stemText = await page.$eval('[data-testid="stem"]', (el) => el.textContent?.trim() ?? '')
    const matchedItem = CONTENT.items.find((it) => stemText.includes(it.stem.slice(0, 20)))
    const correctKey = matchedItem ? matchedItem.key : 0
    await click(page, `option-${correctKey}`)
    await click(page, 'lock-in')
    await page.waitForSelector('[data-testid="item-result"][data-ok="yes"]')

    // Return to hub: verify Agent A has science progress and grab report code
    await page.evaluate(() => (location.hash = '#/hub'))
    await page.waitForSelector('[data-testid="hub"]')
    const progressA = await page.evaluate(() => {
      const raw = localStorage.getItem('anomaly.v1')
      const st = raw ? JSON.parse(raw).state : null
      return {
        masteryCount: Object.keys(st?.mastery ?? {}).length,
        progressCount: Object.keys(st?.progress ?? {}).length,
      }
    })
    if (progressA.masteryCount === 0 && progressA.progressCount === 0) {
      throw new Error('Expected Agent A to have earned science progress in storage')
    }
    const startedA = await page.$$eval('.mastery-group-count', (els) =>
      els.reduce((sum, el) => {
        const m = /(\d+)\s+of/.exec(el.textContent || '')
        return sum + (m ? Number(m[1]) : 0)
      }, 0),
    )
    if (startedA < 1) {
      throw new Error(`Expected Agent A to have at least 1 benchmark started, got ${startedA}`)
    }
    await page.waitForSelector('[data-testid="report-code"]')
    const codeA = await text(page, 'report-code')
    if (!codeA) {
      throw new Error('Expected Agent A to have a report code')
    }

    // Return to title
    await page.evaluate(() => (location.hash = '#/'))
    await page.waitForSelector('[data-testid="title"]')
    await page.waitForSelector('[data-testid="title-agent"]')
    const agentTextA = await text(page, 'title-agent')
    if (!agentTextA?.includes('14')) {
      throw new Error(`Expected agent 14 on title, got: ${agentTextA}`)
    }

    const quickPlayA = await text(page, 'title-quick-play')
    if (!quickPlayA?.includes('Play Unit 3: Living Things')) {
      throw new Error(`Expected Agent A quick-play to be "Play Unit 3: Living Things", got: ${quickPlayA}`)
    }

    // Verify actual case destination for Agent A
    await click(page, 'title-quick-play')
    await page.waitForSelector('.case-screen')
    const hashA = await page.evaluate(() => location.hash)
    if (!hashA.includes('/case/03-1')) {
      throw new Error(`Expected Agent A quick play to navigate to /case/03-1, got: ${hashA}`)
    }
    await page.evaluate(() => (location.hash = '#/'))
    await page.waitForSelector('[data-testid="title"]')

    // Check New agent button exists
    if (!(await has(page, 'new-agent'))) {
      throw new Error('Missing new-agent button on title screen')
    }

    // 2. Click New agent: opens confirmation modal
    await click(page, 'new-agent')
    await page.waitForSelector('[data-testid="agent-switch-modal"]')
    const switchDesc = await page.$eval('[data-testid="agent-switch-desc"]', (el) => el.textContent)
    if (!switchDesc?.includes("Use a different agent on this device? I will save this agent's science progress in its own slot. Each agent gets separate cases and rewards.")) {
      throw new Error(`Unexpected agent switch desc: ${switchDesc}`)
    }

    // Click Choose agent number
    await click(page, 'choose-agent')
    await page.waitForSelector('[data-testid="firstrun-modal"]')

    // Verify keyboard focus does not escape to new-agent behind dialog after 260ms exit completes
    await sleep(350)
    const activeInfo = await page.evaluate(() => {
      const el = document.activeElement
      return {
        testId: el?.getAttribute('data-testid'),
        escapedToNewAgent: el?.getAttribute('data-testid') === 'new-agent',
        insideModal: !!el?.closest('[data-testid="firstrun-modal"]'),
      }
    })
    if (activeInfo.escapedToNewAgent || !activeInfo.insideModal) {
      throw new Error(`Keyboard focus escaped check-in dialog after exit: active is ${activeInfo.testId}`)
    }

    // 3. Check in as Agent B (agent 22, class DEMO)
    await page.type('[data-testid="classcode-input"]', 'DEMO')
    await page.click('[data-testid="agent-input"]', { clickCount: 3 })
    await page.type('[data-testid="agent-input"]', '22')
    await click(page, 'firstrun-confirm')

    await page.waitForSelector('[data-testid="hub"]')
    await page.screenshot({ path: `${OUT}/pr6-hub-b-${view.tag}.png` })

    // Check that Agent B starts fresh: checkpoints cleared and lastCaseId not carried over
    const hasCheckpointB = await page.evaluate(() => {
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i)
        if (k && k.startsWith('anomaly.case.')) return true
      }
      return false
    })
    if (hasCheckpointB) {
      throw new Error('Agent B inherited open case checkpoint from Agent A')
    }

    // Assert absence of science progress for Agent B
    const progressB = await page.evaluate(() => {
      const raw = localStorage.getItem('anomaly.v1')
      const st = raw ? JSON.parse(raw).state : null
      return {
        masteryCount: Object.keys(st?.mastery ?? {}).length,
        progressCount: Object.keys(st?.progress ?? {}).length,
      }
    })
    if (progressB.masteryCount > 0 || progressB.progressCount > 0) {
      throw new Error("Agent B inherited Agent A's science progress in storage")
    }
    const startedB = await page.$$eval('.mastery-group-count', (els) =>
      els.reduce((sum, el) => {
        const m = /(\d+)\s+of/.exec(el.textContent || '')
        return sum + (m ? Number(m[1]) : 0)
      }, 0),
    )
    if (startedB !== 0) {
      throw new Error(`Expected Agent B to start with 0 benchmarks started, got ${startedB}`)
    }

    // Return to title as Agent B
    await page.evaluate(() => (location.hash = '#/'))
    await page.waitForSelector('[data-testid="title-agent"]')
    const agentTextB = await text(page, 'title-agent')
    if (!agentTextB?.includes('22')) {
      throw new Error(`Expected agent 22 on title, got: ${agentTextB}`)
    }

    const quickPlayB = await text(page, 'title-quick-play')
    if (quickPlayB?.includes('Unit 3: Living Things')) {
      throw new Error(`Agent B should not have Agent A's case in quick play, got: ${quickPlayB}`)
    }
    if (!quickPlayB?.includes('Play Unit 4: Matter')) {
      throw new Error(`Expected Agent B quick-play to default to "Play Unit 4: Matter", got: ${quickPlayB}`)
    }

    // Verify actual case destination for Agent B
    await click(page, 'title-quick-play')
    await page.waitForSelector('.case-screen')
    const hashB = await page.evaluate(() => location.hash)
    if (!hashB.includes('/case/04-1')) {
      throw new Error(`Expected Agent B quick play to navigate to /case/04-1, got: ${hashB}`)
    }
    await page.evaluate(() => (location.hash = '#/'))
    await page.waitForSelector('[data-testid="title"]')

    // 4. Test Resume code modal copy and exercise code restoration
    await click(page, 'resume-code')
    await page.waitForSelector('[data-testid="resume-modal"]')
    const resumeDesc = await page.$eval('[data-testid="resume-modal"] .form > p.muted', (el) => el.textContent)
    if (!resumeDesc?.includes('Paste your saved Results code to bring science progress to this device. Codes do not carry notebook entries, Intel, or an unfinished lab.')) {
      throw new Error(`Unexpected resume modal copy: ${resumeDesc}`)
    }

    // Restore progress using codeA (Agent 14)
    await page.type('[data-testid="resume-input"]', codeA)
    await page.click('[data-testid="resume-class-input"]', { clickCount: 3 })
    await page.type('[data-testid="resume-class-input"]', 'DEMO')
    await page.waitForSelector('[data-testid="resume-confirm"]')
    await click(page, 'resume-confirm')
    await click(page, 'resume-confirm-btn')

    // Navigates to hub with restored profile and progress
    await page.waitForSelector('[data-testid="hub"]')
    const restoredAgent = await text(page, 'codename')
    if (!restoredAgent?.includes('14')) {
      throw new Error(`Expected codename to restore agent 14, got: ${restoredAgent}`)
    }
    const startedRestored = await page.$$eval('.mastery-group-count', (els) =>
      els.reduce((sum, el) => {
        const m = /(\d+)\s+of/.exec(el.textContent || '')
        return sum + (m ? Number(m[1]) : 0)
      }, 0),
    )
    if (startedRestored < 1) {
      throw new Error(`Expected restored Agent A to have science progress, got ${startedRestored}`)
    }
    const restoredProgress = await page.evaluate(() => {
      const raw = localStorage.getItem('anomaly.v1')
      const st = raw ? JSON.parse(raw).state : null
      return {
        masteryCount: Object.keys(st?.mastery ?? {}).length,
        progressCount: Object.keys(st?.progress ?? {}).length,
      }
    })
    if (restoredProgress.masteryCount === 0 && restoredProgress.progressCount === 0) {
      throw new Error('Expected restored Agent A to have science progress in storage')
    }

    // 5. Return to title and verify Agent A is fully restored
    await page.evaluate(() => (location.hash = '#/'))
    await page.waitForSelector('[data-testid="title-agent"]')
    const agentTextARestored = await text(page, 'title-agent')
    if (!agentTextARestored?.includes('14')) {
      throw new Error(`Expected agent 14 restored, got: ${agentTextARestored}`)
    }

    const quickPlayARestored = await text(page, 'title-quick-play')
    if (!quickPlayARestored?.includes('Play Unit 3: Living Things')) {
      throw new Error(`Expected Agent A quick-play to restore "Play Unit 3: Living Things", got: ${quickPlayARestored}`)
    }

    // Verify actual case destination restored for Agent A
    await click(page, 'title-quick-play')
    await page.waitForSelector('.case-screen')
    const hashARestored = await page.evaluate(() => location.hash)
    if (!hashARestored.includes('/case/03-1')) {
      throw new Error(`Expected restored Agent A quick play to navigate to /case/03-1, got: ${hashARestored}`)
    }

    await page.screenshot({ path: `${OUT}/pr6-title-restored-a-${view.tag}.png` })
    await page.close()
  }

  console.log(errors.length ? `Browser console errors:\n${errors.join('\n')}` : 'check-first5: zero console errors')
  if (errors.length) process.exitCode = 1
} finally {
  await browser.close()
  proc.kill()
}
