// Merged content for the Node scripts (catalog, proof, mobile, smoke). Mirrors src/content/index.ts in plain JS:
// the base file, then the packs that PACK_ORDER lists, in that order. No TypeScript import.
import { readFileSync } from 'node:fs'

const SRC = new URL('../../src/content/', import.meta.url)

/** Case ids listed in PACK_ORDER in src/content/index.ts. */
export function packOrder() {
  const src = readFileSync(new URL('index.ts', SRC), 'utf8')
  const m = src.match(/export const PACK_ORDER[^=]*=\s*\[([\s\S]*?)\]/)
  if (!m) throw new Error('PACK_ORDER not found in src/content/index.ts')
  return [...m[1].matchAll(/['"]([^'"]+)['"]/g)].map((x) => x[1])
}

/** The base content file as stored (VITALS under `case`, the cold case, items, codex). */
export function baseContent() {
  return JSON.parse(readFileSync(new URL('anomaly-content.json', SRC), 'utf8'))
}

/** The packs PACK_ORDER lists, in order. */
export function loadPacks(order = packOrder()) {
  return order.map((id) => JSON.parse(readFileSync(new URL(`packs/${id}.json`, SRC), 'utf8')))
}

/**
 * Merged content: `case` stays the VITALS case (the scripts walk its labs), `cases` lists VITALS then the packs,
 * and `items` and `codex` hold everything.
 */
export function loadContent() {
  const base = baseContent()
  const packs = loadPacks()
  return {
    ...base,
    cases: [base.case, ...packs.map((p) => p.case)],
    items: [...base.items, ...packs.flatMap((p) => p.items)],
    codex: [...base.codex, ...packs.flatMap((p) => p.codex ?? [])],
  }
}
