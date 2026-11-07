/**
 * Synchronous admission helper to prevent duplicate loads while an async
 * operation is in flight, clearing immediately when it settles.
 */
export function createLoadGate() {
  const pending = new Set<string>()

  return {
    isBusy(key: string): boolean {
      return pending.has(key)
    },
    admit(key: string): boolean {
      if (pending.has(key)) return false
      pending.add(key)
      return true
    },
    settle(key: string): void {
      pending.delete(key)
    },
    clear(): void {
      pending.clear()
    },
  }
}

export const sharedLoadGate = createLoadGate()

