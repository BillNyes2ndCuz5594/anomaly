import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { TEXT_SCALE } from '../../state/settings'
import { S7_SLOTS, sceneLabelSpecs } from './diagramLabels'
import { baseScale, intersects, labelSize, layoutLabels, viewBoxFor } from './diagramText'
import { EARTH_DIAGRAMS } from './diagrams/earth'
import { LIFE_DIAGRAMS } from './diagrams/life'
import { NATURE_DIAGRAMS } from './diagrams/nature'
import { PHYSICAL_DIAGRAMS } from './diagrams/physical'
import { SPACE_DIAGRAMS } from './diagrams/space'
import { SCENE_IDS } from './sceneIds'

const ORIGINAL = ['water-cycle', 'ocean-evaporation', 'solar-system', 'inner-outer-planets', 'comet-orbit', 'asteroid-belt', 'plant-pots']
const LONG = 'Cumulonimbus storm cloud'

/** Every slot of a diagram filled with a long label. ocean-evaporation picks its two slots by word, so it gets matching ones. */
function longLabels(id: string): string[] {
  if (id === 'ocean-evaporation') return ['Afternoon Sun overhead', 'Ocean surface water']
  const n = S7_SLOTS[id]?.slots.length ?? 5
  return Array.from({ length: n }, () => LONG)
}

describe('scene ids', () => {
  it('lists the seven original diagrams first, then the 42 from S7, with no repeats', () => {
    expect(SCENE_IDS.slice(0, 7)).toEqual(ORIGINAL)
    expect(SCENE_IDS.length).toBe(49)
    expect(new Set(SCENE_IDS).size).toBe(49)
  })
  it('has a drawing and label slots for every S7 id, and nothing else', () => {
    const drawn = Object.keys({ ...NATURE_DIAGRAMS, ...SPACE_DIAGRAMS, ...EARTH_DIAGRAMS, ...PHYSICAL_DIAGRAMS, ...LIFE_DIAGRAMS })
    const s7 = SCENE_IDS.slice(7)
    expect([...drawn].sort()).toEqual([...s7].sort())
    expect(Object.keys(S7_SLOTS).sort()).toEqual([...s7].sort())
    for (const id of s7) {
      const set = S7_SLOTS[id]
      if (set.order) expect([...set.order].sort(), id).toEqual(set.slots.map((_, i) => i))
    }
  })
  it('matches the SCENE_IDS set in scripts/check-pack.mjs', () => {
    const src = readFileSync(new URL('../../../scripts/check-pack.mjs', import.meta.url), 'utf8')
    const block = src.match(/const SCENE_IDS = new Set\(\[([\s\S]*?)\]\)/)
    expect(block, 'SCENE_IDS set in check-pack.mjs').not.toBeNull()
    const ids = [...block![1].matchAll(/'([^']+)'/g)].map((m) => m[1])
    expect([...ids].sort()).toEqual([...SCENE_IDS].sort())
    expect(ids.length).toBe(new Set(ids).size)
  })
})

describe('S7 label slots', () => {
  it('fill in the S7 slot order and hide a missing or empty label', () => {
    const specs = sceneLabelSpecs('rock-types', ['Layered', '', 'Banded'])
    const byKey = Object.fromEntries(specs.map((s) => [s.key, s.text]))
    expect(byKey).toEqual({ left: 'Layered', middle: '', right: 'Banded' })
    const placed = layoutLabels(specs, 10, viewBoxFor(675, 334))
    expect(placed.map((p) => p.key).sort()).toEqual(['left', 'right'])
    expect(layoutLabels(sceneLabelSpecs('energy-forms', ['Light']), 10, viewBoxFor(675, 334)).map((p) => p.key)).toEqual(['f1'])
  })
})

describe('every scene diagram with long labels in every slot', () => {
  // the item panel at 1366x768, a big panel at 1920x1080 and a phone panel
  const panels: [number, number][] = [
    [675, 334],
    [1114, 686],
    [340, 200],
  ]
  for (const ts of Object.values(TEXT_SCALE)) {
    for (const [w, h] of panels) {
      it(`keeps labels inside the view and apart at text x${ts} in ${w}x${h}`, () => {
        const vb = viewBoxFor(w, h)
        const size = labelSize(baseScale(w, h), ts)
        const problems: string[] = []
        for (const id of SCENE_IDS) {
          for (const art of [false, true]) {
            const placed = layoutLabels(sceneLabelSpecs(id, longLabels(id), art), size, vb)
            const tag = `${id}${art ? ' (art)' : ''}`
            if (placed.length === 0) problems.push(`${tag}: no labels`)
            for (const p of placed) {
              const b = p.box
              if (b.x0 < vb.x || b.x1 > vb.x + vb.w || b.y0 < vb.y || b.y1 > vb.y + vb.h) problems.push(`${tag}/${p.key} outside`)
            }
            for (let i = 0; i < placed.length; i++)
              for (let j = i + 1; j < placed.length; j++) if (intersects(placed[i].box, placed[j].box)) problems.push(`${tag}: ${placed[i].key} x ${placed[j].key}`)
          }
        }
        expect(problems).toEqual([])
      })
    }
  }
})
