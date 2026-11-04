export const MODE_SCHEMA_VERSION = 1, MAX_TURN_TOKEN = Number.MAX_SAFE_INTEGER - 1
export const QUICK_MODES: ReadonlySet<string> = new Set(['containment', 'reactor']), QUICK_CASES: ReadonlySet<string> = new Set(['02-2'])
export const CONTAINMENT_PHASES: readonly string[] = ['question', 'action', 'wave', 'resolved', 'done']
export const REACTOR_PHASES: readonly string[] = ['question', 'action', 'pulse', 'resolved', 'done']
export const BEDROCK_ITEM_IDS: ReadonlySet<string> = new Set(
  ['E6.1', 'E6.2', 'E6.4'].flatMap((p) => Array.from({ length: 12 }, (_, i) => `${p}-${String(i + 1).padStart(2, '0')}`)),
)

export interface ModeAnswerFeedback { itemId: string; correct: boolean; explanation?: string }
export interface ModeSession<TResources = unknown, TBoard = unknown> {
  version: number; mode: string; caseId: string; seed: string; questionIndex: number
  phase: string; turnToken: number; feedback: ModeAnswerFeedback | null; resources: TResources; board: TBoard
}
export interface ValidateModeSessionOptions {
  mode?: string; caseId?: string; allowedPhases?: readonly string[]
  validItemIds?: ReadonlySet<string>; validateResources?: (resources: unknown) => boolean; validateBoard?: (board: unknown) => boolean
}

export const modeSessionKey = (mode: string, caseId: string) => `anomaly:${mode}:v${MODE_SCHEMA_VERSION}:${caseId}`

export function isValidItemId(id: unknown, allowedItems?: ReadonlySet<string>): id is string {
  return typeof id === 'string' && /^[A-Za-z0-9_.-]+$/.test(id) && id.length > 0 && (!allowedItems || allowedItems.has(id))
}

export function isValidFeedback(fb: unknown, allowedItems?: ReadonlySet<string>): fb is ModeAnswerFeedback {
  if (!fb || typeof fb !== 'object' || Array.isArray(fb)) return false
  const r = fb as Record<string, unknown>
  return isValidItemId(r.itemId, allowedItems) && typeof r.correct === 'boolean' &&
    (r.explanation === undefined || typeof r.explanation === 'string')
}

const isBoundedInt = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max

function isValidResources(res: unknown, mode: string): boolean {
  if (!res || typeof res !== 'object' || Array.isArray(res)) return false
  const r = res as Record<string, unknown>
  if (!Object.values(r).every((v) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0)) return false
  if (mode === 'containment') return isBoundedInt(r.charge, 0, 100) && isBoundedInt(r.integrity, 0, 10)
  if (mode === 'reactor') {
    return isBoundedInt(r.instability, 0, 10) && isBoundedInt(r.streak, 0, 100) &&
      isBoundedInt(r.shields, 0, 10) && (r.score === undefined || isBoundedInt(r.score, 0, 1000000))
  }
  return false
}

function isValidBoard(board: unknown, mode: string): boolean {
  if (!Array.isArray(board) || board.length > 30) return false
  if (mode === 'containment') {
    return board.every((e) => e && typeof e === 'object' && !Array.isArray(e) &&
      isBoundedInt((e as Record<string, unknown>).lane, 0, 2) &&
      isBoundedInt((e as Record<string, unknown>).position, 0, 2) &&
      ((e as Record<string, unknown>).type === undefined ||
        (typeof (e as Record<string, unknown>).type === 'string' && (e as Record<string, unknown>).type !== '')))
  }
  return mode === 'reactor' ? board.length === 0 : false
}

export function validateModeEnvelope<T = ModeSession>(raw: unknown, mode?: string, caseId?: string): T | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const s = raw as Record<string, unknown>
  if (s.version !== MODE_SCHEMA_VERSION || typeof s.seed !== 'string' || !s.seed) return null
  if (typeof s.mode !== 'string' || (mode ? s.mode !== mode : !QUICK_MODES.has(s.mode))) return null
  if (typeof s.caseId !== 'string' || (caseId ? s.caseId !== caseId : !QUICK_CASES.has(s.caseId))) return null
  if (typeof s.questionIndex !== 'number' || !Number.isInteger(s.questionIndex) || s.questionIndex < 0 || s.questionIndex > 10) return null
  if (typeof s.turnToken !== 'number' || !Number.isSafeInteger(s.turnToken) || s.turnToken < 0 || s.turnToken > MAX_TURN_TOKEN) return null
  return s as unknown as T
}

export function validateModeSession<TResources = unknown, TBoard = unknown>(
  raw: unknown, opts?: ValidateModeSessionOptions,
): ModeSession<TResources, TBoard> | null {
  const env = validateModeEnvelope<ModeSession<TResources, TBoard>>(raw, opts?.mode, opts?.caseId)
  if (!env) return null
  const s = env as unknown as Record<string, unknown>
  const phases = opts?.allowedPhases ?? (s.mode === 'containment' ? CONTAINMENT_PHASES : s.mode === 'reactor' ? REACTOR_PHASES : undefined)
  if (typeof s.phase !== 'string' || !phases?.includes(s.phase)) return null
  if (s.feedback !== null && !isValidFeedback(s.feedback, opts?.validItemIds ?? (s.caseId === '02-2' ? BEDROCK_ITEM_IDS : undefined))) return null
  if (!isValidResources(s.resources, s.mode as string) || (opts?.validateResources && !opts.validateResources(s.resources))) return null
  if (!isValidBoard(s.board, s.mode as string) || (opts?.validateBoard && !opts.validateBoard(s.board))) return null
  return env
}

export function loadModeSession<T = ModeSession>(
  storage: { getItem(k: string): string | null } | null | undefined, mode: string, caseId: string, validate?: (session: ModeSession) => T | null,
): T | null {
  try {
    const raw = storage?.getItem(modeSessionKey(mode, caseId))
    if (!raw) return null
    const env = validateModeEnvelope(JSON.parse(raw), mode, caseId)
    return env ? (validate ? validate(env) : (validateModeSession(env, { mode, caseId }) as unknown as T)) : null
  } catch { return null }
}

export function saveModeSession<T = ModeSession>(storage: { setItem(k: string, v: string): void } | null | undefined, mode: string, caseId: string, session: T): void {
  try { storage?.setItem(modeSessionKey(mode, caseId), JSON.stringify(session)) } catch {}
}
export function clearModeSession(storage: { removeItem(k: string): void } | null | undefined, mode: string, caseId: string): void {
  try { storage?.removeItem(modeSessionKey(mode, caseId)) } catch {}
}
