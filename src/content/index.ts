// The only module that reads content JSON. It merges the base file (VITALS, the cold case, their items, the codex)
// with the case packs in src/content/packs/<caseId>.json, in PACK_ORDER (unit order).
// A pack file that is not listed here is not loaded, and `npm test` fails until it is listed.
import raw from './anomaly-content.json'
import manifest from './manifest.json'
import type { CaseDef, CasePack, CodexEntry, ColdCaseDef, Content, Item, VitalsLabs } from './schema'

/** Case packs to load, in unit order. Ids match the file names in src/content/packs/. */
export const PACK_ORDER: readonly string[] = ['00-1', '01-1', '02-1', '02-2', '04-1', '05-1', '06-1', '07-1', '07-2']

interface BaseContent {
  case: CaseDef
  coldCase: ColdCaseDef
  items: Item[]
  codex: CodexEntry[]
}

const base = raw as unknown as BaseContent

const files = import.meta.glob<CasePack>('./packs/*.json', { import: 'default' })
export const packPath = (id: string) => `./packs/${id}.json`
const cache = new Map<string, Promise<void>>()
const loaded = new Set<string>()

/** Install once, keeping the public arrays and indexes stable for existing consumers. */
export function installPack(pack: CasePack): void {
  if (loaded.has(pack.case.id)) return
  loaded.add(pack.case.id)
  content.items.push(...pack.items)
  for (const item of pack.items) itemsById.set(item.id, item)
}

/** Concurrent hover, route and screen requests share one import. Failed imports can retry. */
export function loadPack(id: string): Promise<void> {
  if (id === base.case.id || loaded.has(id)) return Promise.resolve()
  const load = files[packPath(id)]
  if (!load) return Promise.reject(new Error(`Unknown case pack ${id}`))
  let pending = cache.get(id)
  if (!pending) {
    pending = load().then((pack) => {
      if (pack.case.id !== id) throw new Error(`Case pack ${id} holds case ${pack.case.id}`)
      installPack(pack)
    }).catch((error: unknown) => { cache.delete(id); throw error })
    cache.set(id, pending)
  }
  return pending
}

export function loadAllPacks(): Promise<void[]> {
  return Promise.all(PACK_ORDER.map(loadPack))
}

export function packLoaded(id: string): boolean {
  return id === base.case.id || loaded.has(id)
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

/** The base file as read, for tests that merge fixture packs onto it. */
export const baseContent: BaseContent = base

// Navigation, codex and teacher counts stay eager; no pack items enter this manifest.
export const content: Content = {
  ...mergeContent(base, []),
  cases: [base.case, ...manifest.map((p) => p.case as CaseDef)],
  codex: [...base.codex, ...manifest.flatMap((p) => p.codex as CodexEntry[])],
}

export const reviewItems: Pick<Item, 'pool' | 'benchmark'>[] = [
  ...base.items.filter((i) => i.pool === 'cold'),
  ...manifest.flatMap((p) => p.reviewBenchmarks.map((benchmark) => ({ pool: 'cold' as const, benchmark }))),
]

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
