// The only module that reads content JSON. It merges the base file (VITALS, the cold case, their items, the codex)
// with the case packs in src/content/packs/<caseId>.json, in PACK_ORDER (unit order).
// A pack file that is not listed here is not loaded, and `npm test` fails until it is listed.
import raw from './anomaly-content.json'
import type { CaseDef, CasePack, CodexEntry, ColdCaseDef, Content, Item, VitalsLabs } from './schema'

/** Case packs to load, in unit order. Ids match the file names in src/content/packs/. */
export const PACK_ORDER: readonly string[] = []

interface BaseContent {
  case: CaseDef
  coldCase: ColdCaseDef
  items: Item[]
  codex: CodexEntry[]
}

const base = raw as unknown as BaseContent

const files = import.meta.glob<CasePack>('./packs/*.json', { eager: true, import: 'default' })

/** Pack file path (as the loader sees it) for a case id. */
export const packPath = (id: string) => `./packs/${id}.json`

function loadPacks(order: readonly string[]): CasePack[] {
  return order.map((id) => {
    const p = files[packPath(id)]
    if (!p) throw new Error(`Case pack ${id} is listed in PACK_ORDER but src/content/packs/${id}.json is missing.`)
    if (p.case?.id !== id) throw new Error(`Case pack file ${id}.json holds case ${p.case?.id}.`)
    return p
  })
}

/** Builds the merged content: VITALS first, then the packs in order. Pure, so tests can merge fixture packs. */
export function mergeContent(b: BaseContent, packs: readonly CasePack[]): Content {
  return {
    cases: [b.case, ...packs.map((p) => p.case)],
    coldCase: b.coldCase,
    items: [...b.items, ...packs.flatMap((p) => p.items)],
    codex: [...b.codex, ...packs.flatMap((p) => p.codex ?? [])],
  }
}

/** The packs PACK_ORDER lists, in that order. */
export const packs: readonly CasePack[] = loadPacks(PACK_ORDER)

/** The base file as read, for tests that merge fixture packs onto it. */
export const baseContent: BaseContent = base

export const content: Content = mergeContent(base, packs)

export const itemsById: Map<string, Item> = new Map(content.items.map((i) => [i.id, i]))
export const codexById: Map<string, CodexEntry> = new Map(content.codex.map((e) => [e.id, e]))
const casesById: Map<string, CaseDef> = new Map(content.cases.map((c) => [c.id, c]))

/** A case by id, or undefined when no such case is on file. */
export function caseById(id: string | null | undefined): CaseDef | undefined {
  return id ? casesById.get(id) : undefined
}

/** Case 03-1 VITALS, the case with the three bespoke labs. */
export const vitalsCase: CaseDef = content.cases[0]

function needLabs(def: CaseDef): VitalsLabs {
  if (!def.labs) throw new Error('VITALS labs missing from content')
  return def.labs
}

/** The VITALS labs (Lab A, B and C). */
export const VITALS_LABS: VitalsLabs = needLabs(vitalsCase)
