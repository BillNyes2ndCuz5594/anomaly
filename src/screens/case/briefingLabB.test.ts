import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('./briefing-labb.css', import.meta.url), 'utf8')

describe('briefing and lab B sheet', () => {
  it('keeps 44px targets, press feedback, and whole words', () => {
    expect(css).toContain('min-height: 44px')
    expect(css).toContain("data-pressed='true'")
    expect(css).toContain('overflow-wrap: break-word')
    expect(css).toContain('word-break: normal')
    expect(css).toMatch(/@media \(hover: hover\) and \(pointer: fine\)/)
    expect(css).not.toMatch(/[\u2013\u2014]/)
  })

  it('only restyles the briefing card and lab B', () => {
    expect(css).toContain('.briefing-screen')
    expect(css).toContain('.labb-screen')
    expect(css).not.toContain('lab-a')
    expect(css).not.toContain('lab-c')
    expect(css).not.toContain('.organ-btn')
  })

  it('gives the phone briefing room for the last line, and lifts the lab B sheet with the dock', () => {
    expect(css).toContain('max-height: 64dvh')
    expect(css).toContain('--sheet-h: 56dvh')
    expect(css).toContain('position: static')
    expect(css).toContain('order: 0')
  })
})
