export type MineralId = 'quartz' | 'feldspar' | 'mica' | 'calcite' | 'talc' | 'pyrite' | 'graphite'

export type MineralTestId = 'streak' | 'fingernail' | 'penny' | 'steel' | 'glass' | 'luster' | 'peel'

export interface MineralDef {
  id: MineralId
  name: string
  alt: string
  hardnessDesc: string
  tests: Record<MineralTestId, string>
  why: string
  summary: string
}

export const MINERAL_LIST: readonly MineralId[] = [
  'talc',
  'graphite',
  'mica',
  'calcite',
  'feldspar',
  'quartz',
  'pyrite',
]

export const MINERAL_TESTS: readonly {
  id: MineralTestId
  label: string
  cue: 'streak' | 'scratch' | 'press'
}[] = [
  { id: 'streak', label: 'Streak on porcelain', cue: 'streak' },
  { id: 'fingernail', label: 'Scratch with fingernail', cue: 'scratch' },
  { id: 'penny', label: 'Scratch with penny', cue: 'scratch' },
  { id: 'steel', label: 'Scratch with steel nail', cue: 'scratch' },
  { id: 'glass', label: 'Scratch glass with it', cue: 'scratch' },
  { id: 'luster', label: 'Look at luster', cue: 'press' },
  { id: 'peel', label: 'Peel test', cue: 'press' },
]

export const MINERALS: Record<MineralId, MineralDef> = {
  talc: {
    id: 'talc',
    name: 'Talc',
    alt: 'Pale green-white talc mineral hand specimen with soft pearly sheen.',
    hardnessDesc: 'Hardness 1',
    tests: {
      streak: 'Leaves a white streak on porcelain.',
      fingernail: 'A fingernail easily scratches it.',
      penny: 'A copper penny easily scratches it.',
      steel: 'A steel nail easily scratches it.',
      glass: 'It is too soft to scratch glass.',
      luster: 'Pearly and greasy luster; it feels soapy to the touch.',
      peel: 'Does not peel into sheets; it feels soft and soapy.',
    },
    why: 'Talc is the softest mineral with hardness 1. A fingernail scratches it easily, it leaves a white streak, and it feels soapy.',
    summary: 'Hardness 1, fingernail scratches easily, white streak, pearly or greasy luster, feels soapy.',
  },
  graphite: {
    id: 'graphite',
    name: 'Graphite',
    alt: 'Dark grey to black metallic graphite hand specimen.',
    hardnessDesc: 'Hardness 1 to 2',
    tests: {
      streak: 'Leaves a grey black streak on porcelain.',
      fingernail: 'A fingernail scratches it easily and it marks paper.',
      penny: 'A copper penny easily scratches it.',
      steel: 'A steel nail easily scratches it.',
      glass: 'It cannot scratch glass.',
      luster: 'Metallic to dull luster; it feels slippery.',
      peel: 'Does not peel into sheets; it rubs off on your fingers.',
    },
    why: 'Graphite has hardness 1 to 2, feels slippery, and leaves a grey black streak like pencil lead.',
    summary: 'Hardness 1 to 2, fingernail scratches, grey black streak, metallic dull luster, slippery.',
  },
  mica: {
    id: 'mica',
    name: 'Mica',
    alt: 'Shiny sheet-like mica mineral specimen showing thin flexible layers.',
    hardnessDesc: 'Hardness 2.5',
    tests: {
      streak: 'Leaves a white streak on porcelain.',
      fingernail: 'A fingernail scratches it barely.',
      penny: 'A copper penny scratches it.',
      steel: 'A steel nail scratches it easily.',
      glass: 'It cannot scratch glass.',
      luster: 'Pearly and glassy luster with shiny flakes.',
      peel: 'Peels smoothly into very thin, flexible sheets.',
    },
    why: 'Mica has hardness 2.5, pearly luster, and peels into thin sheets.',
    summary: 'Hardness 2.5, fingernail scratches barely, white streak, pearly luster, peels in thin sheets.',
  },
  calcite: {
    id: 'calcite',
    name: 'Calcite',
    alt: 'Clear to whitish blocky, slanted calcite mineral specimen.',
    hardnessDesc: 'Hardness 3',
    tests: {
      streak: 'Leaves a white streak on porcelain.',
      fingernail: 'A fingernail does not scratch it.',
      penny: 'A copper penny scratches it.',
      steel: 'A steel nail easily scratches it.',
      glass: 'It cannot scratch glass.',
      luster: 'Glassy luster, and it fizzes if you drop vinegar on it.',
      peel: 'Does not peel; it breaks along flat sloping faces.',
    },
    why: 'Calcite has hardness 3. A penny scratches it, a fingernail does not, and it fizzes in vinegar.',
    summary: 'Hardness 3, penny scratches but fingernail does not, white streak, glassy luster, fizzes in vinegar.',
  },
  feldspar: {
    id: 'feldspar',
    name: 'Feldspar',
    alt: 'Salmon pink to tan blocky feldspar mineral specimen.',
    hardnessDesc: 'Hardness 6',
    tests: {
      streak: 'Leaves a white streak on porcelain.',
      fingernail: 'A fingernail cannot scratch it.',
      penny: 'A copper penny cannot scratch it.',
      steel: 'A steel nail does not scratch it.',
      glass: 'It scratches glass weakly.',
      luster: 'Glassy to porcelain-like luster.',
      peel: 'Does not peel; it breaks along two flat planes at nearly right angles.',
    },
    why: 'Feldspar has hardness 6. Steel does not scratch it, but it scratches glass weakly.',
    summary: 'Hardness 6, steel does not scratch, scratches glass weakly, white streak, glassy.',
  },
  quartz: {
    id: 'quartz',
    name: 'Quartz',
    alt: 'Clear glassy six-sided quartz crystal hand specimen.',
    hardnessDesc: 'Hardness 7',
    tests: {
      streak: 'White or no streak because it is harder than porcelain.',
      fingernail: 'A fingernail cannot scratch it.',
      penny: 'A copper penny cannot scratch it.',
      steel: 'A steel nail does not scratch it.',
      glass: 'It scratches glass easily and deeply.',
      luster: 'Glassy luster, clear to milky.',
      peel: 'Does not peel; it breaks with curved surfaces like broken glass.',
    },
    why: 'Quartz has hardness 7. Nothing in the kit scratches it, it scratches glass, and it has a glassy luster.',
    summary: 'Hardness 7, scratches glass, nothing in kit scratches it, white or no streak because harder than porcelain, glassy.',
  },
  pyrite: {
    id: 'pyrite',
    name: 'Pyrite',
    alt: 'Golden brassy metallic pyrite mineral specimen with cubic crystal faces.',
    hardnessDesc: 'Hardness 6 to 6.5',
    tests: {
      streak: 'Leaves a greenish black streak on porcelain.',
      fingernail: 'A fingernail cannot scratch it.',
      penny: 'A copper penny cannot scratch it.',
      steel: 'A steel nail does not scratch it.',
      glass: 'It scratches glass.',
      luster: 'Metallic gold and brassy shine.',
      peel: 'Does not peel; it forms chunky cubes.',
    },
    why: 'Pyrite (fool\'s gold) has hardness 6 to 6.5, steel does not scratch it, and it leaves a greenish black streak.',
    summary: 'Hardness 6 to 6.5, steel does not scratch, greenish black streak, metallic gold shine.',
  },
}

export type RockId = 'granite' | 'limestone' | 'gneiss'

export type RockFeatureId = 'grains' | 'layers' | 'bands'

export type RockTypeId = 'igneous' | 'sedimentary' | 'metamorphic'

export interface RockDef {
  id: RockId
  name: string
  alt: string
  rockType: RockTypeId
  rockTypeLabel: string
  features: Record<RockFeatureId, string>
  why: string
  hint: string
}

export const ROCK_LIST: readonly RockId[] = ['granite', 'limestone', 'gneiss']

export const ROCK_FEATURES: readonly { id: RockFeatureId; label: string }[] = [
  { id: 'grains', label: 'Look for grains' },
  { id: 'layers', label: 'Look for layers or shells' },
  { id: 'bands', label: 'Look for bands' },
]

export const ROCK_TYPES: readonly { id: RockTypeId; label: string; desc: string }[] = [
  { id: 'igneous', label: 'Igneous', desc: 'Cooled slowly from molten rock or magma' },
  { id: 'sedimentary', label: 'Sedimentary', desc: 'Formed from layers of bits, shells, or sand cemented together' },
  { id: 'metamorphic', label: 'Metamorphic', desc: 'Changed by high heat and intense underground pressure' },
]

export const ROCKS: Record<RockId, RockDef> = {
  granite: {
    id: 'granite',
    name: 'Granite',
    alt: 'Speckled granite rock specimen showing tightly fitted quartz, feldspar, and mica grains.',
    rockType: 'igneous',
    rockTypeLabel: 'Igneous',
    features: {
      grains: 'Visible coarse mineral grains of quartz, feldspar, and mica locked together.',
      layers: 'No layers and no shell fossils; the crystals grew together in all directions.',
      bands: 'No ribbon-like bands; the mineral crystals are speckled evenly throughout.',
    },
    why: 'Granite is an igneous rock formed when magma cooled slowly deep underground, leaving large visible mineral grains.',
    hint: 'Notice the coarse, tightly fitted mineral grains with no layers or ribbon bands.',
  },
  limestone: {
    id: 'limestone',
    name: 'Limestone',
    alt: 'Light-colored limestone rock specimen with visible shell pieces and calcite bits.',
    rockType: 'sedimentary',
    rockTypeLabel: 'Sedimentary',
    features: {
      grains: 'Fine calcite particles and tiny shell bits cemented together.',
      layers: 'Visible shell fragments, fossil prints, and shallow sea sediment layers.',
      bands: 'No wavy light and dark ribbon bands.',
    },
    why: 'Limestone is a sedimentary rock formed from cemented shells, fossils, and calcite in shallow Florida ocean waters.',
    hint: 'Look for the cemented shell fragments and ocean sediment layers.',
  },
  gneiss: {
    id: 'gneiss',
    name: 'Gneiss',
    alt: 'Banded metamorphic gneiss rock specimen showing wavy light and dark ribbons.',
    rockType: 'metamorphic',
    rockTypeLabel: 'Metamorphic',
    features: {
      grains: 'Mineral grains pressed and flattened into wavy lines.',
      layers: 'No shells or fossils; the mineral grains are folded into tight bands.',
      bands: 'Distinct alternating bands of light and dark minerals folded under heat and pressure.',
    },
    why: 'Gneiss is a metamorphic rock formed when high heat and intense pressure squeezed and banded the minerals.',
    hint: 'Look at the distinct wavy light and dark mineral bands.',
  },
}

export function checkMineralIdentification(
  target: MineralId,
  chosen: MineralId,
): { ok: boolean; word: string; text: string } {
  if (chosen === target) {
    return {
      ok: true,
      word: 'Correct',
      text: MINERALS[target].why,
    }
  }
  return {
    ok: false,
    word: 'Not that one.',
    text: `That sample does not match ${MINERALS[chosen].name}. Review your streak, scratch, and luster evidence.`,
  }
}

export function checkRockClassification(
  target: RockId,
  chosen: RockTypeId,
): { ok: boolean; word: string; text: string } {
  const rock = ROCKS[target]
  if (chosen === rock.rockType) {
    return {
      ok: true,
      word: 'Correct',
      text: rock.why,
    }
  }
  return {
    ok: false,
    word: 'Not quite.',
    text: rock.hint,
  }
}
