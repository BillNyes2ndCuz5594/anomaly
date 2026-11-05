export type StartIntent = 'play' | 'browse'

export function startDestination(intent: StartIntent, caseId: string): string {
  return intent === 'play' ? `/case/${caseId}` : '/hub'
}

export function playLabel(c: { unitLabel: string }): string {
  return `Play ${c.unitLabel}`
}

export function shortTopic(unitLabel: string): string {
  const idx = unitLabel.indexOf(': ')
  if (idx !== -1) {
    return unitLabel.slice(idx + 2)
  }
  return unitLabel
}
