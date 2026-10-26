import type { CaseStep } from '../../state/session'

/** Width of the right HUD panel per step. The 3D scene is centered in the space left of it. */
export const CASE_PANEL_WIDTH = 420

export function caseInset(step: CaseStep): number {
  return step === 'briefing' || step === 'lab-a' || step === 'lab-b' || step === 'lab-c' ? CASE_PANEL_WIDTH : 0
}

/** Viewport box in CSS pixels, as returned by getBoundingClientRect. */
export interface Rect {
  left: number
  top: number
  right: number
  bottom: number
}

export interface HudRects {
  /** The side panel or bottom sheet (hub panel, case side panel). */
  panel: Rect | null
  /** The job card dock. Only read on case steps. */
  dock: Rect | null
  /** The top bar. Only read on case steps. */
  bar: Rect | null
}

/** Where the HUD puts its panels. Must match the media queries in index.css. */
export type LayoutMode = 'wide' | 'stack' | 'compact-landscape'

/**
 * wide: panel on the right, dock bottom left (desktop, tablet landscape).
 * stack: panel is a bottom sheet with the dock above it (phone and tablet portrait).
 * compact-landscape: a short landscape screen (phone on its side): panel on the right half, dock bottom left.
 */
export function layoutMode(w: number, h: number): LayoutMode {
  if (h <= 500 && w > h) return 'compact-landscape'
  if (w <= 900) return 'stack'
  return 'wide'
}

/**
 * The part of the viewport the HUD covers, from measured panel rects. The 3D scene is fitted into what is left:
 * a panel on the side becomes a right inset, a bottom sheet becomes a bottom inset, and so does the dock.
 * `vertical` (case steps) also reserves the top bar and the dock. `fallbackRight` is used until a side panel is mounted.
 */
export function hudInsets(w: number, h: number, r: HudRects, vertical: boolean, fallbackRight: number): { right: number; top: number; bottom: number } {
  const mode = layoutMode(w, h)
  let right = mode === 'stack' ? 0 : Math.min(fallbackRight, Math.round(w * 0.5))
  let bottom = 0
  if (r.panel) {
    if (r.panel.left > w * 0.25) right = Math.max(0, Math.round(w - r.panel.left + 14))
    else {
      right = 0
      bottom = Math.max(bottom, Math.round(h - r.panel.top + 10))
    }
  }
  if (vertical && r.dock) bottom = Math.max(bottom, Math.max(0, Math.round(h - r.dock.top + 10)))
  const top = vertical && r.bar ? Math.max(0, Math.round(r.bar.bottom + 6)) : 0
  return { right, top, bottom }
}
