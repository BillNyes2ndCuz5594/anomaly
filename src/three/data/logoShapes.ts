// Outline glyphs for the ANOMALY logo. Each letter is a polygon (plus optional holes) in a box
// that is 1 unit tall and `w` wide, origin at the bottom left. Pure data, no three import.

export type Pt = readonly [number, number]
export interface Glyph {
  w: number
  outline: Pt[]
  holes: Pt[][]
}

const S = 0.22 // stroke width

function rounded(x: number, y: number, w: number, h: number, r: number, seg = 8): Pt[] {
  const pts: Pt[] = []
  const corner = (cx: number, cy: number, a0: number) => {
    for (let i = 0; i <= seg; i++) {
      const a = a0 + (i / seg) * (Math.PI / 2)
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r])
    }
  }
  corner(x + w - r, y + r, -Math.PI / 2)
  corner(x + w - r, y + h - r, 0)
  corner(x + r, y + h - r, Math.PI / 2)
  corner(x + r, y + r, Math.PI)
  return pts
}

function glyphA(): Glyph {
  const w = 0.92
  const c = w / 2
  const a = 0.13
  const slope = c - a // horizontal travel of the outer edge per unit height
  const s1 = S * 1.15
  const xi = (y: number) => y * slope + s1
  const yMeet = (w - 2 * s1) / (2 * slope)
  const barLo = 0.2
  const barHi = 0.4
  return {
    w,
    outline: [
      [0, 0],
      [s1, 0],
      [xi(barLo), barLo],
      [w - xi(barLo), barLo],
      [w - s1, 0],
      [w, 0],
      [c + a, 1],
      [c - a, 1],
    ],
    holes: [
      [
        [xi(barHi), barHi],
        [c, yMeet],
        [w - xi(barHi), barHi],
      ],
    ],
  }
}

const GLYPHS: Record<string, Glyph> = {
  A: glyphA(),
  N: {
    w: 0.82,
    outline: [
      [0, 0],
      [S, 0],
      [S, 0.6],
      [0.82 - S, 0],
      [0.82, 0],
      [0.82, 1],
      [0.82 - S, 1],
      [0.82 - S, 0.4],
      [S, 1],
      [0, 1],
    ],
    holes: [],
  },
  O: {
    w: 0.84,
    outline: rounded(0, 0, 0.84, 1, 0.3),
    holes: [rounded(S, S, 0.84 - 2 * S, 1 - 2 * S, 0.14).reverse()],
  },
  M: {
    w: 1.04,
    outline: [
      [0, 0],
      [S, 0],
      [S, 0.62],
      [0.52, 0.12],
      [1.04 - S, 0.62],
      [1.04 - S, 0],
      [1.04, 0],
      [1.04, 1],
      [1.04 - S, 1],
      [0.52, 0.5],
      [S, 1],
      [0, 1],
    ],
    holes: [],
  },
  L: {
    w: 0.7,
    outline: [
      [0, 0],
      [0.7, 0],
      [0.7, S],
      [S, S],
      [S, 1],
      [0, 1],
    ],
    holes: [],
  },
  Y: {
    w: 0.92,
    outline: [
      [0, 1],
      [S * 1.2, 1],
      [0.46, 0.56],
      [0.92 - S * 1.2, 1],
      [0.92, 1],
      [0.46 + S / 2, 0.46],
      [0.46 + S / 2, 0],
      [0.46 - S / 2, 0],
      [0.46 - S / 2, 0.46],
    ],
    holes: [],
  },
}

export const LOGO_GAP = 0.15

export interface PlacedGlyph extends Glyph {
  ch: string
  /** X offset of the glyph box, word centered on 0. */
  x: number
}

/** Lays a word out left to right, centered on x = 0. */
export function layoutLogo(word: string): { glyphs: PlacedGlyph[]; width: number } {
  const chars = [...word].filter((c) => GLYPHS[c])
  const width = chars.reduce((n, c) => n + GLYPHS[c].w, 0) + LOGO_GAP * (chars.length - 1)
  let x = -width / 2
  const glyphs = chars.map((ch) => {
    const g = GLYPHS[ch]
    const placed = { ...g, ch, x }
    x += g.w + LOGO_GAP
    return placed
  })
  return { glyphs, width }
}
