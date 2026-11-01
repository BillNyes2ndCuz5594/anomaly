// Pure logic for the generic Field Lab (sort, match, order). No React, no store: LabGeneric.tsx and the tests drive it.
import type { MatchLab, OrderLab, SortLab } from '../../content/schema'
import { seeded } from '../../lib/rkea'

export type GenericLab = SortLab | MatchLab | OrderLab

export interface LabFeedback {
  ok: boolean
  /** "Correct" or "Not quite." Shown with an icon, never by color alone. */
  word: string
  text: string
  /** The card (sort), left card (match) or step (order) the answer was about. */
  card: string
  /** The bin, right card or step that was chosen. */
  target: string
}

export interface LabState {
  /** Cards in the order the player sees them. Order labs show their steps shuffled. */
  cards: string[]
  /** Placed cards. Sort: card id to bin id. Match: left id to right id. Order: step id to slot number (1 based). */
  placed: Record<string, string>
  /** The card being worked on. Order labs keep this null (the next empty slot is the question). */
  current: string | null
  feedback: LabFeedback | null
  tries: number
  misses: number
}

export type LabAction = { type: 'select'; id: string } | { type: 'place'; target: string }

export interface LabTarget {
  id: string
  name: string
  /** Second line under the name (match right cards with a card line). */
  sub?: string
}

export interface LabCard {
  id: string
  name: string
  lines: string[]
}

const NOT_QUITE = 'Not quite.'
const CORRECT = 'Correct'

/** Steps shuffled the same way for a given seed, never left in the right order. */
export function shuffleSteps(ids: readonly string[], seed: string): string[] {
  const out = [...ids].sort((a, b) => seeded(seed, a) - seeded(seed, b) || a.localeCompare(b))
  if (out.length > 1 && out.every((id, i) => id === ids[i])) out.push(out.shift() as string)
  return out
}

/** The cards the player works through, in display order, with the lines shown on the card panel. */
export function labCards(lab: GenericLab): LabCard[] {
  switch (lab.kind) {
    case 'sort':
      return lab.cards.map((c) => ({ id: c.id, name: c.name, lines: c.card }))
    case 'match':
      return lab.left.map((c) => ({ id: c.id, name: c.name, lines: c.card ? [c.card] : [] }))
    case 'order':
      return lab.steps.map((s) => ({ id: s.id, name: s.name, lines: s.card ? [s.card] : [] }))
  }
}

/** Where a card can go: bins (sort), right cards (match), or the steps themselves (order picks the next step). */
export function labTargets(lab: GenericLab): LabTarget[] {
  switch (lab.kind) {
    case 'sort':
      return lab.bins.map((b) => ({ id: b.id, name: b.name }))
    case 'match':
      return lab.right.map((r) => ({ id: r.id, name: r.name, sub: r.card }))
    case 'order':
      return lab.steps.map((s) => ({ id: s.id, name: s.name, sub: s.card }))
  }
}

/** Number of places a target owns in the 3D scene: bins, right cards, or slots for an order lab. */
export function pedestalIds(lab: GenericLab): string[] {
  return lab.kind === 'order' ? lab.steps.map((_, i) => `slot-${i + 1}`) : labTargets(lab).map((t) => t.id)
}

export function initLab(lab: GenericLab, seed = 'lab'): LabState {
  const ids = labCards(lab).map((c) => c.id)
  const cards = lab.kind === 'order' ? shuffleSteps(ids, seed) : ids
  return { cards, placed: {}, current: lab.kind === 'order' ? null : (cards[0] ?? null), feedback: null, tries: 0, misses: 0 }
}

export function placedCount(state: LabState): number {
  return Object.keys(state.placed).length
}

export function isComplete(lab: GenericLab, state: LabState): boolean {
  return placedCount(state) === labCards(lab).length
}

/** The next empty slot of an order lab (1 based), or null when all are filled. */
export function nextSlot(lab: GenericLab, state: LabState): number | null {
  if (lab.kind !== 'order') return null
  const n = placedCount(state) + 1
  return n <= lab.steps.length ? n : null
}

/** Order lab: the step placed in a slot (1 based), or null. */
export function stepInSlot(state: LabState, slot: number): string | null {
  const hit = Object.entries(state.placed).find(([, s]) => s === String(slot))
  return hit ? hit[0] : null
}

/** True when a target can still take a card: a used right card or a placed step cannot be chosen again. */
export function targetOpen(lab: GenericLab, state: LabState, target: string): boolean {
  if (lab.kind === 'sort') return true
  if (lab.kind === 'match') return !Object.values(state.placed).includes(target)
  return !(target in state.placed)
}

/** The first unplaced card after `from` in display order, wrapping round. */
function nextOpen(state: LabState, placed: Record<string, string>, from: string | null): string | null {
  const start = from ? state.cards.indexOf(from) : -1
  for (let k = 1; k <= state.cards.length; k++) {
    const id = state.cards[(start + k) % state.cards.length]
    if (!(id in placed)) return id
  }
  return null
}

function judge(lab: GenericLab, state: LabState, target: string): { ok: boolean; card: string; text: string } | null {
  switch (lab.kind) {
    case 'sort': {
      const card = lab.cards.find((c) => c.id === state.current)
      const bin = lab.bins.find((b) => b.id === target)
      if (!card || !bin || card.id in state.placed) return null
      return card.bin === bin.id ? { ok: true, card: card.id, text: card.why } : { ok: false, card: card.id, text: bin.hint }
    }
    case 'match': {
      const left = lab.left.find((c) => c.id === state.current)
      const right = lab.right.find((r) => r.id === target)
      if (!left || !right || left.id in state.placed || !targetOpen(lab, state, target)) return null
      const pair = lab.pairs.find((p) => p.left === left.id)
      return pair?.right === right.id
        ? { ok: true, card: left.id, text: pair.why }
        : { ok: false, card: left.id, text: `${left.name} and ${right.name} do not go together. Read both cards again.` }
    }
    case 'order': {
      const slot = nextSlot(lab, state)
      const step = lab.steps.find((s) => s.id === target)
      if (slot === null || !step || step.id in state.placed) return null
      const ok = lab.steps[slot - 1].id === step.id
      return ok
        ? { ok, card: step.id, text: slot === lab.steps.length ? lab.why : `Step ${slot}: ${step.name}.` }
        : { ok, card: step.id, text: `That step comes later. Which one has to happen first?` }
    }
  }
}

/** One player action. Wrong answers cost nothing: the card stays, the hint shows, the player tries again. */
export function labReduce(lab: GenericLab, state: LabState, action: LabAction): LabState {
  if (action.type === 'select') {
    if (lab.kind === 'order' || !state.cards.includes(action.id) || action.id in state.placed) return state
    return { ...state, current: action.id, feedback: null }
  }
  const verdict = judge(lab, state, action.target)
  if (!verdict) return state
  const feedback: LabFeedback = { ok: verdict.ok, word: verdict.ok ? CORRECT : NOT_QUITE, text: verdict.text, card: verdict.card, target: action.target }
  if (!verdict.ok) return { ...state, feedback, tries: state.tries + 1, misses: state.misses + 1 }
  const value = lab.kind === 'order' ? String(nextSlot(lab, state)) : action.target
  const placed = { ...state.placed, [verdict.card]: value }
  const current = lab.kind === 'order' ? null : nextOpen(state, placed, state.current)
  return { ...state, placed, current, feedback, tries: state.tries + 1 }
}

/** Where a placed card sits in the 3D scene: its bin, its right card, or its slot. */
export function pedestalFor(lab: GenericLab, state: LabState, card: string): string | null {
  const v = state.placed[card]
  if (v === undefined) return null
  return lab.kind === 'order' ? `slot-${v}` : v
}

/** The right move for the current question, for tests and the proof walk. */
export function answerFor(lab: GenericLab, state: LabState): string | null {
  switch (lab.kind) {
    case 'sort':
      return lab.cards.find((c) => c.id === state.current)?.bin ?? null
    case 'match':
      return lab.pairs.find((p) => p.left === state.current)?.right ?? null
    case 'order': {
      const slot = nextSlot(lab, state)
      return slot === null ? null : lab.steps[slot - 1].id
    }
  }
}

/** Codex ids a correct placement unlocks: lab:<caseId>:<cardId>, only when the pack lists that entry. */
export function codexFor(caseId: string, card: string, known: { has: (id: string) => boolean }): string[] {
  const id = `lab:${caseId}:${card}`
  return known.has(id) ? [id] : []
}

/** Headline for the HUD card panel. */
export function labTitle(lab: GenericLab): string {
  return lab.kind === 'sort' ? 'SORT' : lab.kind === 'match' ? 'MATCH' : 'ORDER'
}
