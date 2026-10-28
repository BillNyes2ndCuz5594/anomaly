// Pure data and ratio maths, no three.js, so the item panel can use it without pulling the model code into the main bundle.
/**
 * Typical longest dimension of each specimen in metres (nose to tail, or leg span for a spider or crab). Used only to
 * size animals honestly next to each other in an evidence panel.
 */
export const SPECIMEN_LENGTH_M: Record<string, number> = {
  manatee: 3.0,
  'brown-pelican': 1.2,
  'gopher-tortoise': 0.3,
  'green-tree-frog': 0.06,
  'bull-shark': 2.4,
  'blue-crab': 0.2,
  'largemouth-bass': 0.4,
  'florida-panther': 1.8,
  'barred-owl': 0.45,
  'american-alligator': 3.0,
  grasshopper: 0.06,
  'garden-spider': 0.07,
}

/** The smallest a specimen is drawn next to the largest one in its panel, as a fraction of that one's length. */
export const MIN_PAIR_RATIO = 0.42
/** A row of three or more shares a narrow stage, so its small animals get a little more room to stay legible. */
export const MIN_ROW_RATIO = 0.6


/**
 * Real size ratio of each id to the largest in the list, with the small ones lifted to `cap` so they stay readable.
 * Ids missing from the table count as the largest, so they are never shrunk.
 */
export function pairRatios(ids: string[], cap = ids.length >= 3 ? MIN_ROW_RATIO : MIN_PAIR_RATIO): { ratios: number[]; notToScale: boolean } {
  const len = ids.map((id) => SPECIMEN_LENGTH_M[id] ?? 0)
  const max = Math.max(...len)
  if (ids.length < 2 || max <= 0) return { ratios: ids.map(() => 1), notToScale: false }
  const true_ = len.map((l) => (l > 0 ? l / max : 1))
  return { ratios: true_.map((r) => Math.max(cap, r)), notToScale: true_.some((r) => r < cap - 1e-9) }
}
