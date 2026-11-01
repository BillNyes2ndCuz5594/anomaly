/** Aquatic specimens drift and pitch; every other specimen breathes. */
export const AQUATIC = new Set(['manatee', 'largemouth-bass', 'bull-shark'])

/** Stable phase offset in [0, 2 pi) from the id, so two specimens side by side never move in lockstep. */
export function idPhase(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return ((h >>> 0) % 6283) / 1000
}
