import { seeded } from '../../lib/rkea'

export const GOLD_CASES: ReadonlySet<string> = new Set(['02-2'])

export type Crate = 10 | 20 | 40 | 'double' | 'glitch' | 'swap' | 'steal'
export interface Rival { name: string; intel: number }
export interface GoldRush {
  seed: string; question: number; intel: number; bots: Rival[]
  phase: 'question' | 'crate' | 'next' | 'done'; outcome: string
}
export interface GoldReveal {
  index: number
  contents: string
  delta: number
}
export interface GoldSession {
  game: GoldRush
  reveal: GoldReveal | null
}
const table: readonly Crate[] = [10, 20, 40, 'double', 'glitch', 'swap', 'steal']
export function startGold(seed: string): GoldRush {
  return { seed, question: 0, intel: 0, phase: 'question', outcome: '', bots:
    ['Quartz Scout', 'Photon Pilot', 'Fossil Finder'].map((name) => ({ name, intel: 0 })) }
}
export function answerGold(s: GoldRush, correct: boolean): GoldRush {
  if (s.phase !== 'question') return s
  return { ...s, phase: correct ? 'crate' : 'next', outcome: correct ? 'Vault unlocked. Pick a crate!' : 'Empty cache. Pick another signal on the grid.',
    bots: s.bots.map((bot, i) => ({ ...bot, intel: bot.intel + Math.floor(seeded(s.seed, `bot:${s.question}:${i}`) * 9) + 2 })) }
}
export function cratesFor(s: GoldRush): Crate[] {
  const choices = table.filter((crate) => crate !== 'swap' || s.bots.some((b) => b.intel > s.intel))
  return Array.from({ length: 3 }, (_, i) => {
    const crate = choices[Math.floor(seeded(s.seed, `crate:${s.question}:${i}`) * choices.length)]
    return (crate === 'double' || crate === 'glitch') && s.intel === 0
      ? ([10, 20, 40] as const)[Math.floor(seeded(s.seed, `number:${s.question}:${i}`) * 3)] : crate
  })
}
export function pickCrate(s: GoldRush, index: number): GoldRush {
  if (s.phase !== 'crate' || !Number.isInteger(index) || index < 0 || index > 2) return s
  return applyCrate(s, cratesFor(s)[index])
}
/** Pure outcome resolver, shared by the seeded picker and rule tests. */
export function applyCrate(s: GoldRush, crate: Crate): GoldRush {
  if (s.phase !== 'crate') return s
  let intel = s.intel
  const bots = s.bots.map((b) => ({ ...b }))
  const rival = bots.reduce((a, b) => b.intel > a.intel ? b : a)
  let resolvedCrate = crate
  if (resolvedCrate === 'glitch' && intel === 0) {
    resolvedCrate = ([10, 20, 40] as const)[Math.floor(seeded(s.seed, `glitch:${s.question}`) * 3)]
  }
  let outcome: string
  if (typeof resolvedCrate === 'number') { intel += resolvedCrate; outcome = `Found ${resolvedCrate} intel!` }
  else if (resolvedCrate === 'double') { intel *= 2; outcome = 'Double intel! Your stash just grew.' }
  else if (resolvedCrate === 'glitch') { intel -= Math.floor(intel * 0.25); outcome = 'Cache trap! A surge drained 25% of your intel.' }
  else if (resolvedCrate === 'swap' && rival.intel > intel) {
    [intel, rival.intel] = [rival.intel, intel]; outcome = `Stash swap with ${rival.name}!`
  } else if (resolvedCrate === 'steal') {
    const eligible = bots.filter((b) => b.intel > 0)
    const victim = (eligible.length > 0 ? eligible : bots).reduce((a, b) => b.intel > a.intel ? b : a)
    const taken = Math.max(1, Math.floor(victim.intel * 0.1))
    intel += taken
    victim.intel = Math.max(0, victim.intel - taken)
    outcome = `Intel intercept! Collected ${taken} from ${victim.name}.`
  } else outcome = 'You already lead the rivals. Keep your stash!'
  return { ...s, intel, bots, phase: 'next', outcome }
}
export function nextGold(s: GoldRush): GoldRush {
  if (s.phase !== 'next') return s
  return { ...s, question: s.question + 1, phase: s.question === 9 ? 'done' : 'question', outcome: '' }
}
export function standings(s: GoldRush): Rival[] {
  return [{ name: 'You', intel: s.intel }, ...s.bots].sort((a, b) => b.intel - a.intel)
}
export function rankOf(board: readonly Rival[], name: string): number {
  const target = board.find((r) => r.name === name)
  if (!target) return board.length + 1
  return board.filter((r) => r.intel > target.intel).length + 1
}

export function goldStorageKey(caseId: string): string {
  return `anomaly:gold:${caseId}`
}

export function loadGoldSession(
  storage: { getItem(k: string): string | null },
  caseId: string,
): GoldSession | null {
  try {
    const raw = storage.getItem(goldStorageKey(caseId))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const g = parsed.game
    if (
      !g ||
      typeof g !== 'object' ||
      typeof g.seed !== 'string' ||
      typeof g.question !== 'number' ||
      typeof g.intel !== 'number' ||
      typeof g.phase !== 'string' ||
      !Array.isArray(g.bots)
    ) {
      return null
    }
    const reveal =
      parsed.reveal &&
      typeof parsed.reveal === 'object' &&
      typeof parsed.reveal.index === 'number' &&
      typeof parsed.reveal.contents === 'string' &&
      typeof parsed.reveal.delta === 'number'
        ? (parsed.reveal as GoldReveal)
        : null
    return { game: g as GoldRush, reveal }
  } catch {
    return null
  }
}

export function saveGoldSession(
  storage: { setItem(k: string, v: string): void },
  caseId: string,
  session: GoldSession,
): void {
  try {
    storage.setItem(goldStorageKey(caseId), JSON.stringify(session))
  } catch {
    // Ignore storage quota or disabled errors
  }
}

export function clearGoldSession(
  storage: { removeItem(k: string): void },
  caseId: string,
): void {
  try {
    storage.removeItem(goldStorageKey(caseId))
  } catch {
    // Ignore errors
  }
}

export function crateLabel(crate: Crate | string | number): string {
  if (typeof crate === 'number' || /^\d+$/.test(String(crate))) {
    return `+${crate} intel!`
  }
  const key = String(crate).toLowerCase()
  switch (key) {
    case 'steal':
      return 'Steal! Took intel from a rival'
    case 'glitch':
      return 'Glitch! Lost some intel'
    case 'swap':
      return 'Swap! Traded scores with a rival'
    case 'double':
      return 'Double! Doubled your intel'
    default:
      return String(crate)
  }
}

export function resolveGoldFocusTarget(
  phase: 'question' | 'crate' | 'next' | 'done',
  refs: {
    firstCrate: { focus: () => void } | null
    nextBtn: { focus: () => void } | null
    results: { focus: () => void } | null
  },
): 'crate' | 'next' | 'done' | null {
  if (phase === 'crate') {
    refs.firstCrate?.focus()
    return 'crate'
  }
  if (phase === 'next') {
    refs.nextBtn?.focus()
    return 'next'
  }
  if (phase === 'done') {
    refs.results?.focus()
    return 'done'
  }
  return null
}
