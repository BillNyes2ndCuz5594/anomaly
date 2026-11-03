import type { MotionMode } from './motionMode'

/** Hub case cards that show a live preview, by the data-testid of their button. */
export const PREVIEW_TARGETS = {
  'case-marker-03-1': 'cells',
  'case-marker-02-2': 'creek',
  'cold-marker': 'frost',
} as const

export type PreviewTarget = keyof typeof PREVIEW_TARGETS
export type PreviewClip = (typeof PREVIEW_TARGETS)[PreviewTarget]

export const PREVIEW_W = 168
export const PREVIEW_H = 94
const GAP = 12
const EDGE = 8

export function isPreviewTarget(id: string | null | undefined): id is PreviewTarget {
  return !!id && Object.prototype.hasOwnProperty.call(PREVIEW_TARGETS, id)
}

/** full plays the loop. fade and still show the poster crop only, never a video element. */
export function mediaKind(mode: MotionMode): 'video' | 'poster' {
  return mode === 'full' ? 'video' : 'poster'
}

export type PreviewState = { hover: PreviewTarget | null; focus: PreviewTarget | null }

/** Hover wins over keyboard focus. Nothing hovered or focused means nothing mounted. */
export function activeTarget(s: PreviewState): PreviewTarget | null {
  return s.hover ?? s.focus
}

type Box = { left: number; top: number; right: number; bottom: number }

/** Beside the card when there is room on its left, otherwise above it, always inside the viewport. */
export function placePreview(rect: Box, vw: number, vh: number): { left: number; top: number } {
  const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))
  const midY = (rect.top + rect.bottom) / 2 - PREVIEW_H / 2
  if (rect.left - GAP - PREVIEW_W >= EDGE) {
    return { left: rect.left - GAP - PREVIEW_W, top: clamp(midY, EDGE, Math.max(EDGE, vh - PREVIEW_H - EDGE)) }
  }
  return {
    left: clamp(rect.left, EDGE, Math.max(EDGE, vw - PREVIEW_W - EDGE)),
    top: clamp(rect.top - GAP - PREVIEW_H, EDGE, Math.max(EDGE, vh - PREVIEW_H - EDGE)),
  }
}
