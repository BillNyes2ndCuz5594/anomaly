// Deterministic codenames: no names, no free text. 40 bird and animal call signs.

export const CALL_SIGNS: readonly string[] = [
  'OSPREY', 'HERON', 'EGRET', 'IBIS', 'PELICAN', 'MANATEE', 'OTTER', 'PANTHER',
  'BOBCAT', 'TARPON', 'SNOOK', 'MANTA', 'MARLIN', 'KESTREL', 'FALCON', 'HARRIER',
  'CARACARA', 'ANHINGA', 'SPOONBILL', 'FLAMINGO', 'CRANE', 'PLOVER', 'TERN', 'SKIMMER',
  'CORMORANT', 'PINTAIL', 'MERLIN', 'KITE', 'DOLPHIN', 'TORTOISE', 'ARMADILLO', 'RACCOON',
  'FOX', 'LYNX', 'BADGER', 'WOLF', 'STINGRAY', 'EAGLE', 'OWL', 'SWIFT',
]

export const MAX_AGENT = 40
export const CLASS_CODE_MAX = 8

/** Uppercase, keep A-Z and 0-9 only, max 8 characters. */
export function sanitizeClassCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CLASS_CODE_MAX)
}

/** Integer 1-40. Anything unusable becomes 1. */
export function clampAgentNumber(n: number): number {
  if (!Number.isFinite(n)) return 1
  return Math.min(MAX_AGENT, Math.max(1, Math.round(n)))
}

/** FNV-1a, 32 bit. */
export function fnv1a(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/**
 * The call sign index is (agent - 1 + classOffset) mod 40, so agents 1-40 in one class
 * always get 40 different call signs, and different classes get different rotations.
 * An empty class code has offset 0, so agent 14 is KESTREL.
 */
export function callSignIndex(agentNumber: number, classCode: string): number {
  const code = sanitizeClassCode(classCode)
  const offset = code === '' ? 0 : fnv1a(code) % CALL_SIGNS.length
  return (clampAgentNumber(agentNumber) - 1 + offset) % CALL_SIGNS.length
}

export function generateCodename(agentNumber: number, classCode: string): string {
  const n = clampAgentNumber(agentNumber)
  return `AGENT ${CALL_SIGNS[callSignIndex(n, classCode)]}-${n}`
}
