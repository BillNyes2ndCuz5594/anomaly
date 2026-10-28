// Where each scene diagram wants its labels, in the 400x220 art space. The layout pass in
// diagramText.ts then wraps, clamps and separates them for the current size and text scale.
import type { LabelSpec } from './diagramText'

export const AMBER = '#ffb547'

/** Sun and planet positions shared by the art and the labels. */
export const SOLAR = { sun: { x: 46, y: 110, r: 34 }, xs: [128, 196, 264, 336] }
export const INNER_OUTER = { sun: { x: 46, y: 104, r: 32 } }
export const BELT = { sun: { x: 28, y: 110, r: 24 } }
export const COMET = { cx: 212, cy: 112, rx: 166, ry: 66 }
export const cometSun = () => ({ x: COMET.cx - Math.sqrt(COMET.rx ** 2 - COMET.ry ** 2), y: COMET.cy })

/** The painted coast plate (water scenes, medium tier and up), placed in art units. */
export const PLATE = { x: -177, y: -58, w: 736, h: 326.4 }

/** Labels for ocean-evaporation when the item gives none: name every surface it shows. */
export const OCEAN_DEFAULTS = ['Ocean', 'Lake', 'River', 'Glacier']

/** `art` places labels for the painted plates (medium tier and up); without it they fit the flat vector art. */
export function sceneLabelSpecs(id: string, labels: string[], art = false): LabelSpec[] {
  const L = (i: number) => labels[i] ?? ''
  switch (id) {
    case 'water-cycle':
      if (art) {
        return [
          { key: 'ocean', text: L(0), x: 60, y: 200 },
          { key: 'vapor', text: L(1), x: 70, y: 74 },
          { key: 'cloud', text: L(2), x: 296, y: 12 },
        ]
      }
      return [
        { key: 'ocean', text: L(0), x: 86, y: 208 },
        { key: 'vapor', text: L(1), x: 72, y: 60 },
        { key: 'cloud', text: L(2), x: 238, y: 20 },
      ]
    case 'ocean-evaporation': {
      const sun = labels.find((l) => /sun/i.test(l))
      const water = labels.find((l) => /lagoon|ocean|lake/i.test(l))
      if (labels.length === 0 && art) {
        return [
          { key: 'ocean', text: OCEAN_DEFAULTS[0], x: 60, y: 200 },
          { key: 'lake', text: OCEAN_DEFAULTS[1], x: 262, y: 196 },
          { key: 'river', text: OCEAN_DEFAULTS[2], x: 378, y: 180 },
          { key: 'glacier', text: OCEAN_DEFAULTS[3], x: 368, y: 104 },
        ]
      }
      if (art) {
        return [
          { key: 'sun', text: sun ?? '', x: 284, y: 44, anchor: 'end' },
          { key: 'water', text: water ?? '', x: 60, y: 200 },
        ]
      }
      if (labels.length === 0) {
        return [
          { key: 'ocean', text: OCEAN_DEFAULTS[0], x: 92, y: 208 },
          { key: 'lake', text: OCEAN_DEFAULTS[1], x: 252, y: 214 },
          { key: 'river', text: OCEAN_DEFAULTS[2], x: 342, y: 214 },
          { key: 'glacier', text: OCEAN_DEFAULTS[3], x: 360, y: 92 },
        ]
      }
      return [
        { key: 'sun', text: sun ?? '', x: 300, y: 46, anchor: 'end' },
        { key: 'water', text: water ?? '', x: 92, y: 208 },
      ]
    }
    case 'solar-system': {
      const names = labels.slice(1)
      return [
        { key: 'sun', text: L(0), x: SOLAR.sun.x, y: 166 },
        ...SOLAR.xs.map((x, i) => ({ key: `p${i}`, text: names[i] && names[i] !== '?' ? names[i] : '', x, y: 154 })),
      ]
    }
    case 'inner-outer-planets':
      return [
        { key: 'sun', text: L(0), x: INNER_OUTER.sun.x, y: 166 },
        { key: 'inner', text: L(1), x: 142, y: 184, maxW: 150 },
        { key: 'outer', text: L(2), x: 304, y: 184, maxW: 160 },
      ]
    case 'comet-orbit': {
      const s = cometSun()
      return [
        { key: 'sun', text: L(0), x: s.x, y: s.y - 26 },
        { key: 'path', text: L(1), x: 272, y: 206, maxW: 260 },
      ]
    }
    case 'asteroid-belt':
      return [{ key: 'belt', text: L(0), x: 232, y: 204, maxW: 260 }]
    case 'plant-pots':
      return [
        { key: 'a', text: L(0), x: 110, y: 198, maxW: 170 },
        { key: 'b', text: L(1), x: 290, y: 198, maxW: 170 },
      ]
    default:
      return [{ key: 'id', text: id, x: 200, y: 110 }]
  }
}
