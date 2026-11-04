import { seeded } from '../../lib/rkea'

export type Crate = 10 | 20 | 40 | 'double' | 'glitch' | 'swap' | 'steal'
export interface Rival { name: string; intel: number }
export interface GoldRush {
  seed: string; question: number; intel: number; bots: Rival[]
  phase: 'question' | 'crate' | 'next' | 'done'; outcome: string
}
const table: readonly Crate[] = [10, 20, 40, 'double', 'glitch', 'swap', 'steal']
export function startGold(seed: string): GoldRush {
  return { seed, question: 0, intel: 0, phase: 'question', outcome: '', bots:
    ['Quartz Scout', 'Photon Pilot', 'Fossil Finder'].map((name) => ({ name, intel: 0 })) }
}
export function answerGold(s: GoldRush, correct: boolean): GoldRush {
  if (s.phase !== 'question') return s
  return { ...s, phase: correct ? 'crate' : 'next', outcome: correct ? 'Vault unlocked. Pick a crate!' : 'Keep exploring. Another question awaits.',
    bots: s.bots.map((bot, i) => ({ ...bot, intel: bot.intel + Math.floor(seeded(s.seed, `bot:${s.question}:${i}`) * 9) + 2 })) }
}
export function cratesFor(s: GoldRush): Crate[] {
  const choices = table.filter((crate) => crate !== 'swap' || s.bots.some((b) => b.intel > s.intel))
  return Array.from({ length: 3 }, (_, i) => choices[Math.floor(seeded(s.seed, `crate:${s.question}:${i}`) * choices.length)])
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
  let outcome: string
  if (typeof crate === 'number') { intel += crate; outcome = `Found ${crate} intel!` }
  else if (crate === 'double') { intel *= 2; outcome = 'Double intel! Your stash just grew.' }
  else if (crate === 'glitch') { intel -= Math.floor(intel * 0.25); outcome = 'Vault glitch! Lost 25% of your intel. Keep exploring.' }
  else if (crate === 'swap' && rival.intel > intel) {
    [intel, rival.intel] = [rival.intel, intel]; outcome = `Stash swap with ${rival.name}!`
  } else if (crate === 'steal') {
    const taken = Math.floor(rival.intel * 0.1)
    intel += taken; rival.intel -= taken; outcome = `Intel intercept! Collected ${taken} from ${rival.name}.`
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
