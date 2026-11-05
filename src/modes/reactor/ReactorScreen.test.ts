import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadModeSession, saveModeSession } from '../quick/modeSession'
import { startReactor, validateReactorSession } from './reactor'
import { dispatchTurn, getSafeLocalStorage, getSafeSessionStorage, ReactorGame, ReactorMeter } from './ReactorScreen'

// oxlint-disable-next-line typescript/no-explicit-any -- test DOM mock
function findByClass(el: any, cls: string): any {
  if (el.attributes?.class?.includes(cls)) return el
  for (const c of el.children || []) { const f = findByClass(c, cls); if (f) return f }
  return null
}

// oxlint-disable-next-line typescript/no-explicit-any -- test DOM mock
function setupMockDom() {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; (globalThis as any).window = globalThis
  ;(globalThis as any).window.location = new URL('http://localhost')
  ;(globalThis as any).window.addEventListener = () => {}; (globalThis as any).window.removeEventListener = () => {}
  ;(globalThis as any).requestAnimationFrame = (fn: any) => setTimeout(fn, 16); (globalThis as any).cancelAnimationFrame = (id: any) => clearTimeout(id)
  ;(globalThis as any).HTMLIFrameElement = class {}
  const doc: any = {
    nodeType: 9, activeElement: null,
    createElement(tag: string) {
      const el: any = {
        nodeType: 1, tagName: tag.toUpperCase(), nodeName: tag.toUpperCase(), style: {}, attributes: {} as Record<string, string>,
        children: [] as any[], parentNode: null, ownerDocument: doc, _tc: '',
        get textContent() { return this._tc || this.children.map((c: any) => c.textContent ?? c.nodeValue ?? '').join('') },
        set textContent(v: string) { this._tc = String(v); this.children = [] },
        setAttribute(k: string, v: unknown) { this.attributes[k] = String(v) },
        getAttribute(k: string) { return this.attributes[k] ?? null }, removeAttribute(k: string) { delete this.attributes[k] },
        addEventListener(t: string, fn: any) { this._l = this._l || {}; (this._l[t] = this._l[t] || []).push(fn) },
        removeEventListener() {}, appendChild(c: any) { this.children.push(c); c.parentNode = this; return c },
        removeChild(c: any) { this.children = this.children.filter((x: any) => x !== c); return c },
        insertBefore(c: any) { this.children.push(c); return c },
        getBoundingClientRect() { return { x: 0, y: 0, width: 100, height: 100, top: 0, right: 100, bottom: 100, left: 0 } },
        focus() { doc.activeElement = this },
      }
      return el
    },
    createElementNS(_ns: string, tag: string) { return this.createElement(tag) },
    createComment: () => ({ nodeType: 8 }), createTextNode: (t: string) => ({ nodeType: 3, nodeValue: t, textContent: t }),
    addEventListener(t: string, fn: any) { this._l = this._l || {}; (this._l[t] = this._l[t] || []).push(fn) },
    removeEventListener() {},
  }
  doc.defaultView = globalThis; globalThis.document = doc
  const container = doc.createElement('div'), root = createRoot(container)
  const fire = (type: string, target: any, props: Record<string, unknown> = {}) => {
    act(() => { container._l?.[type]?.forEach((fn: any) => fn({ type, target, preventDefault() {}, ...props })) })
  }
  return { container, root, fire, unmount: () => act(() => root.unmount()) }
}

describe('Reactor Stabilizer game logic and screen components', () => {
  beforeEach(() => {
    ;(globalThis as any).window = globalThis; (globalThis as any).window.location = new URL('http://localhost')
    ;(globalThis as any).window.addEventListener = () => {}; (globalThis as any).window.removeEventListener = () => {}
    ;(globalThis as any).requestAnimationFrame = (fn: any) => setTimeout(fn, 16); (globalThis as any).cancelAnimationFrame = (id: any) => clearTimeout(id)
    const sessionStore = new Map<string, string>(), localStore = new Map<string, string>()
    vi.stubGlobal('sessionStorage', {
      getItem: (k: string) => sessionStore.get(k) ?? null, setItem: (k: string, v: string) => void sessionStore.set(k, v),
      removeItem: (k: string) => void sessionStore.delete(k), clear: () => void sessionStore.clear(),
    })
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => localStore.get(k) ?? null, setItem: (k: string, v: string) => void localStore.set(k, v),
      removeItem: (k: string) => void localStore.delete(k), clear: () => void localStore.clear(),
    })
  })
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

  it('dispatches reactor turns correctly for answer, pulse, and next', () => {
    let s = dispatchTurn(startReactor('r-seed'), { type: 'answer', correct: true })
    expect(s.phase).toBe('action'); expect(s.resources.instability).toBe(2); expect(s.resources.score).toBe(10)
    s = dispatchTurn(s, { type: 'pulse' })
    expect(s.phase).toBe('resolved'); expect(s.resources.instability).toBe(3)
    s = dispatchTurn(s, { type: 'next' })
    expect(s.phase).toBe('question'); expect(s.questionIndex).toBe(1)
  })

  it('dispatches shield consumption and prevents unneeded pulse damage', () => {
    let s = startReactor('r-seed')
    s = { ...s, phase: 'action', resources: { ...s.resources, shields: 1 } }
    s = dispatchTurn(s, { type: 'shield' })
    expect(s.phase).toBe('resolved'); expect(s.resources.shields).toBe(0)
    expect(s.outcome).toContain('Shield activated')
  })

  it('renders ReactorMeter with correct segments and accessibility attributes', () => {
    const dom = setupMockDom()
    act(() => { dom.root.render(createElement(ReactorMeter, { instability: 6 })) })
    const bar = findByClass(dom.container, 'reactor-meter-bar')
    expect(bar.getAttribute('aria-valuenow')).toBe('6')
    expect(bar.children).toHaveLength(10)
    const activeSegs = bar.children.filter((c: any) => c.attributes?.class?.includes('active'))
    expect(activeSegs).toHaveLength(6)
    dom.unmount()
  })

  it('persists initial session to sessionStorage and handles safe storages', () => {
    const dom = setupMockDom()
    act(() => { dom.root.render(createElement(ReactorGame, { caseId: '02-2' })) })
    const saved = loadModeSession(sessionStorage, 'reactor', '02-2', validateReactorSession)
    expect(saved?.questionIndex).toBe(0)
    dom.unmount()

    Object.defineProperty(window, 'sessionStorage', {
      get() { throw new DOMException('Denied', 'SecurityError') }, configurable: true,
    })
    Object.defineProperty(window, 'localStorage', {
      get() { throw new DOMException('Denied', 'SecurityError') }, configurable: true,
    })
    expect(getSafeSessionStorage()).toBeNull()
    expect(getSafeLocalStorage()).toBeNull()
  })

  it('preserves answer feedback and moves focus to Continue on button and keyboard answer', () => {
    const dom = setupMockDom()
    act(() => { dom.root.render(createElement(ReactorGame, { caseId: '02-2' })) })
    const optionBtn = findByClass(dom.container, 'quick-option')
    dom.fire('click', optionBtn)

    const contBtn = findByClass(dom.container, 'reactor-continue-btn')
    expect(contBtn.textContent).toContain('Continue to core controls')
    expect(globalThis.document.activeElement).toBe(contBtn)
    dom.fire('click', contBtn)

    const actionGroup = findByClass(dom.container, 'reactor-action-group')
    expect(actionGroup.getAttribute('role')).toBe('group')
    dom.unmount()

    const domKb = setupMockDom()
    act(() => { domKb.root.render(createElement(ReactorGame, { caseId: '02-2' })) })
    act(() => {
      const e = { key: '1', defaultPrevented: false, preventDefault() {} }
      // oxlint-disable-next-line typescript/no-explicit-any
      ;((globalThis as any).window._l?.keydown || []).forEach((fn: any) => fn(e))
    })
    const contBtnKb = findByClass(domKb.container, 'reactor-continue-btn')
    expect(contBtnKb.textContent).toContain('Continue to core controls')
    expect(globalThis.document.activeElement).toBe(contBtnKb)
    domKb.unmount()
  })

  it('renders restored feedback for reloaded answered questions', () => {
    const s = {
      ...startReactor('restore-r'), phase: 'action',
      questionsAnswered: 1, correctAnswers: 1,
      feedback: { itemId: 'E6.1-01', correct: true, explanation: 'Core nominal.' },
    }
    saveModeSession(sessionStorage, 'reactor', '02-2', s)
    const dom = setupMockDom()
    act(() => { dom.root.render(createElement(ReactorGame, { caseId: '02-2' })) })
    const panel = findByClass(dom.container, 'quick-panel')
    expect(panel?.getAttribute('aria-label')).toBe('Restored question feedback')
    dom.unmount()
  })

  it('renders resolved sessions without an active question component or shortcuts', () => {
    const s = {
      ...startReactor('restore-resolved'), phase: 'resolved',
      questionsAnswered: 1, correctAnswers: 1,
      feedback: { itemId: 'E6.1-01', correct: true, explanation: 'Core stable.' },
      outcome: 'Shield activated: pulse blocked, core stabilized.',
    }
    saveModeSession(sessionStorage, 'reactor', '02-2', s)
    const dom = setupMockDom()
    act(() => { dom.root.render(createElement(ReactorGame, { caseId: '02-2' })) })
    expect(findByClass(dom.container, 'quick-panel')).toBeNull()
    expect(findByClass(dom.container, 'quick-option')).toBeNull()
    const outcome = findByClass(dom.container, 'reactor-outcome')
    expect(outcome.textContent).toContain('Shield activated')
    // Verify no answer shortcuts are active
    // oxlint-disable-next-line typescript/no-explicit-any
    const kdListeners = (globalThis as any).window._l?.keydown || []
    expect(kdListeners).toHaveLength(0)
    dom.unmount()
  })

  it('renders compact rules and stable meter label', () => {
    const dom = setupMockDom()
    act(() => { dom.root.render(createElement(ReactorMeter, { instability: 3 })) })
    expect(dom.container.textContent).toContain('Stable')
    expect(dom.container.textContent).not.toContain('Nominal')
    dom.unmount()

    const domGame = setupMockDom()
    act(() => { domGame.root.render(createElement(ReactorGame, { caseId: '02-2' })) })
    const rules = findByClass(domGame.container, 'reactor-rules-panel')
    expect(rules).not.toBeNull()
    expect(rules.textContent).toContain('Correct answer lowers instability by 2')
    expect(rules.textContent).toContain('Three consecutive correct answers earn a shield')
    domGame.unmount()
  })
})
