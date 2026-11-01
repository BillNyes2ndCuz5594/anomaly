// Standalone check of one or more content packs (docs/tasks/S6-case-files.md section 2, S7 section 2).
// Usage: node scripts/check-pack.mjs src/content/packs/00-1.json [more packs...]
// Prints the problems and exits 1 when any pack has one. The S6 validator in src/content/schema.ts runs the
// same rules inside `npm test`; this script lets a writer check a pack before the engine lists it.
import { readFileSync } from 'node:fs'

const SCENE_IDS = new Set([
  'water-cycle', 'ocean-evaporation', 'solar-system', 'inner-outer-planets', 'comet-orbit', 'asteroid-belt', 'plant-pots',
  'fair-test-plants', 'bar-graph', 'lab-tools', 'galaxy-spiral', 'star-brightness-distance', 'earth-day-night', 'moon-month',
  'sun-earth-moon', 'weathering-erosion', 'mineral-streak', 'rock-types', 'florida-resources', 'weather-instruments',
  'climate-zones', 'cloud-types', 'florida-fronts', 'matter-three-states', 'mixture-separation', 'dissolving-temperature',
  'physical-chemical-change', 'energy-forms', 'light-path', 'circuit-open-closed', 'conductor-insulator', 'heat-flow',
  'static-balloon', 'forces-ramp', 'friction-surfaces', 'falling-apple', 'magnet-poles', 'speed-graph', 'plant-parts',
  'seed-to-plant', 'butterfly-cycle', 'grasshopper-cycle', 'frog-cycle', 'food-chain-florida', 'food-web-estuary',
  'beak-shapes', 'seasons-florida-north', 'environment-change', 'inherited-learned',
])
const SPECIMEN_IDS = new Set([
  'manatee', 'brown-pelican', 'gopher-tortoise', 'green-tree-frog', 'bull-shark', 'blue-crab', 'florida-panther',
  'american-alligator', 'garden-spider', 'largemouth-bass', 'barred-owl', 'grasshopper', 'white-tailed-deer',
])
const CATEGORIES = new Set(['nature', 'earth', 'physical', 'life'])
const COMPLEXITY = new Set(['low', 'moderate', 'high'])
const BANNED = ['body system', 'net force', 'decomposer']
const NEVER_USED = [
  'constellation', 'waning', 'waxing', 'gibbous', 'radiant', 'electron', 'hypothes', 'transpiration', 'infiltration',
  'percolation', 'mohs', 'rock cycle', 'parallel circuit', 'series circuit',
]
const DASH = /[–—]/

function strings(v, out = []) {
  if (typeof v === 'string') out.push(v)
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out))
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => strings(x, out))
  return out
}

export function checkPack(pack, name = 'pack') {
  const bad = []
  const c = pack.case
  if (!c) return [`${name}: missing case`]
  if (!/^\d\d-\d$/.test(c.id ?? '')) bad.push(`case id "${c.id}" must look like 04-1`)
  for (const k of ['codename', 'unit', 'unitLabel', 'dispatchHook', 'debriefClosed', 'debriefOpen']) {
    if (typeof c[k] !== 'string' || !c[k].trim()) bad.push(`case ${k}: missing`)
  }
  if (!CATEGORIES.has(c.category)) bad.push(`case category "${c.category}" must be nature, earth, physical or life`)
  if (!Array.isArray(c.benchmarks) || c.benchmarks.length === 0) bad.push('case benchmarks: empty')
  if (!Array.isArray(c.briefing) || c.briefing.length < 3 || c.briefing.length > 4) bad.push('case briefing: needs 3 or 4 sentences')
  if (!c.marker || typeof c.marker.lon !== 'number' || typeof c.marker.lat !== 'number') bad.push('case marker: needs lon and lat')
  else if (c.marker.lat < 24 || c.marker.lat > 31.2 || c.marker.lon < -87.7 || c.marker.lon > -79.8) bad.push('case marker: outside Florida')
  const plan = Array.isArray(c.evidencePlan) ? c.evidencePlan : []
  const planSum = plan.reduce((s, p) => s + (p.count ?? 0), 0)
  if (planSum !== 5) bad.push(`case evidencePlan: counts sum to ${planSum}, need 5`)
  for (const p of plan) if (!c.benchmarks?.includes(p.benchmark)) bad.push(`case evidencePlan names ${p.benchmark}, not in benchmarks`)

  const lab = c.lab
  if (!lab || !lab.kind) bad.push('case lab: missing')
  else if (lab.kind === 'sort') {
    const bins = new Set((lab.bins ?? []).map((b) => b.id))
    if (bins.size < 2 || bins.size > 4) bad.push('sort lab: 2 to 4 bins')
    if (!lab.cards || lab.cards.length < 4 || lab.cards.length > 8) bad.push('sort lab: 4 to 8 cards')
    for (const b of lab.bins ?? []) if (!b.name || !b.hint) bad.push(`sort bin ${b.id}: needs name and hint`)
    for (const k of lab.cards ?? []) {
      if (!bins.has(k.bin)) bad.push(`sort card ${k.id}: bin "${k.bin}" does not exist`)
      if (!k.name || !k.why || !Array.isArray(k.card) || k.card.length < 1 || k.card.length > 3) bad.push(`sort card ${k.id}: needs name, why and 1 to 3 card lines`)
    }
  } else if (lab.kind === 'match') {
    const L = lab.left ?? []
    const R = lab.right ?? []
    if (L.length < 3 || L.length > 5 || L.length !== R.length) bad.push('match lab: 3 to 5 left items and the same number on the right')
    const lid = new Set(L.map((x) => x.id))
    const rid = new Set(R.map((x) => x.id))
    const seen = new Set()
    for (const p of lab.pairs ?? []) {
      if (!lid.has(p.left) || !rid.has(p.right)) bad.push(`match pair ${p.left}/${p.right}: unknown id`)
      if (seen.has(p.left)) bad.push(`match pair: left ${p.left} used twice`)
      seen.add(p.left)
      if (!p.why) bad.push(`match pair ${p.left}: needs why`)
    }
    if ((lab.pairs ?? []).length !== L.length) bad.push('match lab: one pair per left item')
  } else if (lab.kind === 'order') {
    if (!lab.prompt || !lab.why) bad.push('order lab: needs prompt and why')
    if (!lab.steps || lab.steps.length < 3 || lab.steps.length > 6) bad.push('order lab: 3 to 6 steps')
    for (const s of lab.steps ?? []) if (!s.id || !s.name) bad.push('order step: needs id and name')
  } else if (lab.kind !== 'vitals') bad.push(`case lab kind "${lab.kind}" unknown`)
  if (lab && !['vitals'].includes(lab.kind) && !lab.intro) bad.push('lab: needs intro')

  const items = pack.items ?? []
  const ids = new Set()
  const counts = { case: [0, 0, 0, 0], cold: [0, 0, 0, 0] }
  const perBench = {}
  for (const it of items) {
    const tag = `item ${it.id}`
    if (ids.has(it.id)) bad.push(`${tag}: duplicate id`)
    ids.add(it.id)
    if (!c.benchmarks?.includes(it.benchmark)) bad.push(`${tag}: benchmark ${it.benchmark} is not one of the case's`)
    if (!it.testedAs) bad.push(`${tag}: missing testedAs`)
    if (it.category !== c.category) bad.push(`${tag}: category must be ${c.category}`)
    if (!COMPLEXITY.has(it.complexity)) bad.push(`${tag}: complexity low, moderate or high`)
    if (it.pool !== 'case' && it.pool !== 'cold') bad.push(`${tag}: pool case or cold`)
    if (!it.stem?.trim()) bad.push(`${tag}: empty stem`)
    else if (!/\?\s*$/.test(it.stem.trim())) bad.push(`${tag}: the stem must end with a question`)
    if (!Array.isArray(it.options) || it.options.length !== 4 || it.options.some((o) => !o?.trim())) bad.push(`${tag}: 4 non-empty options`)
    if (!Number.isInteger(it.key) || it.key < 0 || it.key > 3) bad.push(`${tag}: key 0 to 3`)
    else if (counts[it.pool]) counts[it.pool][it.key]++
    if (!Array.isArray(it.why) || it.why.length !== 4 || it.why.some((w) => !w?.trim())) bad.push(`${tag}: 4 why lines`)
    else {
      it.why.forEach((w, i) => {
        if (i === it.key && !/^Correct:/.test(w)) bad.push(`${tag}: why for the key starts with "Correct:"`)
        if (i !== it.key && !/^Decoy:/.test(w)) bad.push(`${tag}: why for option ${i + 1} starts with "Decoy:"`)
      })
    }
    if (!Array.isArray(it.keyWords) || it.keyWords.length < 2 || it.keyWords.length > 4) bad.push(`${tag}: 2 to 4 key words`)
    else {
      const stem = (it.stem ?? '').toLowerCase()
      for (const k of it.keyWords) if (!stem.includes(k.toLowerCase())) bad.push(`${tag}: key word "${k}" is not in the stem`)
    }
    if (!it.alt?.trim()) bad.push(`${tag}: missing alt`)
    if (!it.tisCheck?.trim()) bad.push(`${tag}: missing tisCheck`)
    if (!it.misconceptions?.trim()) bad.push(`${tag}: missing misconceptions`)
    const v = it.visual
    if (!v || !v.kind) bad.push(`${tag}: missing visual`)
    else if (v.kind === 'scene') {
      if (!SCENE_IDS.has(v.id)) bad.push(`${tag}: scene id "${v.id}" is not in the list`)
      if (!Array.isArray(v.labels)) bad.push(`${tag}: scene needs a labels array (may be empty)`)
    } else if (v.kind === 'specimen') {
      if (!Array.isArray(v.ids) || v.ids.length === 0 || v.ids.some((s) => !SPECIMEN_IDS.has(s))) bad.push(`${tag}: specimen ids must be known`)
      if (!Array.isArray(v.captions) || v.captions.length !== (v.ids ?? []).length) bad.push(`${tag}: captions match ids`)
    } else if (v.kind === 'table') {
      if (!v.title || !v.columns?.length || !v.rows?.length) bad.push(`${tag}: table incomplete`)
      else if (v.rows.some((r) => r.length !== v.columns.length)) bad.push(`${tag}: table row width`)
    } else if (v.kind === 'organ') {
      if (!Array.isArray(v.highlight)) bad.push(`${tag}: organ needs highlight`)
    } else if (v.kind === 'plantanimal') {
      if (!Array.isArray(v.show) || v.show.length === 0) bad.push(`${tag}: plantanimal needs show`)
    } else bad.push(`${tag}: unknown visual kind ${v.kind}`)
    perBench[it.benchmark] = perBench[it.benchmark] ?? { case: 0, cold: 0 }
    if (perBench[it.benchmark][it.pool] !== undefined) perBench[it.benchmark][it.pool]++
  }
  for (const b of c.benchmarks ?? []) {
    const n = perBench[b] ?? { case: 0, cold: 0 }
    if (n.case < 4) bad.push(`benchmark ${b}: ${n.case} case items, need at least 4`)
    if (n.cold < 2) bad.push(`benchmark ${b}: ${n.cold} cold items, need at least 2`)
  }
  for (const pool of ['case', 'cold']) {
    const total = counts[pool].reduce((a, b) => a + b, 0)
    // Balance is judged per pool across the merged content; a pack checks its own share once it has 4 items.
    counts[pool].forEach((n, i) => {
      if (total >= 4 && n / total > 0.4) bad.push(`pool ${pool}: key position ${i + 1} holds ${Math.round((100 * n) / total)}% of keys (max 40%)`)
    })
  }
  for (const e of pack.codex ?? []) if (!e.id || !e.title || !e.line) bad.push(`codex ${e.id}: incomplete`)

  const student = strings({ case: c, codex: pack.codex, items: items.map((i) => [i.stem, i.options, i.why, i.alt, i.keyWords, i.visual]) })
  for (const s of strings(pack)) if (DASH.test(s)) bad.push(`em or en dash: "${s.slice(0, 60)}"`)
  for (const s of student) {
    const lower = s.toLowerCase()
    for (const w of BANNED) if (lower.includes(w)) bad.push(`banned phrase "${w}" in: "${s.slice(0, 60)}"`)
    for (const w of NEVER_USED) if (lower.includes(w)) bad.push(`never-used word "${w}" in: "${s.slice(0, 60)}"`)
  }
  return bad.map((m) => `${name}: ${m}`)
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const files = process.argv.slice(2)
  if (files.length === 0) {
    console.error('usage: node scripts/check-pack.mjs <pack.json> [...]')
    process.exit(2)
  }
  let problems = []
  for (const f of files) {
    try {
      problems = problems.concat(checkPack(JSON.parse(readFileSync(f, 'utf8')), f))
    } catch (e) {
      problems.push(`${f}: ${e.message}`)
    }
  }
  if (problems.length) {
    for (const p of problems) console.log(p)
    console.log(`${problems.length} problem(s)`)
    process.exit(1)
  }
  const n = files.length
  console.log(`check-pack: ok, ${n} pack${n === 1 ? '' : 's'}`)
}
