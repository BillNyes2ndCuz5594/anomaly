// Pure math for scene diagram labels: size from the in-game text scale, wrapping, and a small
// collision pass that keeps every label inside the viewBox and apart from the others.
// The estimates are slightly wide on purpose, so the real text always fits inside its estimate.

export const BASE_W = 400
export const BASE_H = 220
/** Smallest rendered label size in CSS px at Normal text size. */
export const MIN_LABEL_PX = 14
/** Width of one bold monospace glyph plus letter spacing, in em. */
export const CHAR_EM = 0.66
const ASCENT = 0.82
const DESCENT = 0.28
const LINE = 1.16

export interface ViewBox {
  x: number
  y: number
  w: number
  h: number
}

/** CSS px per viewBox unit for the base 400x220 art fitted into a w x h box. */
export function baseScale(w: number, h: number): number {
  if (!(w > 0) || !(h > 0)) return 1
  return Math.min(w / BASE_W, h / BASE_H)
}

/** A viewBox that has the same aspect as the box, centered on the base art, so nothing is letterboxed. */
export function viewBoxFor(w: number, h: number): ViewBox {
  if (!(w > 0) || !(h > 0)) return { x: 0, y: 0, w: BASE_W, h: BASE_H }
  const aspect = w / h
  const vw = Math.max(BASE_W, BASE_H * aspect)
  const vh = Math.max(BASE_H, BASE_W / aspect)
  return { x: (BASE_W - vw) / 2, y: (BASE_H - vh) / 2, w: vw, h: vh }
}

/** Label font size in viewBox units so that it renders at MIN_LABEL_PX times the text scale. */
export function labelSize(scale: number, textScale: number): number {
  const px = MIN_LABEL_PX * Math.max(0.5, textScale)
  return Math.min(28, Math.max(7, px / Math.max(0.05, scale)))
}

export const textWidth = (s: string, size: number): number => s.length * size * CHAR_EM

/** Breaks a label at ": " first, then at spaces so no line is wider than maxW. */
export function wrapText(text: string, size: number, maxW: number): string[] {
  const head = text.includes(': ') ? [text.split(': ')[0], text.split(': ').slice(1).join(': ')] : [text]
  const out: string[] = []
  for (const part of head) {
    let cur = ''
    for (const word of part.split(' ')) {
      const next = cur ? `${cur} ${word}` : word
      if (cur && textWidth(next, size) > maxW) {
        out.push(cur)
        cur = word
      } else cur = next
    }
    out.push(cur)
  }
  return out
}

export interface LabelSpec {
  key: string
  text: string
  x: number
  /** Baseline of the first line. */
  y: number
  anchor?: 'start' | 'middle' | 'end'
  maxW?: number
  fill?: string
}

export interface Rect {
  x0: number
  y0: number
  x1: number
  y1: number
}

export interface PlacedLabel {
  key: string
  lines: string[]
  x: number
  y: number
  anchor: 'start' | 'middle' | 'end'
  fill?: string
  size: number
  lineHeight: number
  box: Rect
}

export const intersects = (a: Rect, b: Rect, gap = 0): boolean => a.x0 < b.x1 + gap && b.x0 < a.x1 + gap && a.y0 < b.y1 + gap && b.y0 < a.y1 + gap

function boxFor(lines: string[], x: number, y: number, anchor: 'start' | 'middle' | 'end', size: number): Rect {
  const w = Math.max(...lines.map((l) => textWidth(l, size)))
  const x0 = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2
  return { x0, x1: x0 + w, y0: y - size * ASCENT, y1: y + (lines.length - 1) * size * LINE + size * DESCENT }
}

const overlapArea = (a: Rect, b: Rect) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0))

/** Wraps, clamps into the viewBox (with `pad` margin) and nudges labels apart. Order sets priority. */
export function layoutLabels(specs: LabelSpec[], size: number, vb: ViewBox, pad = 6): PlacedLabel[] {
  const placed: PlacedLabel[] = []
  const gap = size * 0.2
  for (const s of specs) {
    if (!s.text) continue
    const anchor = s.anchor ?? 'middle'
    const maxW = Math.min(s.maxW ?? BASE_W * 0.6, vb.w - pad * 2)
    const lines = wrapText(s.text, size, maxW)
    const lh = size * LINE
    const w = Math.max(...lines.map((l) => textWidth(l, size)))
    // keep the box inside the view horizontally
    const half = anchor === 'middle' ? w / 2 : 0
    const lo = vb.x + pad + (anchor === 'end' ? w : half)
    const hi = vb.x + vb.w - pad - (anchor === 'start' ? w : half)
    const x = Math.min(Math.max(s.x, lo), Math.max(lo, hi))
    const yMin = vb.y + pad + size * ASCENT
    const yMax = vb.y + vb.h - pad - size * DESCENT - (lines.length - 1) * lh
    const clampY = (y: number) => Math.min(Math.max(y, yMin), Math.max(yMin, yMax))
    let best = { y: clampY(s.y), area: Infinity }
    const step = size * 0.5
    const offsets = [0]
    for (let i = 1; i <= 16; i++) offsets.push(i * step, -i * step)
    for (const off of offsets) {
      const y = clampY(s.y + off)
      const box = boxFor(lines, x, y, anchor, size)
      const area = placed.reduce((sum, p) => sum + (intersects(box, p.box, gap) ? overlapArea(box, p.box) + 1 : 0), 0)
      if (area < best.area) best = { y, area }
      if (area === 0) break
    }
    placed.push({ key: s.key, lines, x, y: best.y, anchor, fill: s.fill, size, lineHeight: lh, box: boxFor(lines, x, best.y, anchor, size) })
  }
  return placed
}
