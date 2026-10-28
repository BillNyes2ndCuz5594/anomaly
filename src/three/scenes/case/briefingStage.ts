/** Pure motion for the briefing scan and the lab lamps. Frozen covers reduced motion and ?still=1. */

export const SCAN_RATE = 0.17
export const SCAN_REST = 0.4
/** The bar stays on the front lip of the table. It does not travel up the body. */
export const BAR_BASE = 0.04
export const BAR_TOP = 0.28

export function scanPhase(elapsed: number, frozen: boolean): number {
  if (frozen) return SCAN_REST
  const p = (elapsed * SCAN_RATE) % 1
  return p < 0 ? p + 1 : p
}

export function scanFade(phase: number): number {
  return Math.pow(Math.sin(Math.min(1, Math.max(0, phase)) * Math.PI), 0.7)
}

export function scanHeight(phase: number): number {
  return BAR_BASE + phase * BAR_TOP
}

/** Key light stays in a narrow band so a breathing lamp does not flash the specimen. */
export function lampScale(elapsed: number, frozen: boolean): number {
  if (frozen) return 1
  return 0.94 + Math.sin(elapsed * 0.65) * 0.06
}

/**
 * Idle tints. Matched parts are repainted by the pair color in PartMesh.
 * Shells stay quieter than the structure inside them so the two layers separate.
 */
export function partTint(side: 'a' | 'p', id: string): string {
  if (side === 'a') {
    if (id === 'skeleton') return '#d7e9ff'
    if (id === 'skin') return '#67c7c2'
    return '#56B4E9'
  }
  switch (id) {
    case 'leaf':
      return '#009E73'
    case 'root':
      return '#E69F00'
    case 'bark':
      return '#8fd0b8'
    case 'stem':
      return '#d5ecff'
    case 'flower':
      return '#CC79A7'
    case 'fruit':
      return '#E69F00'
    case 'seed':
      return '#F0E442'
    default:
      return '#56B4E9'
  }
}
