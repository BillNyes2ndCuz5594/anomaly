// WCAG 2.x contrast helpers (pure). Used by tests that guard the HUD palette.

function channel(v: number): number {
  const x = v / 255
  return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)
}

export function parseColor(c: string): [number, number, number] {
  const hex = c.trim().match(/^#([0-9a-f]{6})$/i)
  if (hex) return [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16)) as [number, number, number]
  const rgb = c.match(/rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/i)
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])]
  throw new Error(`unsupported color ${c}`)
}

export function luminance(c: string): number {
  const [r, g, b] = parseColor(c)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** Blends `fg` at `alpha` over `bg`, returned as a hex color. */
export function blend(fg: string, bg: string, alpha: number): string {
  const f = parseColor(fg)
  const g = parseColor(bg)
  return '#' + f.map((v, i) => Math.round(v * alpha + g[i] * (1 - alpha)).toString(16).padStart(2, '0')).join('')
}
