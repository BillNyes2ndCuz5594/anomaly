import type { Item } from '../../content/schema'
import { gradeChoice } from '../../lib/rkea'
import { createTapGuard } from '../../ui/tapGuard'

export interface QuickAnswer { itemId: string; correct: boolean; ms: number }

/** One synchronous submission latch per displayed question, independent of React. */
export function createQuickAnswer(item: Item, now = () => performance.now()) {
  const started = now()
  const admit = createTapGuard()
  let answered = false
  return (picked: number): QuickAnswer | null => {
    const at = now()
    if (answered || !Number.isInteger(picked) || picked < 0 || picked >= item.options.length || !admit('answer', 450, at)) return null
    answered = true
    return { itemId: item.id, correct: gradeChoice(item, picked), ms: Math.max(0, at - started) }
  }
}

export function keyToOptionIndex(key: string): number | null {
  const k = key.toLowerCase()
  if (k === '1' || k === 'a') return 0
  if (k === '2' || k === 'b') return 1
  if (k === '3' || k === 'c') return 2
  if (k === '4' || k === 'd') return 3
  return null
}

export const quickKeyToIndex = keyToOptionIndex

export function toSentenceCase(text: string): string {
  const s = text.trim()
  if (!s) return ''
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function cleanFeedback(text: string): string {
  let s = text.replace(/\.{2,}/g, '.')
  s = s.replace(/^[✗\u2717]?\s*Incorrect\.\s*/i, 'Not quite. ')
  if (/^✓\s*Correct\./i.test(s)) {
    s = s.replace(/^✓\s*Correct\.\s*Correct answer:\s*[A-D]\.\s*[^.]*\.\s*/i, '✓ Correct. ')
    s = s.replace(/^✓\s*Correct\.\s*Correct:\s*/i, '✓ Correct. ')
    s = s.replace(/\s+Correct:\s*/gi, ' ')
  } else if (/^Not quite\./i.test(s)) {
    s = s.replace(/(Correct answer:[^.]*\.\s*)Correct:\s*/i, '$1')
    s = s.replace(/\s+Correct:\s*/gi, ' ')
  }
  s = s.replace(/(\.\s+)([a-z])/g, (_, p1, p2) => p1 + p2.toUpperCase())
  return s.replace(/\.{2,}/g, '.').replace(/\s+/g, ' ').trim()
}

