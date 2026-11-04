/** Synchronous admission, independent of React rendering. No timers to leak on unmount. */
export function createTapGuard() {
  const until = new Map<string, number>()
  return (key: string, ms: number, now = performance.now()): boolean => {
    if (now < (until.get(key) ?? -Infinity)) return false
    until.set(key, now + ms)
    return true
  }
}
