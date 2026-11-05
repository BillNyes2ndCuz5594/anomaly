import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const tsx = readFileSync(new URL('./Briefing.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('./briefing-labb.css', import.meta.url), 'utf8')

describe('Briefing component structure (PR 1)', () => {
  it('narrative region has data-testid="briefing-story", tabIndex={0}, and accessible label', () => {
    expect(tsx).toContain('data-testid="briefing-story"')
    expect(tsx).toContain('tabIndex={0}')
    expect(tsx).toContain('aria-label="Case briefing story"')
    expect(tsx).toContain('role="region"')
    expect(tsx).toContain('onKeyDown')
  })

  it('keeps data-testid="briefing-text" for backward compatibility', () => {
    expect(tsx).toContain('data-testid="briefing-text"')
  })

  it('puts actions in a nonshrinking footer with data-testid="briefing-actions"', () => {
    expect(tsx).toContain('data-testid="briefing-actions"')
    expect(tsx).toMatch(/<footer[^>]*data-testid="briefing-actions"/)
    expect(tsx).toContain('data-testid="read-aloud"')
    expect(tsx).toContain('briefing-continue')
  })

  it('contains no em dashes or en dashes in Briefing source', () => {
    expect(tsx).not.toMatch(/[\u2013\u2014]/)
  })
})

describe('Briefing CSS layout and actions visibility (PR 1)', () => {
  it('makes the briefing panel a bounded flex column', () => {
    expect(css).toContain('.briefing-screen .side-panel.dispatch-card')
    expect(css).toContain('display: flex')
    expect(css).toContain('flex-direction: column')
    expect(css).toContain('overflow: hidden')
    expect(css).toContain('calc(100dvh - var(--bar-h) - 24px)')
  })

  it('gives briefing-story flexible scrolling with min-height: 0', () => {
    expect(css).toContain('.briefing-screen .briefing-story')
    expect(css).toContain('flex: 1 1 auto')
    expect(css).toContain('min-height: 0')
    expect(css).toContain('overflow-y: auto')
  })

  it('gives briefing-actions nonshrinking footer with opaque background and top border', () => {
    expect(css).toContain('.briefing-screen .side-panel.dispatch-card .briefing-actions')
    expect(css).toContain('flex-shrink: 0')
    expect(css).toContain('background: #0b1220')
    expect(css).toContain('border-top: 1px solid rgba(62, 230, 255, 0.25)')
  })

  it('provides focus-visible styling for story and actions', () => {
    expect(css).toContain('.briefing-screen .briefing-story:focus-visible')
    expect(css).toContain('.briefing-screen .briefing-actions .btn:focus-visible')
  })

  it('clamps decorative media height at short heights', () => {
    expect(css).toMatch(/max-height:\s*clamp\(/)
    expect(css).toMatch(/@media[^{]*max-height:\s*800px/)
  })

  it('contains no em dashes or en dashes in CSS', () => {
    expect(css).not.toMatch(/[\u2013\u2014]/)
  })
})
