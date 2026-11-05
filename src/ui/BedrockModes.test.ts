import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import BedrockModes, { getLastBedrockMode, resolveBedrockReturnTarget, setLastBedrockMode } from './BedrockModes'

afterEach(() => {
  setLastBedrockMode(null)
  vi.unstubAllGlobals()
})

describe('BedrockModes', () => {
  it('renders only for case 02-2', () => {
    expect(renderToStaticMarkup(createElement(BedrockModes, { caseId: '03-1' }))).toBe('')
    const markup = renderToStaticMarkup(createElement(BedrockModes, { caseId: '02-2' }))
    expect(markup).toContain('More ways to practice')
    expect(markup).toContain('Defenses last one wave.')
    expect(markup).toContain('Correct answer lowers instability by 2.')
    expect(markup).toContain('Gold Rush')
    expect(markup).toContain('Containment Rush')
    expect(markup).toContain('Reactor Stabilizer')
    expect(markup).toContain('data-testid="gold-rush-launch"')
    expect(markup).toContain('data-testid="containment-launch"')
    expect(markup).toContain('data-testid="reactor-launch"')
  })

  it('records last mode and navigates when buttons clicked', () => {
    const location = { hash: '#/hub' }
    vi.stubGlobal('window', { location })
    const tree = BedrockModes({ caseId: '02-2' })!
    const children = tree.props.children[1].props.children as any[]
    // containment button
    children[1].props.onClick()
    expect(getLastBedrockMode()).toBe('containment')
    expect(location.hash).toBe('#/containment/02-2')
    // reactor button
    children[2].props.onClick()
    expect(getLastBedrockMode()).toBe('reactor')
    expect(location.hash).toBe('#/reactor/02-2')
  })

  it('resolves return target to mode launcher or falls back to case marker only for mode return', () => {
    const fakeDoc = {
      querySelector: vi.fn((sel: string) => {
        if (sel === '[data-testid="containment-launch"]') return { id: 'containment-btn' } as any
        if (sel === '[data-testid="case-marker-02-2"]') return { id: 'marker' } as any
        return null
      }),
    } as any

    setLastBedrockMode('containment')
    expect(resolveBedrockReturnTarget(fakeDoc)).toEqual({ id: 'containment-btn' })

    // fallback when mode launcher not found
    fakeDoc.querySelector.mockImplementationOnce(() => null)
    expect(resolveBedrockReturnTarget(fakeDoc)).toEqual({ id: 'marker' })

    // ordinary hub visit without mode return returns null
    setLastBedrockMode(null)
    expect(resolveBedrockReturnTarget(fakeDoc)).toBeNull()
  })
})
