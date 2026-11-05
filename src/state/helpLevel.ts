export type HelpLevel = 'extra' | 'regular' | 'challenge'

export function normalizeHelpLevel(value: unknown): HelpLevel {
  if (typeof value === 'string') {
    if (value === 'extra' || value === 'regular' || value === 'challenge') {
      return value
    }
  }
  return 'regular'
}

export function helpRules(level: HelpLevel, key: number): { autoStruck: number | null; canEliminate: boolean } {
  if (level === 'extra') {
    const candidates = [0, 1, 2, 3]
    const struckIndex = candidates.find((i) => i !== key) ?? null
    return {
      autoStruck: struckIndex,
      canEliminate: true,
    }
  }
  if (level === 'challenge') {
    return {
      autoStruck: null,
      canEliminate: false,
    }
  }
  return {
    autoStruck: null,
    canEliminate: true,
  }
}
