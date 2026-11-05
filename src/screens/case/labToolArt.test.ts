import { describe, expect, it } from 'vitest'
import { choiceArt, SOLVENT_CHOICE_ART } from './labToolArt'

describe('labToolArt', () => {
  it('maps the five solvent choice ids to image urls', () => {
    expect(Object.keys(SOLVENT_CHOICE_ART).sort()).toEqual(['magnet', 'marble-cube', 'red-blue', 'screen', 'water-filter'])
    for (const id of Object.keys(SOLVENT_CHOICE_ART)) expect(choiceArt(id)).toBeTruthy()
  })

  it('returns no url for unmapped or missing ids', () => {
    expect(choiceArt('unknown')).toBeUndefined()
    expect(choiceArt(null)).toBeUndefined()
    expect(choiceArt(undefined)).toBeUndefined()
  })
})
