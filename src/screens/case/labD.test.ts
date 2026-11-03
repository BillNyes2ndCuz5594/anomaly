import { describe, expect, it } from 'vitest'
import {
  checkMineralIdentification,
  checkRockClassification,
  MINERAL_LIST,
  MINERAL_TESTS,
  MINERALS,
  ROCK_FEATURES,
  ROCK_LIST,
  ROCK_TYPES,
  ROCKS,
} from './labD'

describe('labD pure logic and facts', () => {
  it('defines all 7 benchmark minerals', () => {
    expect(MINERAL_LIST).toHaveLength(7)
    expect(MINERAL_LIST).toEqual([
      'talc',
      'graphite',
      'mica',
      'calcite',
      'feldspar',
      'quartz',
      'pyrite',
    ])
  })

  it('provides all 7 lab tests for every mineral', () => {
    expect(MINERAL_TESTS).toHaveLength(7)
    const testIds = MINERAL_TESTS.map((t) => t.id)
    for (const id of MINERAL_LIST) {
      const min = MINERALS[id]
      expect(min.id).toBe(id)
      for (const tId of testIds) {
        expect(min.tests[tId]).toBeTruthy()
        expect(min.tests[tId].length).toBeGreaterThan(5)
      }
    }
  })

  it('assigns appropriate sound cues for each mineral diagnostic test', () => {
    const cueMap = Object.fromEntries(MINERAL_TESTS.map((t) => [t.id, t.cue]))
    expect(cueMap.streak).toBe('streak')
    expect(cueMap.fingernail).toBe('scratch')
    expect(cueMap.penny).toBe('scratch')
    expect(cueMap.steel).toBe('scratch')
    expect(cueMap.glass).toBe('scratch')
    expect(cueMap.luster).toBe('press')
    expect(cueMap.peel).toBe('press')
  })

  it('contains accurate mineral science facts without forbidden scale terms', () => {
    // Talc: hardness 1, fingernail scratches, white streak, pearly/greasy, soapy
    const talc = MINERALS.talc
    expect(talc.hardnessDesc).toBe('Hardness 1')
    expect(talc.tests.fingernail.toLowerCase()).toContain('scratches')
    expect(talc.tests.streak.toLowerCase()).toContain('white streak')
    expect(talc.tests.luster.toLowerCase()).toContain('pearly')
    expect(talc.tests.luster.toLowerCase()).toContain('soapy')

    // Graphite: hardness 1 to 2, fingernail scratches, grey black streak, slippery
    const graphite = MINERALS.graphite
    expect(graphite.hardnessDesc).toBe('Hardness 1 to 2')
    expect(graphite.tests.fingernail.toLowerCase()).toContain('scratches')
    expect(graphite.tests.streak.toLowerCase()).toContain('grey black streak')
    expect(graphite.tests.luster.toLowerCase()).toContain('slippery')

    // Mica: hardness 2.5, peels in thin sheets
    const mica = MINERALS.mica
    expect(mica.hardnessDesc).toBe('Hardness 2.5')
    expect(mica.tests.fingernail.toLowerCase()).toContain('barely')
    expect(mica.tests.peel.toLowerCase()).toContain('thin, flexible sheets')

    // Calcite: hardness 3, penny scratches, fingernail does not, fizzes
    const calcite = MINERALS.calcite
    expect(calcite.hardnessDesc).toBe('Hardness 3')
    expect(calcite.tests.penny.toLowerCase()).toContain('scratches')
    expect(calcite.tests.fingernail.toLowerCase()).toContain('does not scratch')
    expect(calcite.tests.luster.toLowerCase()).toContain('vinegar')

    // Feldspar: hardness 6, steel does not scratch, scratches glass weakly
    const feldspar = MINERALS.feldspar
    expect(feldspar.hardnessDesc).toBe('Hardness 6')
    expect(feldspar.tests.steel.toLowerCase()).toContain('does not scratch')
    expect(feldspar.tests.glass.toLowerCase()).toContain('scratches glass weakly')

    // Quartz: hardness 7, scratches glass, nothing in kit scratches it
    const quartz = MINERALS.quartz
    expect(quartz.hardnessDesc).toBe('Hardness 7')
    expect(quartz.tests.glass.toLowerCase()).toContain('scratches glass')
    expect(quartz.tests.steel.toLowerCase()).toContain('does not scratch')
    expect(quartz.tests.streak.toLowerCase()).toContain('harder than porcelain')

    // Pyrite: hardness 6 to 6.5, greenish black streak, metallic gold
    const pyrite = MINERALS.pyrite
    expect(pyrite.hardnessDesc).toBe('Hardness 6 to 6.5')
    expect(pyrite.tests.streak.toLowerCase()).toContain('greenish black streak')
    expect(pyrite.tests.luster.toLowerCase()).toContain('metallic gold')
  })

  it('never uses forbidden terms and contains no em or en dashes', () => {
    const raw = JSON.stringify({ MINERALS, ROCKS, MINERAL_TESTS, ROCK_FEATURES, ROCK_TYPES })
    const forbidden = ['m', 'o', 'h', 's'].join('')
    expect(raw.toLowerCase()).not.toContain(forbidden)
    expect(raw).not.toMatch(/[\u2013\u2014]/)
  })

  it('defines the 3 rock types and rock specimens accurately', () => {
    expect(ROCK_LIST).toEqual(['granite', 'limestone', 'gneiss'])
    expect(ROCKS.granite.rockType).toBe('igneous')
    expect(ROCKS.limestone.rockType).toBe('sedimentary')
    expect(ROCKS.gneiss.rockType).toBe('metamorphic')

    expect(ROCKS.granite.features.grains.toLowerCase()).toContain('quartz')
    expect(ROCKS.limestone.features.layers.toLowerCase()).toContain('shell')
    expect(ROCKS.gneiss.features.bands.toLowerCase()).toContain('bands')
  })

  it('evaluates mineral identification accurately across all pairings', () => {
    for (const target of MINERAL_LIST) {
      for (const chosen of MINERAL_LIST) {
        const res = checkMineralIdentification(target, chosen)
        if (target === chosen) {
          expect(res.ok).toBe(true)
          expect(res.word).toBe('Correct')
          expect(res.text).toBe(MINERALS[target].why)
        } else {
          expect(res.ok).toBe(false)
          expect(res.word).toBe('Not that one.')
          expect(res.text).toContain(MINERALS[chosen].name)
        }
      }
    }
  })

  it('evaluates rock classification accurately across all rock types', () => {
    for (const rockId of ROCK_LIST) {
      const rock = ROCKS[rockId]
      for (const rt of ROCK_TYPES) {
        const res = checkRockClassification(rockId, rt.id)
        if (rock.rockType === rt.id) {
          expect(res.ok).toBe(true)
          expect(res.word).toBe('Correct')
          expect(res.text).toBe(rock.why)
        } else {
          expect(res.ok).toBe(false)
          expect(res.word).toBe('Not quite.')
          expect(res.text).toBe(rock.hint)
        }
      }
    }
  })
})
