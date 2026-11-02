// Walks a case pack (any case but VITALS) through the real UI: hub marker, briefing, the generic Field Lab (every
// card placed through the HUD buttons), the evidence items, debrief and results. Shared by proof.mjs and
// smoke-cases.mjs. `check(name, ok, detail)` records a result; `shot(name)` takes a screenshot (both optional).
import { setTimeout as sleep } from 'node:timers/promises'

const sel = (id) => `[data-testid="${id}"]`
const tokens = (s) => s.split(/\s+/).filter(Boolean).join(' ')

async function clickId(page, id) {
  await page.waitForSelector(`${sel(id)}:not([disabled])`, { timeout: 30000 })
  await page.click(sel(id))
}
const textOf = (page, id) => page.$eval(sel(id), (e) => e.textContent ?? '')
const attrOf = (page, id, a) => page.$eval(sel(id), (e, a) => e.getAttribute(a), a)

/** Test id of the button that answers the current question, and of one wrong but open button. */
export async function nextMove(page, lab) {
  if (lab.kind === 'order') {
    const placed = await page.$$eval('[data-testid^="lab-slot-"].done', (els) => els.length)
    const right = lab.steps[placed].id
    const wrong = lab.steps.slice(placed + 1)[0]?.id
    return { right: `lab-step-${right}`, wrong: wrong ? `lab-step-${wrong}` : null }
  }
  const name = (await textOf(page, 'lab-card-name')).trim()
  if (lab.kind === 'sort') {
    const card = lab.cards.find((c) => c.name === name)
    if (!card) throw new Error(`no sort card named ${name}`)
    const wrong = lab.bins.find((b) => b.id !== card.bin)?.id
    return { right: `lab-bin-${card.bin}`, wrong: wrong ? `lab-bin-${wrong}` : null }
  }
  const left = lab.left.find((c) => c.name === name)
  if (!left) throw new Error(`no match card named ${name}`)
  const right = lab.pairs.find((p) => p.left === left.id).right
  const used = new Set(await page.$$eval('[data-testid^="lab-right-"]:disabled', (els) => els.map((e) => e.getAttribute('data-testid'))))
  const wrong = lab.right.map((r) => `lab-right-${r.id}`).find((id) => id !== `lab-right-${right}` && !used.has(id))
  return { right: `lab-right-${right}`, wrong: wrong ?? null }
}

/**
 * Places every card of the generic lab through the HUD buttons. The first question gets a wrong pick first
 * (gentle "Not quite."), the second is answered from the keyboard (focus, Enter). Returns the number of placements.
 */
export async function playGenericLab(page, lab, { check = () => {}, label = '', onFirstCorrect } = {}) {
  await page.waitForSelector(sel('lab-generic'))
  check(`generic lab shows the ${lab.kind} lab (${label})`, (await attrOf(page, 'lab-generic', 'data-kind')) === lab.kind)
  const total = lab.kind === 'sort' ? lab.cards.length : lab.kind === 'match' ? lab.left.length : lab.steps.length
  for (let n = 0; n < total; n++) {
    const move = await nextMove(page, lab)
    if (n === 0 && move.wrong) {
      await clickId(page, move.wrong)
      await page.waitForFunction(() => document.querySelector('[data-testid="lab-feedback"]')?.getAttribute('data-ok') === 'no', { timeout: 10000 })
      check(`generic lab wrong pick says Not quite. with a hint (${label})`, (await textOf(page, 'lab-feedback')).includes('Not quite.'))
    }
    const before = await page.$$eval('[data-testid="lab-feedback"]', (els) => els.length)
    if (n === 1) {
      await page.focus(sel(move.right))
      await page.keyboard.press('Enter')
    } else {
      await clickId(page, move.right)
    }
    await page.waitForFunction(() => document.querySelector('[data-testid="lab-feedback"]')?.getAttribute('data-ok') === 'yes', { timeout: 10000 })
    if (n === 1) check(`generic lab plays from the keyboard (${label})`, (await attrOf(page, 'lab-feedback', 'data-ok')) === 'yes', `${before}`)
    if (n === 0 && onFirstCorrect) await onFirstCorrect()
    await sleep(120)
  }
  await page.waitForSelector(sel('lab-next'))
  const placed = (await textOf(page, 'lab-placed')).match(/PLACED (\d+) OF (\d+)/)
  check(`generic lab counts every card placed (${label})`, placed && placed[1] === placed[2] && Number(placed[2]) === total, placed?.[0] ?? 'none')
  return total
}

/** Answers every evidence item right, using the merged content. Returns the items asked. */
export async function playPackItems(page, items, total = 5) {
  await page.waitForSelector(sel('item-player'))
  const asked = []
  for (let n = 0; n < total; n++) {
    await page.waitForSelector(sel('stem'))
    const stem = tokens((await textOf(page, 'stem')).replace(/\s+/g, ' ').trim())
    const item = items.find((it) => tokens(it.stem) === stem)
    if (!item) throw new Error('item not found for stem: ' + stem)
    asked.push(item)
    await sleep(n === 0 ? 1500 : 400)
    await clickId(page, `option-${item.key}`)
    await clickId(page, 'lock-in')
    await page.waitForSelector(sel('item-result'))
    await sleep(250)
    await clickId(page, 'next-item')
    await sleep(250)
  }
  return asked
}

/**
 * The whole walk for one pack, from the hub. `content` is the merged content (scripts/lib/content.mjs).
 * Steps reported in `steps`, so a caller can say exactly what ran.
 */
export async function walkPack(page, pack, content, { check = () => {}, shot = async () => {}, label = '', readCalls } = {}) {
  const c = pack.case
  const steps = []
  await page.evaluate(() => (location.hash = '#/hub'))
  await page.waitForSelector(sel('hub'))
  await sleep(600)
  check(`hub lists case ${c.id} as New (${label})`, (await textOf(page, `case-status-${c.id}`)).includes('New'))
  await clickId(page, `case-marker-${c.id}`)
  steps.push('hub marker')

  await page.waitForSelector(sel('briefing'))
  check(`pack briefing route (${label})`, (await page.evaluate(() => location.hash)) === `#/case/${c.id}`)
  check(`pack step bar has a Field Lab (${label})`, (await textOf(page, 'step-indicator')).includes('Field Lab'))
  check(`pack briefing shows its lines (${label})`, (await textOf(page, 'briefing-text')).includes(c.briefing[0].slice(0, 20)))
  await sleep(800)
  await shot('pack-briefing')
  await clickId(page, 'briefing-continue')
  steps.push('briefing')

  let calls = null
  await playGenericLab(page, c.lab, {
    check,
    label,
    onFirstCorrect: async () => {
      await sleep(1500)
      if (readCalls) calls = await readCalls()
      await shot('pack-lab')
    },
  })
  steps.push(`field lab (${c.lab.kind})`)
  await clickId(page, 'lab-next')

  const asked = await playPackItems(page, content.items, 5)
  const plan = Object.fromEntries(c.evidencePlan.map((p) => [p.benchmark, p.count]))
  const got = {}
  for (const it of asked) got[it.benchmark] = (got[it.benchmark] ?? 0) + 1
  check(`pack evidence follows its plan (${label})`, Object.entries(plan).every(([b, n]) => got[b] === n), JSON.stringify(got))
  steps.push(`evidence (${asked.length} items)`)

  await page.waitForSelector(sel('debrief'))
  await sleep(1000)
  check(`pack debrief closes the case (${label})`, (await attrOf(page, 'case-stamp', 'data-closed')) === 'yes')
  check(`pack debrief uses the pack line (${label})`, (await textOf(page, 'debrief')).includes(c.debriefClosed))
  await clickId(page, 'debrief-continue')
  steps.push('debrief')

  await page.waitForSelector(sel('results'))
  await sleep(1500)
  const bars = await page.$$('[data-testid^="mastery-bar-"]')
  check(`pack results show a bar per case benchmark (${label})`, bars.length === c.benchmarks.length, `${bars.length}`)
  check(`pack results name the case (${label})`, (await textOf(page, 'case-status')).includes(`CASE ${c.id} ${c.codename}`))
  await shot('pack-results')
  steps.push('results')
  await clickId(page, 'back-to-hub')
  await page.waitForSelector(sel('hub'))
  await sleep(500)
  check(`hub shows case ${c.id} as Closed (${label})`, (await textOf(page, `case-status-${c.id}`)).includes('Closed'))
  return { steps, calls, asked }
}
