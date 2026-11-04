/** Pure helper for roving tabindex in the word tagging stem. */

export function nextWordIndex(current: number, key: string, count: number): number {
  if (count <= 0) return 0
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return Math.min(count - 1, current + 1)
    case 'ArrowLeft':
    case 'ArrowUp':
      return Math.max(0, current - 1)
    case 'Home':
      return 0
    case 'End':
      return Math.max(0, count - 1)
    default:
      return current
  }
}
