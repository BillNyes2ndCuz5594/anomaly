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
