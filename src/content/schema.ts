// Types and validation for the content (src/content/anomaly-content.json plus the case packs in src/content/packs/).
// SPEC section 11 is enforced here. This module never reads JSON: src/content/index.ts loads and merges it.

export type Pool = 'case' | 'cold'

export type Visual =
  | { kind: 'organ'; highlight: string[]; labels?: boolean }
  | { kind: 'specimen'; ids: string[]; captions: string[] }
  | { kind: 'plantanimal'; show: string[] }
  | { kind: 'table'; title: string; columns: string[]; rows: string[][] }
  | { kind: 'scene'; id: string; labels: string[] }

export interface Item {
  id: string
  benchmark: string
  testedAs: string
  category: string
  complexity: string
  pool: Pool
  stem: string
  options: string[]
  key: number
  why: string[]
  keyWords: string[]
  visual: Visual
  alt: string
  /** Teacher metadata. Never shown to students. */
  tisCheck?: string
  /** Teacher metadata. Never shown to students. */
  misconceptions?: string
}

export interface OrganTask {
  id: string
  text: string
  organ: string
  hint: string
  why: string
}

export interface StructurePair {
  id: string
  animal: string
  plant: string
  job: string
  why: string
}

export interface ContrastCard {
  id: string
  structure: string
  owner: 'plant' | 'animal'
  job: string
  choices: string[]
  why: string
}

export interface Specimen {
  id: string
  name: string
  card: string[]
  backbone: boolean
  group: string
}

/** Reporting category of a case (and of a new item). */
export type Category = 'nature' | 'earth' | 'physical' | 'life'
export const CATEGORIES: readonly Category[] = ['nature', 'earth', 'physical', 'life']
export const CATEGORY_LABEL: Record<Category, string> = {
  nature: 'Nature of Science',
  earth: 'Earth and Space Science',
  physical: 'Physical Science',
  life: 'Life Science',
}

/** Reporting category of a benchmark code such as SC.5.L.14.1 (the letter after the grade). */
export function categoryOfBenchmark(id: string): Category {
  switch (id.split('.')[2]) {
    case 'N':
      return 'nature'
    case 'E':
      return 'earth'
    case 'P':
      return 'physical'
    default:
      return 'life'
  }
}

export interface SortLab {
  kind: 'sort'
  /** One or two sentences, read aloud. */
  intro: string
  /** 2 to 4 bins. */
  bins: { id: string; name: string; hint: string }[]
  /** 4 to 8 cards. `card` is 1 to 3 short lines. */
  cards: { id: string; name: string; card: string[]; bin: string; why: string }[]
}

export interface MatchLab {
  kind: 'match'
  intro: string
  /** 3 to 5. */
  left: { id: string; name: string; card?: string }[]
  /** Same count as left. */
  right: { id: string; name: string; card?: string }[]
  /** One pair per left id. */
  pairs: { left: string; right: string; why: string }[]
}

export interface OrderLab {
  kind: 'order'
  intro: string
  /** For example "Put the steps of the water cycle in order". */
  prompt: string
  /** 3 to 6, listed in the correct order. The player sees them shuffled. */
  steps: { id: string; name: string; card?: string }[]
  why: string
}

export type LabDef = { kind: 'vitals' } | SortLab | MatchLab | OrderLab

/** The three bespoke labs of case 03-1 VITALS. Only that case carries them. */
export interface VitalsLabs {
  organOps: { scenario: string; intro: string; tasks: OrganTask[] }
  structureMatch: { intro: string; pairs: StructurePair[]; contrast: ContrastCard[] }
  specimenSort: { intro: string; specimens: Specimen[] }
}

export interface CaseDef {
  /** "NN-N", for example "04-1". */
  id: string
  /** One word, upper case in the UI, for example "SOLVENT". */
  codename: string
  /** "U04 Matter". */
  unit: string
  /** "Unit 4: Matter". */
  unitLabel: string
  category: Category
  /** Top-level assessed benchmarks this case teaches. */
  benchmarks: string[]
  /** Counts sum to 5; benchmarks from `benchmarks`. */
  evidencePlan: { benchmark: string; count: number }[]
  /** Hub map position (Florida). Space cases use Cape Canaveral 28.39, -80.60. */
  marker: { lon: number; lat: number }
  dispatchHook: string
  /** 3 or 4 short sentences. */
  briefing: string[]
  lab: LabDef
  /** VITALS only (lab.kind 'vitals'). */
  labs?: VitalsLabs
  debriefClosed: string
  debriefOpen: string
}

export interface ColdCaseDef {
  id: string
  codename: string
  dispatchHook: string
  briefing: string[]
  debriefClosed: string
  debriefOpen: string
}

export interface CodexEntry {
  id: string
  title: string
  line: string
}

export interface Content {
  /** VITALS first, then the packs in PACK_ORDER (unit order). */
  cases: CaseDef[]
  coldCase: ColdCaseDef
  items: Item[]
  codex: CodexEntry[]
}

/** One case per file in src/content/packs/<caseId>.json. */
export interface CasePack {
  case: CaseDef
  items: Item[]
  codex?: CodexEntry[]
}

export const BANNED_WORDS = ['body system', 'net force', 'decomposer'] as const
export const MAX_KEY_POSITION_SHARE = 0.4
const DASH = /[\u2013\u2014]/

/** Every string a student can see. Excludes tisCheck and misconceptions (teacher metadata). */
export function studentStrings(c: Content): string[] {
  const out: string[] = []
  const add = (v: unknown) => {
    if (typeof v === 'string') out.push(v)
    else if (Array.isArray(v)) v.forEach(add)
    else if (v && typeof v === 'object') Object.values(v).forEach(add)
  }
  add(c.cases)
  add(c.coldCase)
  add(c.codex)
  for (const it of c.items) {
    add([it.stem, it.options, it.why, it.alt, it.keyWords, it.visual])
  }
  return out
}

function allStrings(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v)
  else if (Array.isArray(v)) v.forEach((x) => allStrings(x, out))
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => allStrings(x, out))
  return out
}

/** Key positions per pool: share of items whose key is at each of the 4 positions. */
export function keyShares(items: Item[], pool: Pool): number[] {
  const list = items.filter((i) => i.pool === pool)
  const counts = [0, 0, 0, 0]
  for (const i of list) if (i.key >= 0 && i.key < 4) counts[i.key]++
  return counts.map((n) => (list.length ? n / list.length : 0))
}


type Bad = (msg: string) => void

/** Checks one item. `strict` adds the rules for new (pack) items: teacher metadata, category, verbatim key words. */
function validateItem(it: Item, bad: Bad, strict: boolean) {
  const tag = `item ${it.id}`
  if (!it.benchmark || !it.testedAs) bad(`${tag}: missing benchmark or testedAs`)
  if (it.pool !== 'case' && it.pool !== 'cold') bad(`${tag}: pool must be case or cold`)
  if (!it.stem?.trim()) bad(`${tag}: empty stem`)
  if (!Array.isArray(it.options) || it.options.length !== 4) bad(`${tag}: needs exactly 4 options`)
  else if (it.options.some((o) => typeof o !== 'string' || !o.trim())) bad(`${tag}: empty option`)
  if (!Number.isInteger(it.key) || it.key < 0 || it.key > 3) bad(`${tag}: key must be an integer 0 to 3`)
  if (!Array.isArray(it.why) || it.why.length !== 4) bad(`${tag}: why needs exactly 4 lines`)
  else if (it.why.some((w) => typeof w !== 'string' || !w.trim())) bad(`${tag}: empty why line`)
  if (!Array.isArray(it.keyWords) || it.keyWords.length === 0) bad(`${tag}: needs key words`)
  else {
    const stem = it.stem ?? ''
    for (const k of it.keyWords) {
      if (!stem.toLowerCase().includes(k.toLowerCase())) bad(`${tag}: key word "${k}" is not in the stem`)
      else if (strict && !stem.includes(k)) bad(`${tag}: key word "${k}" is not copied verbatim from the stem`)
    }
    if (strict && (it.keyWords.length < 2 || it.keyWords.length > 4)) bad(`${tag}: needs 2 to 4 key words`)
  }
  if (!it.visual || typeof it.visual.kind !== 'string') bad(`${tag}: missing visual`)
  else validateVisual(it, bad)
  if (!it.alt?.trim()) bad(`${tag}: missing alt text`)
  if (strict) {
    if (!CATEGORIES.includes(it.category as Category)) bad(`${tag}: category must be nature, earth, physical or life`)
    if (!['low', 'moderate', 'high'].includes(it.complexity)) bad(`${tag}: complexity must be low, moderate or high`)
    if (!it.tisCheck?.trim()) bad(`${tag}: missing tisCheck (teacher metadata)`)
    if (!it.misconceptions?.trim()) bad(`${tag}: missing misconceptions (teacher metadata)`)
  }
}

/** Florida, Keys to the panhandle, with a little sea around it. Cape Canaveral (28.39, -80.60) is inside. */
export const MARKER_BOUNDS = { lonMin: -87.8, lonMax: -79.8, latMin: 24.3, latMax: 31.1 } as const

function dupes(ids: string[]): string[] {
  const seen = new Set<string>()
  const out = new Set<string>()
  for (const id of ids) {
    if (seen.has(id)) out.add(id)
    seen.add(id)
  }
  return [...out]
}

const blank = (s: unknown) => typeof s !== 'string' || !s.trim()

/** Lab shape per kind. VITALS keeps its own checks on `labs`. */
export function validateLab(def: CaseDef, bad: Bad) {
  const lab = def.lab
  const tag = `case ${def.id} lab`
  if (!lab || typeof lab !== 'object') {
    bad(`${tag}: missing`)
    return
  }
  switch (lab.kind) {
    case 'vitals': {
      const t = def.labs
      if (!t) {
        bad(`${tag}: vitals lab needs labs`)
        return
      }
      for (const task of t.organOps.tasks) {
        if (!task.organ || !task.why || !task.hint || !task.text) bad(`task ${task.id}: incomplete`)
      }
      for (const p of t.structureMatch.pairs) if (!p.animal || !p.plant || !p.why) bad(`pair ${p.id}: incomplete`)
      for (const cc of t.structureMatch.contrast) {
        if (!cc.choices.includes(cc.job)) bad(`contrast ${cc.id}: job is not among the choices`)
      }
      for (const s of t.specimenSort.specimens) {
        if (s.card.length === 0 || !s.group) bad(`specimen ${s.id}: incomplete`)
      }
      return
    }
    case 'sort': {
      if (blank(lab.intro)) bad(`${tag}: empty intro`)
      const bins = lab.bins ?? []
      const cards = lab.cards ?? []
      if (bins.length < 2 || bins.length > 4) bad(`${tag}: sort needs 2 to 4 bins`)
      if (cards.length < 4 || cards.length > 8) bad(`${tag}: sort needs 4 to 8 cards`)
      for (const d of dupes(bins.map((b) => b.id))) bad(`${tag}: duplicate bin id ${d}`)
      for (const d of dupes(cards.map((c) => c.id))) bad(`${tag}: duplicate card id ${d}`)
      for (const b of bins) if (blank(b.id) || blank(b.name) || blank(b.hint)) bad(`${tag}: bin ${b.id} incomplete`)
      const binIds = new Set(bins.map((b) => b.id))
      for (const c of cards) {
        if (blank(c.id) || blank(c.name) || blank(c.why)) bad(`${tag}: card ${c.id} incomplete`)
        if (!Array.isArray(c.card) || c.card.length < 1 || c.card.length > 3 || c.card.some(blank)) bad(`${tag}: card ${c.id} needs 1 to 3 lines`)
        if (!binIds.has(c.bin)) bad(`${tag}: card ${c.id} names a bin that does not exist (${c.bin})`)
      }
      for (const b of bins) if (!cards.some((c) => c.bin === b.id)) bad(`${tag}: bin ${b.id} gets no card`)
      return
    }
    case 'match': {
      if (blank(lab.intro)) bad(`${tag}: empty intro`)
      const left = lab.left ?? []
      const right = lab.right ?? []
      const pairs = lab.pairs ?? []
      if (left.length < 3 || left.length > 5) bad(`${tag}: match needs 3 to 5 left cards`)
      if (right.length !== left.length) bad(`${tag}: match needs the same count left and right`)
      for (const d of dupes([...left, ...right].map((x) => x.id))) bad(`${tag}: duplicate id ${d}`)
      for (const x of [...left, ...right]) if (blank(x.id) || blank(x.name)) bad(`${tag}: card ${x.id} incomplete`)
      const leftIds = new Set(left.map((x) => x.id))
      const rightIds = new Set(right.map((x) => x.id))
      for (const p of pairs) {
        if (!leftIds.has(p.left)) bad(`${tag}: pair names a left id that does not exist (${p.left})`)
        if (!rightIds.has(p.right)) bad(`${tag}: pair names a right id that does not exist (${p.right})`)
        if (blank(p.why)) bad(`${tag}: pair ${p.left} needs a why`)
      }
      for (const x of left) if (pairs.filter((p) => p.left === x.id).length !== 1) bad(`${tag}: left ${x.id} needs exactly one pair`)
      for (const d of dupes(pairs.map((p) => p.right))) bad(`${tag}: right ${d} is in more than one pair`)
      return
    }
    case 'order': {
      if (blank(lab.intro)) bad(`${tag}: empty intro`)
      if (blank(lab.prompt)) bad(`${tag}: empty prompt`)
      if (blank(lab.why)) bad(`${tag}: empty why`)
      const steps = lab.steps ?? []
      if (steps.length < 3 || steps.length > 6) bad(`${tag}: order needs 3 to 6 steps`)
      for (const d of dupes(steps.map((x) => x.id))) bad(`${tag}: duplicate step id ${d}`)
      for (const x of steps) if (blank(x.id) || blank(x.name)) bad(`${tag}: step ${x.id} incomplete`)
      return
    }
    default:
      bad(`${tag}: unknown kind ${(lab as { kind?: string }).kind}`)
  }
}

/** One case: header fields, evidence plan, marker, lab, and enough case pool items for the plan. */
export function validateCase(def: CaseDef, items: Item[], bad: Bad) {
  const tag = `case ${def.id}`
  if (!/^\d{2}-\d$/.test(def.id ?? '')) bad(`${tag}: id must look like NN-N`)
  if (blank(def.codename) || !/^[A-Z]+$/.test(def.codename)) bad(`${tag}: codename must be one upper case word`)
  if (blank(def.unit) || blank(def.unitLabel)) bad(`${tag}: missing unit or unitLabel`)
  if (!CATEGORIES.includes(def.category)) bad(`${tag}: category must be nature, earth, physical or life`)
  if (!Array.isArray(def.benchmarks) || def.benchmarks.length === 0) bad(`${tag}: needs benchmarks`)
  const plan = Array.isArray(def.evidencePlan) ? def.evidencePlan : []
  const sum = plan.reduce((n, p) => n + (Number.isInteger(p.count) && p.count > 0 ? p.count : 0), 0)
  if (sum !== 5) bad(`${tag}: evidencePlan counts must sum to 5 (got ${sum})`)
  for (const p of plan) {
    if (!def.benchmarks?.includes(p.benchmark)) bad(`${tag}: evidencePlan names ${p.benchmark}, which is not one of the case benchmarks`)
    const have = items.filter((i) => i.pool === 'case' && i.benchmark === p.benchmark).length
    if (have < p.count) bad(`${tag}: evidencePlan wants ${p.count} items for ${p.benchmark} but the case pool has ${have}`)
  }
  const m = def.marker
  const b = MARKER_BOUNDS
  if (!m || typeof m.lon !== 'number' || typeof m.lat !== 'number') bad(`${tag}: missing marker`)
  else if (m.lon < b.lonMin || m.lon > b.lonMax || m.lat < b.latMin || m.lat > b.latMax) bad(`${tag}: marker is outside Florida and the Cape`)
  if (blank(def.dispatchHook)) bad(`${tag}: missing dispatchHook`)
  if (!Array.isArray(def.briefing) || def.briefing.length < 3 || def.briefing.length > 4 || def.briefing.some(blank)) bad(`${tag}: briefing needs 3 or 4 sentences`)
  if (blank(def.debriefClosed) || blank(def.debriefOpen)) bad(`${tag}: missing debrief lines`)
  validateLab(def, bad)
}

/** Rules for one pack on its own: the case, strict item rules, items only for the case benchmarks, codex. */
export function validatePack(pack: CasePack): string[] {
  const problems: string[] = []
  const bad = (msg: string) => problems.push(msg)
  if (!pack?.case) return ['pack: missing case']
  const items = Array.isArray(pack.items) ? pack.items : []
  validateCase(pack.case, items, bad)
  if (pack.case.lab?.kind === 'vitals') bad(`case ${pack.case.id}: a pack cannot use the vitals lab`)
  for (const d of dupes(items.map((i) => i.id))) bad(`item ${d}: duplicate id`)
  for (const it of items) {
    validateItem(it, bad, true)
    if (!pack.case.benchmarks?.includes(it.benchmark)) bad(`item ${it.id}: benchmark ${it.benchmark} is not one of the case benchmarks`)
  }
  for (const d of dupes((pack.codex ?? []).map((e) => e.id))) bad(`codex ${d}: duplicate id`)
  for (const e of pack.codex ?? []) if (!e.id || !e.title || !e.line) bad(`codex ${e.id}: incomplete`)
  for (const s of allStrings(pack)) {
    if (DASH.test(s)) bad(`em or en dash found: "${s.slice(0, 60)}"`)
  }
  return problems
}

/**
 * Returns a list of human readable problems. Empty means the content is valid.
 * Runs over the merged content. With `packs`, also runs each pack on its own and names id clashes between packs.
 */
export function validateContent(c: Content, packs: readonly CasePack[] = []): string[] {
  const problems: string[] = []
  const bad = (msg: string) => problems.push(msg)

  const ids = new Set<string>()
  for (const it of c.items) {
    if (ids.has(it.id)) bad(`item ${it.id}: duplicate id`)
    ids.add(it.id)
    validateItem(it, bad, false)
  }

  const cases = Array.isArray(c.cases) ? c.cases : []
  if (cases.length === 0) bad('content: needs at least one case')
  for (const d of dupes([...cases.map((x) => x.id), c.coldCase?.id])) bad(`case ${d}: duplicate case id`)
  for (const def of cases) validateCase(def, c.items, bad)
  for (const d of dupes(c.codex.map((e) => e.id))) bad(`codex ${d}: duplicate id`)
  for (const e of c.codex) if (!e.id || !e.title || !e.line) bad(`codex ${e.id}: incomplete`)

  for (const s of allStrings(c)) {
    if (DASH.test(s)) bad(`em or en dash found: "${s.slice(0, 60)}"`)
  }
  for (const s of studentStrings(c)) {
    const lower = s.toLowerCase()
    for (const w of BANNED_WORDS) if (lower.includes(w)) bad(`banned phrase "${w}" in: "${s.slice(0, 60)}"`)
  }

  for (const pool of ['case', 'cold'] as const) {
    const shares = keyShares(c.items, pool)
    shares.forEach((share, pos) => {
      if (share > MAX_KEY_POSITION_SHARE) {
        bad(`pool ${pool}: key position ${pos + 1} holds ${Math.round(share * 100)}% of keys (max 40%)`)
      }
    })
  }

  // Each pack on its own, then ids that clash between packs (or with the base file), named by pack.
  const owners = new Map<string, string[]>()
  const own = (key: string, who: string) => owners.set(key, [...(owners.get(key) ?? []), who])
  for (const p of packs) {
    const who = `pack ${p.case?.id ?? '?'}`
    for (const msg of validatePack(p)) bad(`${who}: ${msg}`)
    own(`case ${p.case?.id}`, who)
    for (const it of p.items ?? []) own(`item ${it.id}`, who)
    for (const e of p.codex ?? []) own(`codex ${e.id}`, who)
  }
  const merged = new Map<string, number>()
  const count = (key: string) => merged.set(key, (merged.get(key) ?? 0) + 1)
  for (const def of cases) count(`case ${def.id}`)
  for (const it of c.items) count(`item ${it.id}`)
  for (const e of c.codex) count(`codex ${e.id}`)
  for (const [key, who] of owners) {
    if (who.length > 1) bad(`${key}: id clash between ${who.join(' and ')}`)
    if ((merged.get(key) ?? 0) > who.length) bad(`${key}: id clash between ${who.join(' and ')} and the base content`)
  }
  return problems
}

function validateVisual(it: Item, bad: Bad) {
  const v = it.visual
  const tag = `item ${it.id} visual`
  switch (v.kind) {
    case 'organ':
      if (!Array.isArray(v.highlight)) bad(`${tag}: organ needs highlight list`)
      break
    case 'specimen':
      if (!Array.isArray(v.ids) || v.ids.length === 0) bad(`${tag}: specimen needs ids`)
      else if (v.captions?.length !== v.ids.length) bad(`${tag}: captions must match ids`)
      break
    case 'plantanimal':
      if (!Array.isArray(v.show) || v.show.length === 0) bad(`${tag}: plantanimal needs show list`)
      break
    case 'table':
      if (!v.title || !v.columns?.length || !v.rows?.length) bad(`${tag}: table incomplete`)
      else if (v.rows.some((r) => r.length !== v.columns.length)) bad(`${tag}: row width differs from columns`)
      break
    case 'scene':
      if (!v.id) bad(`${tag}: scene needs id`)
      break
    default:
      bad(`${tag}: unknown kind`)
  }
}
