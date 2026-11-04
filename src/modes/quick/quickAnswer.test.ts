import { describe, expect, it } from 'vitest'
import raw from '../../content/packs/02-2.json'
import type { Item } from '../../content/schema'
import { gradeChoice } from '../../lib/rkea'
import { createQuickAnswer } from './quickAnswer'

describe('quick grading on real Unit 4 items', () => {
  it('grades every choice with the shared ItemPlayer logic and reports elapsed time', () => {
    for (const item of raw.items as Item[]) {
      for (let picked = 0; picked < 4; picked++) {
        let now = 100
        const submit = createQuickAnswer(item, () => now)
        now = 850
        expect(submit(picked)).toEqual({ itemId: item.id, correct: picked === item.key, ms: 750 })
        expect(gradeChoice(item, picked)).toBe(picked === item.key)
        expect(submit(item.key)).toBeNull()
        now = 5000
        expect(submit(item.key)).toBeNull()
      }
    }
  })
  it('ignores invalid choices and admits only one rapid tap across different choices', () => {
    const item = raw.items[0] as Item
    const submit = createQuickAnswer(item, () => 100)
    for (const picked of [-1, 4, NaN, 0.5]) expect(submit(picked)).toBeNull()
    expect(submit(item.key)?.correct).toBe(true)
    expect(submit((item.key + 1) % 4)).toBeNull()
    expect(createQuickAnswer(item, () => 100)(item.key)?.ms).toBe(0)
  })
})
