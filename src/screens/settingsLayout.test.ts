import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('./settings.css', import.meta.url), 'utf8')

describe('settings layout and scroll', () => {
  it('scrolls the settings area with a visible thin scrollbar', () => {
    expect(css).toContain('.settings-scroll-area')
    expect(css).toContain('overflow-y: auto')
    expect(css).toContain('scrollbar-width: thin')
    expect(css).toContain('scrollbar-color:')
  })

  it('lays out Reading, Display, and Sound in 3 columns at width >= 1200px', () => {
    expect(css).toMatch(/@media[^{]*min-width:\s*1200px/)
    expect(css).toContain('repeat(3, minmax(0, 1fr))')
  })

  it('keeps clean typography without dash characters', () => {
    expect(css).not.toMatch(/[\u2013\u2014]/)
  })
})
