import magnet from '../../assets/labtools/solvent-choice-magnet.webp'
import sieve from '../../assets/labtools/solvent-choice-sieve.webp'
import filter from '../../assets/labtools/solvent-choice-filter.webp'
import beads from '../../assets/labtools/solvent-choice-beads.webp'
import marbles from '../../assets/labtools/solvent-choice-marbles.webp'

export const SOLVENT_CHOICE_ART: Record<string, string> = {
  magnet,
  screen: sieve,
  'water-filter': filter,
  'red-blue': beads,
  'marble-cube': marbles,
}

export function choiceArt(id: string | null | undefined): string | undefined {
  return id ? SOLVENT_CHOICE_ART[id] : undefined
}
