import { describe, expect, it } from 'vitest'
import { modalTabStops } from './modalFocus'

function control(type = 'button', checked = false, name = '', disabled = false, tabIndex = 0) {
  return {
    type, checked, name, tabIndex, form: null,
    hasAttribute: (attr: string) => attr === 'disabled' && disabled,
    matches: (selector: string) => selector === 'input[type="radio"]' && type === 'radio',
  } as unknown as HTMLElement
}

describe('modal Tab boundaries', () => {
  it.each([0, 1, 2])('uses selected radio %i as the first stop, not unchecked Extra help', (selected) => {
    const radios = [0, 1, 2].map((i) => control('radio', i === selected, 'help'))
    const textSize = control('select')
    const done = control()
    expect(modalTabStops([...radios, textSize, done])).toEqual([radios[selected], textSize, done])
  })

  it('keeps groups separate and ignores disabled and negative tabindex controls', () => {
    const first = control('radio', false, 'help')
    const second = control('radio', true, 'sound')
    const unnamed = control('radio')
    expect(modalTabStops([
      control('radio', true, 'help', true), first, control('radio', false, 'help'),
      second, unnamed, control('button', false, '', false, -1),
    ])).toEqual([first, second, unnamed])
  })
})
