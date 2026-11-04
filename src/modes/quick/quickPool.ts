import { caseById } from '../../content'
import type { Item } from '../../content/schema'
import { seeded } from '../../lib/rkea'

interface QuickPoolOptions { caseId: string; count: number; seed: string | number }

/** Current Item schema is single-choice only; labs are separate definitions.
 * Case membership follows the case's benchmark bank, including cold items.
 * Call after loadPack/usePack; this function never loads content itself.
 * Each shuffled bank is exhausted before repeating. Inputs are never mutated.
 */
export function buildQuickPool(items: readonly Item[], { caseId, count, seed }: QuickPoolOptions): Item[] {
  const benchmarks = caseById(caseId)?.benchmarks ?? []
  const bank = [...new Map(items.filter((item) =>
    benchmarks.includes(item.benchmark) && item.options.length === 4 &&
    Number.isInteger(item.key) && item.key >= 0 && item.key < 4,
  ).map((item) => [item.id, item])).values()]
  if (!bank.length || !Number.isSafeInteger(count) || count <= 0) return []
  const result: Item[] = []
  for (let cycle = 0; result.length < count; cycle++) {
    const order = [...bank].sort((a, b) =>
      seeded(`${seed}:${cycle}`, a.id) - seeded(`${seed}:${cycle}`, b.id) || a.id.localeCompare(b.id),
    )
    // Avoid an immediate repeat across bank boundaries when there is a choice.
    if (order.length > 1 && order[0].id === result.at(-1)?.id) [order[0], order[1]] = [order[1], order[0]]
    result.push(...order.slice(0, count - result.length))
  }
  return result
}
