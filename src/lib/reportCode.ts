// Report code: compact, typo-safe text that carries one agent's progress. No names, no PII.
// Pure module. Shared by the game and Teacher HQ, so it must not import three, React or the store.
//
// Bit layout (MSB first), then Crockford base32, 5 bits per character, plus 2 checksum characters:
//   version 4 | class hash 16 | agent-1 6 | day 12 | benchmark count 5
//   per benchmark: index 6 | attempts 6 | correct 6 | stage 3
//   recent count 5, then per result: item index 7 | correct 1
import { CATALOG_BENCHMARKS, CATALOG_ITEMS } from './catalog.generated'
import { fnv1a, sanitizeClassCode } from './codename'

export const REPORT_VERSION = 1
export const EPOCH = '2026-08-01'
export const MAX_RECENT = 20
export const MAX_ATTEMPTS = 63
export const STAGE_NAMES = ['unseen', 'rookie', 'field-ready', 'expert', 'ace'] as const
export type StageName = (typeof STAGE_NAMES)[number]

export interface ReportBenchmark {
  /** Benchmark id such as SC.5.L.14.1. */
  id: string
  attempts: number
  correct: number
  stage: StageName
}

export interface ReportRecent {
  /** Item id such as L14-01. */
  itemId: string
  correct: boolean
}

export interface ReportData {
  version: number
  /** 16 bit hash of the class code. */
  classHash: number
  agent: number
  /** Days since 2026-08-01. */
  day: number
  benchmarks: ReportBenchmark[]
  recent: ReportRecent[]
}

export type DecodeResult = { ok: true; report: ReportData } | { ok: false; error: string }

// ---------- base32 and checksum ----------

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const CHECK_PRIME = 1021

export function classHash(classCode: string): number {
  return fnv1a(sanitizeClassCode(classCode)) & 0xffff
}

/** Days from an ISO date (YYYY-MM-DD) to the epoch, clamped to 0..4095. */
export function dayNumber(iso: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return 0
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  const e = Date.UTC(2026, 7, 1)
  return Math.max(0, Math.min(4095, Math.round((t - e) / 86_400_000)))
}

export function dayToISO(day: number): string {
  const d = new Date(Date.UTC(2026, 7, 1) + day * 86_400_000)
  return d.toISOString().slice(0, 10)
}

/**
 * Weighted sum mod a prime. Catches every single wrong character and every swap of two
 * neighbours. Longer damage is caught with probability 1020 in 1021.
 */
function checksum(symbols: number[]): string {
  let sum = 7
  symbols.forEach((v, i) => {
    sum = (sum + (i + 1) * (v + 1)) % CHECK_PRIME
  })
  return ALPHABET[sum >> 5] + ALPHABET[sum & 31]
}

class BitWriter {
  bits: number[] = []
  put(value: number, width: number) {
    for (let i = width - 1; i >= 0; i--) this.bits.push((value >> i) & 1)
  }
  symbols(): number[] {
    const out: number[] = []
    for (let i = 0; i < this.bits.length; i += 5) {
      let v = 0
      for (let j = 0; j < 5; j++) v = (v << 1) | (this.bits[i + j] ?? 0)
      out.push(v)
    }
    return out
  }
}

class BitReader {
  pos = 0
  bits: number[]
  constructor(bits: number[]) {
    this.bits = bits
  }
  left() {
    return this.bits.length - this.pos
  }
  get(width: number): number {
    if (this.left() < width) throw new Error('short')
    let v = 0
    for (let i = 0; i < width; i++) v = (v << 1) | this.bits[this.pos++]
    return v
  }
}

export function groupCode(chars: string): string {
  return chars.match(/.{1,4}/g)?.join('-') ?? ''
}

// ---------- encode ----------

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(n)))

/** Scales attempts above the cap down together with correct so the ratio survives. */
function capPair(attempts: number, correct: number): [number, number] {
  const c = Math.min(correct, attempts)
  if (attempts <= MAX_ATTEMPTS) return [attempts, c]
  return [MAX_ATTEMPTS, clamp((c * MAX_ATTEMPTS) / attempts, 0, MAX_ATTEMPTS)]
}

export function encodeReport(data: Omit<ReportData, 'version'> & { version?: number }): string {
  const w = new BitWriter()
  w.put(data.version ?? REPORT_VERSION, 4)
  w.put(data.classHash & 0xffff, 16)
  w.put(clamp(data.agent, 1, 40) - 1, 6)
  w.put(clamp(data.day, 0, 4095), 12)

  const marks = data.benchmarks
    .map((b) => ({ b, idx: CATALOG_BENCHMARKS.findIndex((x) => x.id === b.id) }))
    .filter((x) => x.idx >= 0)
  w.put(marks.length, 5)
  for (const { b, idx } of marks) {
    const [a, c] = capPair(Math.max(0, b.attempts), Math.max(0, b.correct))
    w.put(idx, 6)
    w.put(a, 6)
    w.put(c, 6)
    w.put(Math.max(0, STAGE_NAMES.indexOf(b.stage)), 3)
  }

  const recent = data.recent
    .map((r) => ({ r, idx: CATALOG_ITEMS.findIndex((x) => x.id === r.itemId) }))
    .filter((x) => x.idx >= 0)
    .slice(-MAX_RECENT)
  w.put(recent.length, 5)
  for (const { r, idx } of recent) {
    w.put(idx, 7)
    w.put(r.correct ? 1 : 0, 1)
  }

  const symbols = w.symbols()
  const chars = symbols.map((s) => ALPHABET[s]).join('')
  return groupCode(chars + checksum(symbols))
}

// ---------- decode ----------

/** Crockford reading rules: case does not matter, O reads as 0, I and L read as 1. U is not used. */
function symbolOf(ch: string): number {
  const c = ch.toUpperCase().replace('O', '0').replace('I', '1').replace('L', '1')
  return ALPHABET.indexOf(c)
}

const MIN_CHARS = 12

export function decodeReport(text: string): DecodeResult {
  const clean = text.replace(/[\s-]+/g, '')
  if (!clean) return { ok: false, error: 'No code found. Paste the report code first.' }
  const symbols: number[] = []
  for (const ch of clean) {
    const s = symbolOf(ch)
    if (s < 0) return { ok: false, error: `The character "${ch}" is not used in report codes. Check for a typo.` }
    symbols.push(s)
  }
  if (symbols.length < MIN_CHARS) return { ok: false, error: 'This code is too short. Copy the whole code.' }
  const payload = symbols.slice(0, -2)
  const given = ALPHABET[symbols[symbols.length - 2]] + ALPHABET[symbols[symbols.length - 1]]
  if (checksum(payload) !== given) {
    return { ok: false, error: 'The checksum does not match. A character is wrong or missing. Check for a typo.' }
  }
  const bits: number[] = []
  for (const s of payload) for (let i = 4; i >= 0; i--) bits.push((s >> i) & 1)
  const r = new BitReader(bits)
  try {
    const version = r.get(4)
    if (version !== REPORT_VERSION) {
      return { ok: false, error: `This code is from a different version of ANOMALY (version ${version}). Update the game or Teacher HQ.` }
    }
    const hash = r.get(16)
    const agent = r.get(6) + 1
    if (agent > 40) return { ok: false, error: 'The agent number in this code is out of range.' }
    const day = r.get(12)
    const nb = r.get(5)
    const benchmarks: ReportBenchmark[] = []
    for (let i = 0; i < nb; i++) {
      const idx = r.get(6)
      const attempts = r.get(6)
      const correct = r.get(6)
      const stage = r.get(3)
      const def = CATALOG_BENCHMARKS[idx]
      if (!def) return { ok: false, error: `Unknown benchmark number ${idx}. This code may be from a newer version.` }
      if (stage >= STAGE_NAMES.length || correct > attempts) return { ok: false, error: 'The progress numbers in this code are not valid.' }
      benchmarks.push({ id: def.id, attempts, correct, stage: STAGE_NAMES[stage] })
    }
    const nr = r.get(5)
    if (nr > MAX_RECENT) return { ok: false, error: 'The recent results list in this code is too long.' }
    const recent: ReportRecent[] = []
    for (let i = 0; i < nr; i++) {
      const idx = r.get(7)
      const ok = r.get(1) === 1
      const def = CATALOG_ITEMS[idx]
      if (!def) return { ok: false, error: `Unknown item number ${idx}. This code may be from a newer version.` }
      recent.push({ itemId: def.id, correct: ok })
    }
    return { ok: true, report: { version, classHash: hash, agent, day, benchmarks, recent } }
  } catch {
    return { ok: false, error: 'This code is too short. Copy the whole code.' }
  }
}

// ---------- finding codes inside other text ----------

const DASHED = /^[0-9A-Za-z]{4}(?:-[0-9A-Za-z]{4}){2,}(?:-[0-9A-Za-z]{1,4})?$/
const COMPACT = /^[0-9A-Za-z]{24,}$/

/**
 * Pulls code-shaped tokens out of any text (a pasted list, a Canvas CSV export).
 * A token is a run of 4 character groups joined by dashes, or one long run of base32 letters.
 */
export function extractCodes(text: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of text.split(/[\s,;"'<>()[\]{}|]+/)) {
    const tok = raw.replace(/^[^0-9A-Za-z]+|[^0-9A-Za-z]+$/g, '')
    if (!tok) continue
    if (DASHED.test(tok) || COMPACT.test(tok)) {
      const key = tok.replace(/-/g, '').toUpperCase()
      if (!seen.has(key)) {
        seen.add(key)
        out.push(tok)
      }
    }
  }
  return out
}

export interface DecodedBatch {
  reports: ReportData[]
  /** Tokens that looked like codes but failed to decode. */
  rejected: { token: string; error: string }[]
}

/** Decodes every code found in `text`. When one agent appears twice, the newest code wins. */
export function decodeAll(text: string): DecodedBatch {
  const best = new Map<string, ReportData>()
  const rejected: DecodedBatch['rejected'] = []
  for (const token of extractCodes(text)) {
    const res = decodeReport(token)
    if (!res.ok) {
      rejected.push({ token, error: res.error })
      continue
    }
    const r = res.report
    const key = `${r.classHash}:${r.agent}`
    const prev = best.get(key)
    const total = (x: ReportData) => x.benchmarks.reduce((n, b) => n + b.attempts, 0)
    if (!prev || r.day > prev.day || (r.day === prev.day && total(r) >= total(prev))) best.set(key, r)
  }
  return { reports: [...best.values()], rejected }
}
