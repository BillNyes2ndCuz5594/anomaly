export interface CarryBox {
  left: number
  top: number
}

const memory = new Map<string, CarryBox>()

export function resetCarry(): void {
  memory.clear()
}

export function carryForget(sel: string): void {
  memory.delete(sel)
}

/**
 * Pixel delta that slides `sel` from its previous rect to `next`.
 * Large jumps are dropped so a panel never flies across the 3D frame.
 * Returns null when there is nothing to play.
 */
export function carryDelta(sel: string, next: CarryBox, limit: number, enabled: boolean): { x: number; y: number } | null {
  const prev = memory.get(sel)
  memory.set(sel, { left: next.left, top: next.top })
  if (!enabled || !prev) return null
  const x = prev.left - next.left
  const y = prev.top - next.top
  if (Math.abs(x) < 1.5 && Math.abs(y) < 1.5) return null
  if (Math.abs(x) > limit || Math.abs(y) > limit) return null
  return { x, y }
}
