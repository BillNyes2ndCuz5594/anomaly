import { describe, expect, it } from 'vitest'
import {
  STAMP_MIN_FONT,
  STAMP_PHRASES,
  debriefLine,
  fitStampFont,
  rotatedOverhang,
  stampBoxFits,
  stampInsidePanel,
  stampPhraseEm,
  verdictPhrase,
  verdictWord,
} from './resultsDebrief'

const WIDTHS = [240, 280, 316, 360, 480, 700, 800, 1100, 1400, 1800]

describe('fitStampFont', () => {
  it('keeps every stamp phrase inside the phone, tablet, and desktop content boxes', () => {
    for (const phrase of STAMP_PHRASES) {
      for (const inner of WIDTHS) {
        const fit = fitStampFont(inner, phrase)
        expect(fit.fontPx).toBeGreaterThanOrEqual(STAMP_MIN_FONT)
        expect(fit.fontPx).toBeLessThanOrEqual(26)
        expect(fit.widthPx).toBeLessThanOrEqual(inner)
        expect(fit.oneLine).toBe(true)
      }
    }
  })

  it('shrinks the longest phrase before it grows the box', () => {
    const wide = fitStampFont(1400, 'CASE STILL OPEN')
    const phone = fitStampFont(280, 'CASE STILL OPEN')
    expect(phone.fontPx).toBeLessThan(wide.fontPx)
    expect(phone.widthPx).toBeLessThanOrEqual(280)
  })

  it('overestimates capitals so a late font swap still has slack', () => {
    expect(stampPhraseEm('CASE', 0)).toBeGreaterThan(3.2)
  })
})

describe('stampBoxFits', () => {
  it('holds a static tilt inside the inset, at every audit width', () => {
    for (const inner of WIDTHS) {
      const layoutWidth = inner - 28
      for (const height of [44, 72, 120]) {
        expect(stampBoxFits(inner, layoutWidth, height)).toBe(true)
        expect(rotatedOverhang(layoutWidth, height)).toBeLessThan(14)
      }
    }
  })

  it('rejects a stamp wider than the panel', () => {
    expect(stampBoxFits(300, 340, 48)).toBe(false)
  })
})

describe('stampInsidePanel', () => {
  it('allows a pixel of slack and fails a real spill', () => {
    expect(stampInsidePanel({ left: 8, right: 352 }, { left: 8, right: 352 })).toBe(true)
    expect(stampInsidePanel({ left: 6, right: 360 }, { left: 8, right: 352 })).toBe(false)
  })
})

describe('verdict copy', () => {
  it('uses the closed, open, and cold phrases without new wording', () => {
    expect(verdictPhrase(true, false)).toBe('CASE CLOSED')
    expect(verdictPhrase(true, true)).toBe('RESIDUE CLEARED')
    expect(verdictPhrase(false, false)).toBe('CASE STILL OPEN')
    expect(verdictWord(true, true)).toBe('Residue cleared')
    expect(verdictWord(false, true)).toBe('Case still open')
    expect(debriefLine(true, false, 'Closed line.', 'Open line.')).toBe('Closed line.')
    expect(debriefLine(false, true, 'Closed line.', 'Open line.')).toBe('Open line.')
    expect(debriefLine(false, false, 'Closed line.', 'Open line.')).toBe('CASE STILL OPEN. It returns as a cold case soon.')
  })
})
