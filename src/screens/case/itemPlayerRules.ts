import { codexById } from '../../content'
import type { Item } from '../../content/schema'

/** Intel values. Accuracy and good process earn Intel, speed never does. */
export const INTEL = { keyWord: 2, eliminate: 1, correct: 5 }

/** Codex entries matched by an item's correct option, e.g. "heart" matches organ:heart. */
export function codexIdsFor(item: Item): string[] {
  const slug = item.options[item.key].toLowerCase().trim().replace(/\s+/g, '-')
  return [`organ:${slug}`, `specimen:${slug}`].filter((id) => codexById.has(id))
}
