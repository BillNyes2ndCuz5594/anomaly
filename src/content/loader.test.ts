import { describe, expect, it, vi } from 'vitest'

describe('lazy pack loader', () => {
  it('keeps items out until requested and shares concurrent imports', async () => {
    vi.resetModules()
    const { content, loadPack, baseContent, packLoaded, itemsById, loadAllPacks, PACK_ORDER } = await import('.')
    expect(content.items).toEqual(baseContent.items)
    expect(packLoaded('00-1')).toBe(false)
    const pending = loadPack('00-1')
    expect(loadPack('00-1')).toBe(pending)
    await pending
    expect(packLoaded('00-1')).toBe(true)
    const count = content.items.length
    expect(count).toBeGreaterThan(baseContent.items.length)
    await loadPack('00-1')
    expect(content.items).toHaveLength(count)
    for (const item of content.items) expect(itemsById.get(item.id)).toBe(item)
    await loadAllPacks()
    expect(PACK_ORDER.every(packLoaded)).toBe(true)
    expect(new Set(content.items.map((i) => i.id)).size).toBe(content.items.length)
  })

  it('accepts the base case and rejects missing packs', async () => {
    const { loadPack } = await import('.')
    await expect(loadPack('03-1')).resolves.toBeUndefined()
    await expect(loadPack('missing')).rejects.toThrow('Unknown case pack missing')
  })

  it('rejects partial session pools, then selects pack evidence and complete cold reviews', async () => {
    vi.resetModules()
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} })
    try {
      const { useSession } = await import('../state/session')
      const { loadPack, loadAllPacks, content } = await import('.')
      expect(() => useSession.getState().start('00-1')).toThrow('Session content is not loaded')
      expect(useSession.getState().items).toEqual([])
      await loadPack('00-1')
      useSession.getState().start('00-1')
      expect(useSession.getState().items).toHaveLength(5)
      expect(() => useSession.getState().start('cold-1', 'cold')).toThrow('Session content is not loaded')
      await loadAllPacks()
      useSession.getState().start('cold-1', 'cold')
      expect(useSession.getState().items).toHaveLength(4)
      expect(useSession.getState().items.every((item) => content.items.includes(item) && item.pool === 'cold')).toBe(true)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('waits for all packs before using QA items from another case', async () => {
    vi.resetModules()
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} })
    vi.stubGlobal('window', { location: { search: '?qaitems=N1.1-01,L14.1x-01' } })
    try {
      const { useSession } = await import('../state/session')
      const { loadAllPacks } = await import('.')
      expect(() => useSession.getState().start('03-1')).toThrow('Session content is not loaded')
      await loadAllPacks()
      useSession.getState().start('03-1')
      expect(useSession.getState().items.map((item) => item.id)).toEqual(['N1.1-01', 'L14.1x-01'])
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
