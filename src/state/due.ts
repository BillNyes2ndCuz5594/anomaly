import { content } from '../content/schema'
import { anyReviewDue } from '../lib/scheduler'
import { toISODate } from './mastery'
import { useGame } from './store'

/** True when a spaced review is due today. The cold case is always playable regardless. */
export function useReviewDue(): boolean {
  return useGame((s) => anyReviewDue(content.items, s.progress, toISODate()))
}
