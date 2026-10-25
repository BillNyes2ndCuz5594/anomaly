import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { blend, contrastRatio } from './contrast'
import { scaleColor } from '../teacher/analysis'

// Panel backgrounds the HUD text sits on, darkest to lightest.
const PANELS = ['#070c17', '#0b1220', '#15233b', '#1b2d4a']
const AA = 4.5

describe('WCAG AA contrast on the navy panels', () => {
  const tokens: Record<string, string> = {
    text: '#e6f1ff',
    muted: '#9db2d1',
    cyan: '#3ee6ff',
    amber: '#ffb547',
    'why text': '#c4d4ec',
    'ok mint': '#5ff2c4',
    'warm orange': '#ffb27d',
    'bad icon orange': '#ff9a5c',
    'error icon': '#ff8a47',
  }
  for (const [name, color] of Object.entries(tokens)) {
    it(`${name} ${color} reads on every panel`, () => {
      for (const bg of PANELS) expect(contrastRatio(color, bg), `${name} on ${bg}`).toBeGreaterThanOrEqual(AA)
    })
  }

  it('struck and dimmed option text stays above AA', () => {
    expect(contrastRatio(blend('#e6f1ff', '#15233b', 0.62), '#15233b')).toBeGreaterThanOrEqual(AA)
  })

  it('every hard coded text color in the HUD stylesheet reads on the lightest panel', () => {
    const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8')
    // Colors used as text on dark buttons or on bright fills are listed here on purpose.
    const onBright = new Set(['#04101c', '#1a1100'])
    const found = [...css.matchAll(/^\s*color:\s*(#[0-9a-f]{6});/gim)].map((m) => m[1].toLowerCase())
    expect(found.length).toBeGreaterThan(5)
    for (const c of found) if (!onBright.has(c)) expect(contrastRatio(c, '#1b2d4a'), c).toBeGreaterThanOrEqual(AA)
  })

  it('dark text on the bright primary buttons reads', () => {
    expect(contrastRatio('#04101c', '#3ee6ff')).toBeGreaterThanOrEqual(AA)
    expect(contrastRatio('#1a1100', '#ffb547')).toBeGreaterThanOrEqual(AA)
  })

  it('teacher heatmap text is readable on every percent', () => {
    for (let p = 0; p <= 100; p++) {
      const c = scaleColor(p)
      expect(contrastRatio(c.fg, c.bg), `${p}%`).toBeGreaterThanOrEqual(AA)
    }
  })
})
