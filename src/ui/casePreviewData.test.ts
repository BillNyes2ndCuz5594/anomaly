import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PreviewMedia } from './CasePreview'
import { activeTarget, isPreviewTarget, mediaKind, placePreview, PREVIEW_H, PREVIEW_TARGETS, PREVIEW_W } from './casePreviewData'

describe('case preview media by motion mode', () => {
  it('only full motion plays a video', () => {
    expect(mediaKind('full')).toBe('video')
    expect(mediaKind('fade')).toBe('poster')
    expect(mediaKind('still')).toBe('poster')
  })

  it('mounts a video in full and never in fade or still', () => {
    for (const clip of ['cells', 'frost', 'creek'] as const) {
      expect(renderToStaticMarkup(createElement(PreviewMedia, { clip, mode: 'full' }))).toContain('<video')
      for (const mode of ['fade', 'still'] as const) {
        const html = renderToStaticMarkup(createElement(PreviewMedia, { clip, mode }))
        expect(html).not.toContain('<video')
        expect(html).toContain('<img')
        expect(html).toContain('.webp')
      }
    }
  })
})

describe('case preview targets', () => {
  it('maps the hub cards to their loops', () => {
    expect(PREVIEW_TARGETS['case-marker-03-1']).toBe('cells')
    expect(PREVIEW_TARGETS['case-marker-02-2']).toBe('creek')
    expect(PREVIEW_TARGETS['cold-marker']).toBe('frost')
    expect(isPreviewTarget('cold-marker')).toBe(true)
    expect(isPreviewTarget('case-marker-02-2')).toBe(true)
    expect(isPreviewTarget('open-settings')).toBe(false)
    expect(isPreviewTarget('toString')).toBe(false)
    expect(isPreviewTarget(undefined)).toBe(false)
  })

  it('nothing hovered or focused means nothing mounted; hover beats focus', () => {
    expect(activeTarget({ hover: null, focus: null })).toBeNull()
    expect(activeTarget({ hover: null, focus: 'cold-marker' })).toBe('cold-marker')
    expect(activeTarget({ hover: 'case-marker-03-1', focus: 'cold-marker' })).toBe('case-marker-03-1')
  })
})

describe('case preview placement', () => {
  it('sits left of the card with room, centered on it', () => {
    const p = placePreview({ left: 600, top: 300, right: 900, bottom: 348 }, 1200, 800)
    expect(p.left).toBe(600 - 12 - PREVIEW_W)
    expect(p.top).toBe(324 - PREVIEW_H / 2)
  })

  it('goes above the card on a narrow screen and stays inside the viewport', () => {
    const p = placePreview({ left: 12, top: 400, right: 360, bottom: 448 }, 375, 700)
    expect(p.top).toBe(400 - 12 - PREVIEW_H)
    expect(p.left).toBeGreaterThanOrEqual(8)
    expect(p.left + PREVIEW_W).toBeLessThanOrEqual(375 - 8)
    const top = placePreview({ left: 12, top: 20, right: 360, bottom: 68 }, 375, 700)
    expect(top.top).toBeGreaterThanOrEqual(8)
  })
})
