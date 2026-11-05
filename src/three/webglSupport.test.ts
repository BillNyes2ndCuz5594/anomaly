import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('WebGL2 availability probe', () => {
  it('reports unavailable without constructing a Three renderer', async () => {
    const createElement = vi.fn(() => ({ getContext: () => null }))
    vi.stubGlobal('document', { createElement })
    const { webGL2Supported } = await import('./recovery')
    expect(webGL2Supported()).toBe(false)
    expect(webGL2Supported()).toBe(false)
    expect(createElement).toHaveBeenCalledTimes(1)
  })

  it('releases a successful probe and caches the result', async () => {
    const loseContext = vi.fn()
    const getExtension = vi.fn(() => ({ loseContext }))
    const createElement = vi.fn(() => ({ getContext: () => ({ getExtension }) }))
    vi.stubGlobal('document', { createElement })
    const { webGL2Supported } = await import('./recovery')
    expect(webGL2Supported()).toBe(true)
    expect(webGL2Supported()).toBe(true)
    expect(createElement).toHaveBeenCalledTimes(1)
    expect(getExtension).toHaveBeenCalledWith('WEBGL_lose_context')
    expect(loseContext).toHaveBeenCalledTimes(1)
  })

  it('allows WebGPU without requiring a WebGL2 context', async () => {
    vi.stubGlobal('navigator', { gpu: {} })
    const createElement = vi.fn()
    vi.stubGlobal('document', { createElement })
    const { canInitializeRenderer } = await import('./recovery')
    expect(canInitializeRenderer(false)).toBe(true)
    expect(createElement).not.toHaveBeenCalled()
  })
})
