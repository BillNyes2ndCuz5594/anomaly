import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ModeMedia, { canPlayModeVideo } from './ModeMedia'
import { checkModeAssetExists, CONTAINMENT_ASSETS, REACTOR_ASSETS, resolvePublicAsset } from './modeAssets'

// oxlint-disable-next-line typescript/no-explicit-any -- test DOM helper
function setupMockDom() {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; (globalThis as any).window = globalThis
  ;(globalThis as any).window.location = new URL('http://localhost')
  ;(globalThis as any).window.addEventListener = () => {}; (globalThis as any).window.removeEventListener = () => {}
  ;(globalThis as any).requestAnimationFrame = (fn: any) => setTimeout(fn, 16); (globalThis as any).cancelAnimationFrame = (id: any) => clearTimeout(id)
  ;(globalThis as any).HTMLIFrameElement = class {}
  // oxlint-disable-next-line typescript/no-explicit-any
  const doc: any = {
    nodeType: 9,
    activeElement: null,
    createElement(tag: string) {
      // oxlint-disable-next-line typescript/no-explicit-any
      const el: any = {
        nodeType: 1, tagName: tag.toUpperCase(), nodeName: tag.toUpperCase(), style: {}, attributes: {} as Record<string, string>,
        children: [] as any[], parentNode: null, ownerDocument: doc, _tc: '',
        get textContent() { return this._tc || this.children.map((c: any) => c.textContent ?? c.nodeValue ?? '').join('') },
        set textContent(v: string) { this._tc = String(v); this.children = [] },
        setAttribute(k: string, v: unknown) { this.attributes[k] = String(v) },
        getAttribute(k: string) { return this.attributes[k] ?? null },
        removeAttribute(k: string) { delete this.attributes[k] },
        addEventListener(t: string, fn: any) { this._l = this._l || {}; (this._l[t] = this._l[t] || []).push(fn) },
        removeEventListener() {},
        appendChild(c: any) { this.children.push(c); c.parentNode = this; return c },
        removeChild(c: any) { this.children = this.children.filter((x: any) => x !== c); return c },
        insertBefore(c: any) { this.children.push(c); return c },
      }
      return el
    },
    createElementNS(_ns: string, tag: string) { return this.createElement(tag) },
    createComment: () => ({ nodeType: 8 }),
    createTextNode: (t: string) => ({ nodeType: 3, nodeValue: t, textContent: t }),
    addEventListener(t: string, fn: any) { this._l = this._l || {}; (this._l[t] = this._l[t] || []).push(fn) },
    removeEventListener() {},
  }
  doc.defaultView = globalThis; globalThis.document = doc
  const container = doc.createElement('div')
  const root = createRoot(container)
  return {
    container,
    root,
    unmount: () => act(() => root.unmount()),
  }
}

describe('modeAssets', () => {
  it('resolves assets with base URL', () => {
    expect(resolvePublicAsset('art/test.webp')).toContain('art/test.webp')
    expect(CONTAINMENT_ASSETS.title).toContain('containment-title.webp')
    expect(REACTOR_ASSETS.title).toContain('reactor-title.webp')
  })

  it('checks mode asset existence correctly', () => {
    expect(checkModeAssetExists('art/modes/containment-title.webp')).toBe(true)
    expect(checkModeAssetExists('art/modes/nonexistent-mode-asset-xyz.webp')).toBe(false)
    expect(checkModeAssetExists('fonts/AtkinsonHyperlegible-Regular.woff2')).toBe(true)
  })
})

describe('canPlayModeVideo', () => {
  it('allows video only in full motion and when still is false', () => {
    expect(canPlayModeVideo('full', false)).toBe(true)
    expect(canPlayModeVideo('full', true)).toBe(false)
    expect(canPlayModeVideo('fade', false)).toBe(false)
    expect(canPlayModeVideo('fade', true)).toBe(false)
    expect(canPlayModeVideo('still', false)).toBe(false)
    expect(canPlayModeVideo('still', true)).toBe(false)
  })
})

describe('ModeMedia component', () => {
  it('renders video element in full motion without still', () => {
    const html = renderToStaticMarkup(
      createElement(ModeMedia, {
        titlePoster: CONTAINMENT_ASSETS.title,
        introWebm: CONTAINMENT_ASSETS.introWebm,
        introMp4: CONTAINMENT_ASSETS.introMp4,
        motion: 'full',
        still: false,
      })
    )
    expect(html).toContain('<video')
    expect(html).toContain('Skip')
    expect(html).toContain('containment-intro.webm')
    expect(html).toContain('containment-intro.mp4')
  })

  it('renders poster in fade motion mode', () => {
    const html = renderToStaticMarkup(
      createElement(ModeMedia, {
        titlePoster: CONTAINMENT_ASSETS.title,
        introWebm: CONTAINMENT_ASSETS.introWebm,
        introMp4: CONTAINMENT_ASSETS.introMp4,
        motion: 'fade',
        still: false,
      })
    )
    expect(html).not.toContain('<video')
    expect(html).toContain('<img')
    expect(html).toContain('containment-title.webp')
    expect(html).toContain('alt=""')
  })

  it('renders poster in still motion mode or with still=true', () => {
    const htmlStillMode = renderToStaticMarkup(
      createElement(ModeMedia, {
        titlePoster: CONTAINMENT_ASSETS.title,
        introWebm: CONTAINMENT_ASSETS.introWebm,
        introMp4: CONTAINMENT_ASSETS.introMp4,
        motion: 'still',
        still: false,
      })
    )
    expect(htmlStillMode).not.toContain('<video')
    expect(htmlStillMode).toContain('<img')

    const htmlStillFlag = renderToStaticMarkup(
      createElement(ModeMedia, {
        titlePoster: CONTAINMENT_ASSETS.title,
        introWebm: CONTAINMENT_ASSETS.introWebm,
        introMp4: CONTAINMENT_ASSETS.introMp4,
        motion: 'full',
        still: true,
      })
    )
    expect(htmlStillFlag).not.toContain('<video')
    expect(htmlStillFlag).toContain('<img')
  })

  it('renders poster when skipIntro is true (e.g. on resume)', () => {
    const html = renderToStaticMarkup(
      createElement(ModeMedia, {
        titlePoster: REACTOR_ASSETS.title,
        introWebm: REACTOR_ASSETS.introWebm,
        introMp4: REACTOR_ASSETS.introMp4,
        motion: 'full',
        still: false,
        skipIntro: true,
      })
    )
    expect(html).not.toContain('<video')
    expect(html).toContain('<img')
    expect(html).toContain('reactor-title.webp')
  })
})

describe('ModeMedia interaction tests', () => {
  beforeEach(() => {
    ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('allows the second format to succeed when the first source fails', () => {
    const dom = setupMockDom()
    let introEnded = false
    act(() => {
      dom.root.render(
        createElement(ModeMedia, {
          titlePoster: CONTAINMENT_ASSETS.title,
          introWebm: CONTAINMENT_ASSETS.introWebm,
          introMp4: CONTAINMENT_ASSETS.introMp4,
          motion: 'full',
          still: false,
          onIntroEnd: () => { introEnded = true },
        })
      )
    })

    const videoWrap = dom.container.children[0].children[0]
    const video = videoWrap.children[0]
    expect(video.tagName).toBe('VIDEO')
    const sources = video.children.filter((c: any) => c.tagName === 'SOURCE')
    expect(sources).toHaveLength(2)
    expect(sources[0].attributes.src).toBe(CONTAINMENT_ASSETS.introWebm)
    expect(sources[1].attributes.src).toBe(CONTAINMENT_ASSETS.introMp4)

    // Simulate failure on the first source (webm)
    act(() => {
      sources[0]._l?.error?.forEach((fn: any) => fn({ type: 'error' }))
    })

    // Video is still mounted, second source remains available, onIntroEnd not triggered yet
    expect(introEnded).toBe(false)
    const remainingVideoWrap = dom.container.children[0].children[0]
    expect(remainingVideoWrap.children[0].tagName).toBe('VIDEO')

    dom.unmount()
  })

  it('triggers poster fallback when both sources fail', () => {
    const dom = setupMockDom()
    let introEnded = false
    act(() => {
      dom.root.render(
        createElement(ModeMedia, {
          titlePoster: CONTAINMENT_ASSETS.title,
          introWebm: CONTAINMENT_ASSETS.introWebm,
          introMp4: CONTAINMENT_ASSETS.introMp4,
          motion: 'full',
          still: false,
          onIntroEnd: () => { introEnded = true },
        })
      )
    })

    const videoWrap = dom.container.children[0].children[0]
    const video = videoWrap.children[0]
    const sources = video.children.filter((c: any) => c.tagName === 'SOURCE')

    // First source fails
    act(() => {
      sources[0]._l?.error?.forEach((fn: any) => fn({ type: 'error' }))
    })
    expect(introEnded).toBe(false)

    // Second source fails
    act(() => {
      sources[1]._l?.error?.forEach((fn: any) => fn({ type: 'error', target: sources[1], currentTarget: sources[1] }))
    })

    // Fallback triggered: video unmounted, poster img rendered, onIntroEnd fired
    expect(introEnded).toBe(true)
    const posterImg = dom.container.children[0].children[0]
    expect(posterImg.tagName).toBe('IMG')
    expect(posterImg.attributes.src).toBe(CONTAINMENT_ASSETS.title)

    dom.unmount()
  })
})
