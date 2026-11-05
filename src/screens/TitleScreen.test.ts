import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { content } from '../content'
import { useGame } from '../state/store'
import { playLabel } from './startFlow'
import TitleScreen from './TitleScreen'

const motion = vi.hoisted(() => ({ mode: 'full' }))
vi.mock('../ui/useMotionMode', () => ({ useMotionMode: () => motion.mode }))
vi.mock('../state/store', async (original) => {
  const actual = await original<typeof import('../state/store')>()
  const store = actual.useGame
  return { ...actual, useGame: Object.assign((select: (s: ReturnType<typeof store.getState>) => unknown) => select(store.getState()), store) }
})

const initial = useGame.getState()
afterEach(() => { useGame.setState(initial); motion.mode = 'full' })

describe('fresh title', () => {
  it.each(['04-1', '02-2', '05-1'])('keeps the remembered %s Play label and existing actions', (id) => {
    useGame.setState({ lastCaseId: id, profile: null })
    const html = renderToStaticMarkup(createElement(TitleScreen)).replaceAll("&#x27;", "'")
    const chosen = content.cases.find((c) => c.id === id)!
    expect(html).toContain('data-testid="title-hook"')
    expect(html).toContain('Weird clues are popping up across Florida. Your science team needs you.')
    expect(html).toContain(playLabel(chosen))
    expect(html).toContain('Solve science mysteries.')
    const buttons = [...html.matchAll(/<button[^>]*>(.*?)<\/button>/gs)].map((m) => m[1])
    expect(buttons).toEqual(['Settings', playLabel(chosen), 'Choose a unit', 'Use a saved code'])
    expect(html).not.toContain('Orlando')
    expect(html).not.toContain('firstrun-modal')
  })

  it.each(['full', 'fade', 'still'])('starts with only a fixed-size decorative poster in %s', (mode) => {
    motion.mode = mode
    const html = renderToStaticMarkup(createElement(TitleScreen)).replaceAll("&#x27;", "'")
    expect(html).toContain('class="title-backdrop" aria-hidden="true"')
    expect(html).toMatch(/backdrop-title\.webp[^>]*width="960" height="540"/)
    expect(html).not.toContain('<video')
    expect(html).not.toMatch(/<source/)
    expect(html).toContain('class="title-scan" aria-hidden="true"')
  })
})
