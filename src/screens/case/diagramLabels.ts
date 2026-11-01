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

/** One label slot of an S7 diagram: where its text sits in the 400x220 art. */
interface Slot {
  key: string
  x: number
  y: number
  anchor?: 'start' | 'middle' | 'end'
  maxW?: number
}
interface SlotSet {
  /** In the S7 slot order: labels[i] fills slots[i]. */
  slots: Slot[]
  /**
   * Layout priority (slot indices). The layout pass places labels in this order and nudges later ones
   * apart, so outer slots go first and the middle ones last: on a phone panel a full row of long labels
   * then stacks instead of colliding.
   */
  order?: number[]
}
const s = (key: string, x: number, y: number, o: Partial<Slot> = {}): Slot => ({ key, x, y, ...o })
const RING_SLOTS: SlotSet = { slots: [s('s1', 100, 18), s('s2', 300, 18), s('s3', 300, 206), s('s4', 100, 206)] }
/** Labels wrap at this width unless a slot says otherwise, so a long label stacks rather than spreading. */
const SLOT_MAX_W = 160

/** Label slots for the 42 S7 diagrams (docs/tasks/S7-content.md section 4). Up-to-N slots run left to right or around the ring. */
export const S7_SLOTS: Record<string, SlotSet> = {
  'fair-test-plants': { slots: [s('left', 100, 206), s('right', 300, 206), s('same', 300, 30)] },
  'bar-graph': { slots: [s('title', 236, 18), s('x', 236, 208), s('y', 46, 104, { maxW: 100 }), s('tallest', 326, 36)] },
  'lab-tools': { slots: [s('t1', 58, 202), s('t2', 135, 30), s('t3', 208, 202), s('t4', 271, 30), s('t5', 346, 202)], order: [0, 4, 1, 3, 2] },
  'galaxy-spiral': { slots: [s('galaxy', 80, 24), s('sun', 330, 205)] },
  'star-brightness-distance': { slots: [s('near', 150, 140), s('far', 346, 22), s('earth', 56, 205)] },
  'earth-day-night': { slots: [s('sun', 44, 26), s('day', 220, 205), s('night', 330, 26)] },
  'moon-month': { slots: [s('first', 40, 190), s('middle', 224, 70), s('last', 366, 190)] },
  'sun-earth-moon': { slots: [s('sun', 64, 168), s('earth', 269, 182), s('moon', 330, 104)] },
  'weathering-erosion': { slots: [s('crack', 262, 96), s('root', 40, 104), s('stream', 300, 160)] },
  'mineral-streak': { slots: [s('mineral', 330, 205), s('plate', 110, 205), s('streak', 200, 102)] },
  'rock-types': { slots: [s('left', 75, 204), s('middle', 200, 204), s('right', 325, 204)], order: [0, 2, 1] },
  'florida-resources': {
    slots: [s('well', 186, 62, { anchor: 'start' }), s('quarry', 206, 118, { anchor: 'start' }), s('turbine', 80, 84), s('solar', 226, 176, { anchor: 'start' })],
  },
  'weather-instruments': { slots: [s('thermometer', 90, 112), s('barometer', 318, 86), s('vane', 110, 22), s('gauge', 340, 206)] },
  'climate-zones': { slots: [s('polar', 310, 18), s('temperate', 90, 66), s('tropical', 320, 120)] },
  'cloud-types': { slots: [s('high', 300, 60), s('mid', 300, 126), s('low', 290, 194), s('storm', 80, 206)] },
  'florida-fronts': { slots: [s('front', 320, 50), s('cool', 70, 20), s('warm', 310, 200)] },
  'matter-three-states': { slots: [s('solid', 70, 206), s('liquid', 200, 206), s('gas', 320, 34)] },
  'mixture-separation': { slots: [s('mixture', 200, 206), s('magnet', 110, 40), s('sieve', 345, 80)] },
  'dissolving-temperature': { slots: [s('warm', 110, 206), s('cold', 290, 206), s('sugar', 200, 30)] },
  'physical-chemical-change': { slots: [s('ice', 110, 206), s('candle', 290, 206)] },
  'energy-forms': {
    slots: [s('f1', 70, 18), s('f2', 200, 18), s('f3', 330, 18), s('f4', 70, 204), s('f5', 200, 204), s('f6', 330, 204)],
    order: [0, 2, 3, 5, 1, 4],
  },
  'light-path': { slots: [s('flashlight', 52, 24), s('mirror', 366, 206), s('water', 225, 206)] },
  'circuit-open-closed': { slots: [s('open', 100, 206), s('closed', 300, 206), s('bulb', 200, 24)] },
  'conductor-insulator': { slots: [s('metal', 100, 206), s('plastic', 300, 206)] },
  'heat-flow': { slots: [s('cocoa', 145, 206), s('spoon', 236, 118), s('hand', 350, 104)] },
  'static-balloon': { slots: [s('balloon', 320, 30), s('hair', 72, 206), s('wall', 378, 206)] },
  'forces-ramp': { slots: [s('push', 96, 120), s('gravity', 194, 206), s('friction', 300, 52)] },
  'friction-surfaces': { slots: [s('smooth', 300, 112), s('rough', 290, 206)] },
  'falling-apple': { slots: [s('apple', 194, 104), s('ball', 300, 18), s('gravity', 140, 206)] },
  'magnet-poles': { slots: [s('attract', 200, 30), s('repel', 200, 206)] },
  'speed-graph': { slots: [s('fast', 232, 44), s('slow', 336, 100), s('time', 220, 208)] },
  'plant-parts': { slots: [s('roots', 200, 208), s('stem', 130, 150), s('leaves', 110, 95), s('flower', 200, 16), s('fruit', 300, 156)] },
  'seed-to-plant': { slots: [s('p1', 40, 204), s('p2', 120, 96), s('p3', 200, 204), s('p4', 280, 28), s('p5', 360, 204)], order: [0, 4, 2, 1, 3] },
  'butterfly-cycle': RING_SLOTS,
  'grasshopper-cycle': RING_SLOTS,
  'frog-cycle': RING_SLOTS,
  'food-chain-florida': { slots: [s('l1', 40, 196), s('l2', 120, 28), s('l3', 200, 196), s('l4', 280, 28), s('l5', 360, 196)], order: [0, 4, 1, 3, 2] },
  'food-web-estuary': {
    slots: [s('producers', 90, 210), s('shrimp', 70, 112), s('crab', 320, 210), s('fish', 336, 116), s('bass', 100, 40), s('pelican', 370, 60)],
  },
  'beak-shapes': { slots: [s('b1', 64, 206), s('b2', 200, 206), s('b3', 334, 206)], order: [0, 2, 1] },
  'seasons-florida-north': { slots: [s('florida', 100, 206), s('north', 300, 206)] },
  'environment-change': { slots: [s('wet', 100, 206), s('dry', 330, 96)] },
  'inherited-learned': { slots: [s('coat', 104, 206), s('trick', 300, 206)] },
}

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
        // maxW only matters for a long name: it wraps to two lines instead of spreading over its neighbours
        { key: 'sun', text: L(0), x: SOLAR.sun.x, y: 166, maxW: SLOT_MAX_W },
        ...SOLAR.xs.map((x, i) => ({ key: `p${i}`, text: names[i] && names[i] !== '?' ? names[i] : '', x, y: 154, maxW: SLOT_MAX_W })),
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
    default: {
      const set = S7_SLOTS[id]
      if (!set) return [{ key: 'id', text: id, x: 200, y: 110 }]
      const order = set.order ?? set.slots.map((_, i) => i)
      return order.map((i) => {
        const { key, x, y, anchor, maxW } = set.slots[i]
        return { key, text: L(i), x, y, anchor, maxW: maxW ?? SLOT_MAX_W }
      })
    }
  }
}
