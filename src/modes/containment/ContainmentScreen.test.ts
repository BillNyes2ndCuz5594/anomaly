import { act, createElement, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadModeSession, saveModeSession } from '../quick/modeSession'
import { startContainment, validateContainmentSession } from './containment'
import { ContainmentGame, dispatchTurn, getSafeStorage, LaneBoard } from './ContainmentScreen'

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

describe('Containment Rush game logic and screen components', () => {
  beforeEach(() => {
    ;(globalThis as any).window = globalThis; (globalThis as any).window.location = new URL('http://localhost')
    ;(globalThis as any).window.addEventListener = () => {}; (globalThis as any).window.removeEventListener = () => {}
    ;(globalThis as any).requestAnimationFrame = (fn: any) => setTimeout(fn, 16); (globalThis as any).cancelAnimationFrame = (id: any) => clearTimeout(id)
    const store = new Map<string, string>()
    vi.stubGlobal('sessionStorage', {
      getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k), clear: () => void store.clear(),
    })
  })
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

  it('dispatches turns and enforces defense costs', () => {
    let s = dispatchTurn(startContainment('seed-1'), { type: 'answer', correct: true })
    expect(s.phase).toBe('action'); expect(s.resources.charge).toBe(3)
    s = dispatchTurn(s, { type: 'deploy', slot: 1, defense: 'freeze' })
    expect(s.board.some((b) => b.lane === 1 && b.type === 'freeze')).toBe(true)
    s = dispatchTurn(s, { type: 'resolve' })
    expect(s.phase).toBe('resolved')
    s = dispatchTurn(s, { type: 'next' })
    expect(s.phase).toBe('question')
  })

  it('handles multiple keyboard deployments and roving focus in LaneBoard', () => {
    const deployed: number[] = []
    function Harness() {
      const [board, setBoard] = useState<{ lane: number; position: number; type?: string }[]>([])
      return createElement(LaneBoard, {
        board, phase: 'action', selectedDefense: 'magnet', charge: 3,
        onDeploy: (lane) => { deployed.push(lane); setBoard((b) => [...b, { lane, position: 0, type: 'magnet' }]) },
      })
    }
    const dom = setupMockDom()
    act(() => { dom.root.render(createElement(Harness)) })
    const buttons = dom.container.children[0].children[0].children
    expect(buttons).toHaveLength(3)
    expect(buttons[0].getAttribute('tabindex')).toBe('0')
    expect(buttons[0].getAttribute('aria-disabled')).toBe('false')

    dom.fire('keydown', buttons[0], { key: 'Enter' })
    expect(deployed).toEqual([0])
    expect(buttons[0].getAttribute('aria-disabled')).toBe('true')
    expect(buttons[1].getAttribute('tabindex')).toBe('0')
    expect(buttons[1].getAttribute('aria-disabled')).toBe('false')

    dom.fire('keydown', buttons[1], { key: ' ' })
    expect(deployed).toEqual([0, 1])
    expect(buttons[2].getAttribute('tabindex')).toBe('0')

    dom.fire('keydown', buttons[2], { key: 'ArrowLeft' })
    dom.unmount()
  })

  it('persists initial session immediately so reload preserves the run', () => {
    const dom = setupMockDom()
    act(() => { dom.root.render(createElement(ContainmentGame, { caseId: '02-2' })) })
    const saved = loadModeSession(sessionStorage, 'containment', '02-2', validateContainmentSession)
    expect(saved?.questionIndex).toBe(0)
    dom.unmount()

    const dom2 = setupMockDom()
    act(() => { dom2.root.render(createElement(ContainmentGame, { caseId: '02-2' })) })
    const savedAfterReload = loadModeSession(sessionStorage, 'containment', '02-2', validateContainmentSession)
    expect(savedAfterReload?.seed).toBe(saved?.seed)
    dom2.unmount()
  })

  it('guards throwing storage getter safely without crashing', () => {
    Object.defineProperty(window, 'sessionStorage', {
      get() { throw new DOMException('Access denied', 'SecurityError') }, configurable: true,
    })
    expect(getSafeStorage()).toBeNull()
    const dom = setupMockDom()
    expect(() => { act(() => { dom.root.render(createElement(ContainmentGame, { caseId: '02-2' })) }) }).not.toThrow()
    dom.unmount()
  })

  it('preserves answered feedback and allows explicit continuation', () => {
    const dom = setupMockDom()
    act(() => { dom.root.render(createElement(ContainmentGame, { caseId: '02-2' })) })
    const optionBtn = findByClass(dom.container, 'quick-option')
    dom.fire('click', optionBtn)

    const contBtn = findByClass(dom.container, 'containment-continue-btn')
    expect(contBtn.textContent).toContain('Continue to deployment')

    dom.fire('click', contBtn)
    const deployGroup = findByClass(dom.container, 'containment-deploy-group')
    expect(deployGroup.getAttribute('role')).toBe('group')
    dom.unmount()
  })

  it('renders restored feedback for reloaded answered questions', () => {
    const s = { ...startContainment('restore-seed'), phase: 'action', feedback: { itemId: 'E6.1-01', correct: true, explanation: 'Evidence observed.' } }
    saveModeSession(sessionStorage, 'containment', '02-2', s)
    const dom = setupMockDom()
    act(() => { dom.root.render(createElement(ContainmentGame, { caseId: '02-2' })) })
    const panel = dom.container.children[0].children[0].children[1]
    expect(panel.getAttribute('aria-label')).toBe('Restored question feedback')
    dom.unmount()
  })
})
