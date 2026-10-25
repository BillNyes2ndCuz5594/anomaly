import { specimenGeo } from './creatures'
import type { Box } from '../fit'

/** Low or slender animals get a little extra size so they read as well as the chunky ones. */
const BOOST: Record<string, number> = { 'american-alligator': 1.3, 'garden-spider': 1.15, 'largemouth-bass': 1.1, 'blue-crab': 1.25 }

/** Scale that makes the largest dimension of a specimen about `fit` world units. Shared by Specimen and the camera fit. */
export function specimenScale(id: string, fit: number): number {
  const g = specimenGeo(id)
  return (fit * (BOOST[id] ?? 1)) / Math.max(g.size[0], g.size[1] * 1.15, g.size[2])
}

/** World box of a specimen standing on y = 0 at the origin, before any turning. */
export function specimenBox(id: string, fit: number): Box {
  const g = specimenGeo(id)
  const k = specimenScale(id, fit)
  return { min: [(-g.size[0] / 2) * k, 0, (-g.size[2] / 2) * k], max: [(g.size[0] / 2) * k, g.size[1] * k, (g.size[2] / 2) * k] }
}
