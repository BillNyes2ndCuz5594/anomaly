// Prints a content pack as a markdown review sheet for the teacher (docs/CONTENT_REVIEW.md).
// Usage: node scripts/review-sheet.mjs src/content/packs/04-1.json [more packs...] > review.md
import { readFileSync } from 'node:fs'

const LETTERS = ['A', 'B', 'C', 'D']
const esc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')

function visualLine(v) {
  if (!v) return ''
  switch (v.kind) {
    case 'scene':
      return `scene ${v.id} [${(v.labels ?? []).filter(Boolean).join(', ')}]`
    case 'table':
      return `table "${v.title}" (${v.columns.join(' | ')}; ${v.rows.length} rows)`
    case 'specimen':
      return `specimen ${v.ids.join(', ')}`
    case 'organ':
      return `organ ${v.highlight.join(', ')}`
    case 'plantanimal':
      return `plant vs animal ${v.show.join(', ')}`
    default:
      return v.kind
  }
}

function sheet(pack, file) {
  const c = pack.case
  const out = []
  out.push(`# Review sheet: case ${c.id} ${c.codename} (${file})`)
  out.push('')
  out.push(`Unit: ${c.unitLabel}. Category: ${c.category}. Benchmarks: ${c.benchmarks.join(', ')}.`)
  out.push(`Evidence plan: ${c.evidencePlan.map((p) => `${p.benchmark} x${p.count}`).join(', ')}.`)
  out.push('')
  out.push('## Case text')
  out.push('')
  out.push(`- Dispatch hook: ${c.dispatchHook}`)
  c.briefing.forEach((s, i) => out.push(`- Briefing ${i + 1}: ${s}`))
  out.push(`- Debrief (closed): ${c.debriefClosed}`)
  out.push(`- Debrief (open): ${c.debriefOpen}`)
  out.push('')
  out.push(`## Lab (${c.lab.kind})`)
  out.push('')
  if (c.lab.intro) out.push(`Intro: ${c.lab.intro}`)
  if (c.lab.kind === 'sort') {
    out.push('')
    out.push('| Bin | Hint |')
    out.push('|---|---|')
    for (const b of c.lab.bins) out.push(`| ${esc(b.name)} | ${esc(b.hint)} |`)
    out.push('')
    out.push('| Card | Lines | Bin | Why |')
    out.push('|---|---|---|---|')
    for (const k of c.lab.cards) out.push(`| ${esc(k.name)} | ${esc(k.card.join(' / '))} | ${k.bin} | ${esc(k.why)} |`)
  } else if (c.lab.kind === 'match') {
    out.push('')
    out.push('| Left | Right | Why |')
    out.push('|---|---|---|')
    const L = new Map(c.lab.left.map((x) => [x.id, x]))
    const R = new Map(c.lab.right.map((x) => [x.id, x]))
    for (const p of c.lab.pairs) out.push(`| ${esc(L.get(p.left)?.name)} | ${esc(R.get(p.right)?.name)} | ${esc(p.why)} |`)
  } else if (c.lab.kind === 'order') {
    out.push('')
    out.push(`Prompt: ${c.lab.prompt}`)
    out.push('')
    c.lab.steps.forEach((s, i) => out.push(`${i + 1}. ${s.name}${s.card ? ` (${s.card})` : ''}`))
    out.push('')
    out.push(`Why: ${c.lab.why}`)
  }
  out.push('')
  out.push(`## Items (${pack.items.length})`)
  out.push('')
  const byBench = {}
  for (const it of pack.items) (byBench[it.benchmark] = byBench[it.benchmark] ?? []).push(it)
  for (const [b, items] of Object.entries(byBench)) {
    out.push(`### ${b} (${items.length} items: ${items.filter((i) => i.pool === 'case').length} case, ${items.filter((i) => i.pool === 'cold').length} cold)`)
    out.push('')
    for (const it of items) {
      out.push(`#### ${it.id}  [${it.pool}, ${it.complexity}, tested as ${it.testedAs}]`)
      out.push('')
      out.push(`${it.stem}`)
      out.push('')
      it.options.forEach((o, i) => out.push(`- ${i === it.key ? '**' : ''}${LETTERS[i]}. ${esc(o)}${i === it.key ? '** (key)' : ''}: ${esc(it.why[i])}`))
      out.push('')
      out.push(`- Key words: ${it.keyWords.join(', ')}`)
      out.push(`- Visual: ${visualLine(it.visual)}. Alt: ${esc(it.alt)}`)
      out.push(`- Limit applied: ${esc(it.tisCheck)}`)
      out.push(`- Misconceptions: ${esc(it.misconceptions)}`)
      out.push(`- Decision: keep / fix / drop`)
      out.push('')
    }
  }
  if (pack.codex?.length) {
    out.push('## Codex')
    out.push('')
    for (const e of pack.codex) out.push(`- ${e.title}: ${e.line}`)
    out.push('')
  }
  return out.join('\n')
}

const files = process.argv.slice(2)
if (files.length === 0) {
  console.error('usage: node scripts/review-sheet.mjs <pack.json> [...]')
  process.exit(2)
}
console.log(files.map((f) => sheet(JSON.parse(readFileSync(f, 'utf8')), f)).join('\n\n'))
