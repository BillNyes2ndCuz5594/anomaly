import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, expect, it, vi } from 'vitest'
import GoldRushButton from './GoldRushButton'

afterEach(() => vi.unstubAllGlobals())

it('renders a Gold Rush launch only for supported cases and navigates on click', () => {
  const markup = renderToStaticMarkup(createElement(GoldRushButton, { caseId: '02-2' }))
  expect(markup).toContain('<span>Gold Rush</span>')
  expect(markup).toContain('Optional question practice with a different play style.')
  expect(renderToStaticMarkup(createElement(GoldRushButton, { caseId: '03-1' }))).toBe('')
  const location = { hash: '#/hub' }
  vi.stubGlobal('window', { location })
  const button = GoldRushButton({ caseId: '02-2' })!
  button.props.onClick()
  expect(location.hash).toBe('#/gold/02-2')
})
