// Types and validation for src/content/anomaly-content.json. SPEC section 11 is enforced here.
import raw from './anomaly-content.json'

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

export interface CaseDef {
  id: string
  codename: string
  unit: string
  benchmarks: string[]
  dispatchHook: string
  briefing: string[]
  labs: {
    organOps: { scenario: string; intro: string; tasks: OrganTask[] }
    structureMatch: { intro: string; pairs: StructurePair[]; contrast: ContrastCard[] }
    specimenSort: { intro: string; specimens: Specimen[] }
  }
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
  case: CaseDef
  coldCase: ColdCaseDef
  items: Item[]
  codex: CodexEntry[]
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
  add(c.case)
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

/** Returns a list of human readable problems. Empty means the content is valid. */
export function validateContent(c: Content): string[] {
  const problems: string[] = []
  const bad = (msg: string) => problems.push(msg)

  const ids = new Set<string>()
  for (const it of c.items) {
    const tag = `item ${it.id}`
    if (ids.has(it.id)) bad(`${tag}: duplicate id`)
    ids.add(it.id)
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
      const stem = (it.stem ?? '').toLowerCase()
      for (const k of it.keyWords) {
        if (!stem.includes(k.toLowerCase())) bad(`${tag}: key word "${k}" is not in the stem`)
      }
    }
    if (!it.visual || typeof it.visual.kind !== 'string') bad(`${tag}: missing visual`)
    else validateVisual(it, bad)
    if (!it.alt?.trim()) bad(`${tag}: missing alt text`)
  }

  const t = c.case.labs
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
  return problems
}

function validateVisual(it: Item, bad: (m: string) => void) {
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

export const content = raw as unknown as Content

export const itemsById: Map<string, Item> = new Map(content.items.map((i) => [i.id, i]))
export const codexById: Map<string, CodexEntry> = new Map(content.codex.map((e) => [e.id, e]))
