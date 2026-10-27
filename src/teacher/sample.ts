// Sample class for demos: 24 fake agents with varied, plausible data, as real (valid) report codes.
import { CATALOG_BENCHMARKS, CATALOG_ITEMS } from '../lib/catalog.generated'
import { classHash, encodeReport, STAGE_NAMES, type ReportBenchmark, type StageName } from '../lib/reportCode'

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function stageFor(attempts: number, correct: number, days: number): StageName {
  const acc = attempts ? correct / attempts : 0
  let idx = Math.min(days, 4)
  if (idx >= 3 && acc < 0.7) idx = 2
  return STAGE_NAMES[idx]
}

export const SAMPLE_COUNT = 24

export function makeSampleCodes(seed = 2026): string[] {
  const rand = rng(seed)
  // Some benchmarks and items are harder for everyone, so the class view has a story.
  const benchHard = new Map(CATALOG_BENCHMARKS.map((b) => [b.id, rand() * 0.38]))
  const itemHard = new Map(CATALOG_ITEMS.map((i) => [i.id, rand() * 0.3 + (benchHard.get(i.benchmark) ?? 0) * 0.5]))
  const hash = classHash('SAMPLE')
  const out: string[] = []
  for (let agent = 1; agent <= SAMPLE_COUNT; agent++) {
    const ability = 0.42 + rand() * 0.5
    const days = 1 + Math.floor(rand() * 4)
    const lifeOnly = agent % 6 === 0
    const touched: ReportBenchmark[] = []
    for (const b of CATALOG_BENCHMARKS) {
      const isLife = b.id.includes('.L.')
      if (lifeOnly && !isLife) continue
      if (!isLife && rand() < 0.2) continue
      const attempts = isLife ? 4 + Math.floor(rand() * 8) : 2 + Math.floor(rand() * 5)
      const p = Math.max(0.1, Math.min(0.97, ability - (benchHard.get(b.id) ?? 0) + (rand() - 0.5) * 0.12))
      let correct = 0
      for (let i = 0; i < attempts; i++) if (rand() < p) correct++
      touched.push({ id: b.id, attempts, correct, stage: stageFor(attempts, correct, Math.min(days, correct)) })
    }
    const pool = CATALOG_ITEMS.filter((i) => touched.some((t) => t.id === i.benchmark))
    const recent = []
    const n = Math.min(20, 8 + Math.floor(rand() * 13), pool.length)
    const bag = [...pool]
    for (let i = 0; i < n; i++) {
      const it = bag.splice(Math.floor(rand() * bag.length), 1)[0]
      const p = Math.max(0.08, Math.min(0.97, ability - (itemHard.get(it.id) ?? 0) + 0.08))
      recent.push({ itemId: it.id, correct: rand() < p })
    }
    out.push(encodeReport({ classHash: hash, agent, day: 79 + Math.floor(rand() * 6), benchmarks: touched, recent }))
  }
  return out
}
