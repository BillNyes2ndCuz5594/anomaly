// Layout math for the case payoff. The stamp text keeps one transform for its whole life
// (a small static tilt, never a scale), so the box does not depend on animation time.

export const STAMP_PHRASES = ['CASE CLOSED', 'CASE STILL OPEN', 'RESIDUE CLEARED'] as const
export const STAMP_ROTATE_DEG = 3
export const STAMP_MIN_FONT = 12
export const STAMP_MAX_FONT = 26

const CAP_EM = 0.9
const SPACE_EM = 0.45
const ICON_EM = 1.45
const CHROME_PX = 8 + 28 + 8

/** Estimated em width of a stamp phrase, including tracking. Capitals are overestimated on purpose. */
export function stampPhraseEm(phrase: string, trackingEm: number): number {
  let em = 0
  for (const ch of phrase) em += ch === ' ' ? SPACE_EM : CAP_EM
  if (phrase.length > 1) em += (phrase.length - 1) * trackingEm
  return em
}

export function stampTracking(innerWidth: number): number {
  if (innerWidth >= 1100) return 0.12
  if (innerWidth >= 700) return 0.08
  return 0.04
}

export interface StampFit {
  fontPx: number
  trackingEm: number
  /** Estimated one-line width of the whole stamp. Never above innerWidth. */
  widthPx: number
  oneLine: boolean
}

/** Largest one-line font that stays inside innerWidth. Wraps only if 12px still cannot. */
export function fitStampFont(innerWidth: number, phrase: string): StampFit {
  const trackingEm = stampTracking(innerWidth)
  const widthAt = (font: number) => stampPhraseEm(phrase, trackingEm) * font + ICON_EM * font + CHROME_PX
  const room = Math.max(0, innerWidth)
  let font = STAMP_MAX_FONT
  if (room < 80) font = STAMP_MIN_FONT
  else {
    while (font > STAMP_MIN_FONT && widthAt(font) > room) {
      font = Math.round((font - 0.5) * 10) / 10
    }
  }
  const natural = widthAt(font)
  return {
    fontPx: font,
    trackingEm,
    widthPx: Math.min(room, natural),
    oneLine: natural <= room + 0.5,
  }
}

/** How far a centered rotation pushes the axis-aligned box past the layout box, per side. */
export function rotatedOverhang(width: number, height: number, deg = STAMP_ROTATE_DEG): number {
  const r = (Math.abs(deg) * Math.PI) / 180
  return (width / 2) * (1 - Math.cos(r)) + (height / 2) * Math.sin(r)
}

/**
 * True when a stamp of layoutWidth x layoutHeight, centered in innerWidth with a static tilt,
 * stays inside the panel content box. Scale is always 1, so this does not change over time.
 */
export function stampBoxFits(innerWidth: number, layoutWidth: number, layoutHeight: number): boolean {
  if (layoutWidth > innerWidth + 0.5) return false
  const gap = (innerWidth - layoutWidth) / 2
  return gap + 1 >= rotatedOverhang(layoutWidth, layoutHeight)
}

export function stampInsidePanel(
  stamp: { left: number; right: number },
  panel: { left: number; right: number },
  slack = 1,
): boolean {
  return stamp.left >= panel.left - slack && stamp.right <= panel.right + slack
}

export function verdictPhrase(closed: boolean, cold: boolean): string {
  if (!closed) return 'CASE STILL OPEN'
  return cold ? 'RESIDUE CLEARED' : 'CASE CLOSED'
}

export function verdictWord(closed: boolean, cold: boolean): string {
  if (!closed) return 'Case still open'
  return cold ? 'Residue cleared' : 'Case closed'
}

/** Same lines the debrief has always shown. The main case uses a fixed open line. */
export function debriefLine(closed: boolean, cold: boolean, closedText: string, openText: string): string {
  if (closed) return closedText
  return cold ? openText : 'CASE STILL OPEN. It returns as a cold case soon.'
}
