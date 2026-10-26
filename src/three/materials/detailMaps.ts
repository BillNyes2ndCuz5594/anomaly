// Procedural surface detail for the specimens, generated at runtime so no image file ships.
// One small tileable RGBA map per kind of skin:
//   R  height (bumps, scales, wrinkles)
//   G  roughness variation (0.5 is neutral)
//   B  cavity (255 is open, lower is a dark crevice that also darkens the color)
// Pure math, no three import, so it is cheap to unit test.

export type DetailKind = 'gator' | 'fish' | 'fur' | 'wrinkle' | 'skin' | 'feather' | 'grain'

const hash = (x: number, y: number, seed: number): number => {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 2147483647)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967295
}

const fade = (t: number) => t * t * (3 - 2 * t)
const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const sstep = (a: number, b: number, x: number) => fade(clamp01((x - a) / (b - a)))

/** Value noise that repeats every `period` cells in both directions. x and y in cell units. */
function vnoise(x: number, y: number, px: number, py: number, seed: number): number {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const fx = fade(x - xi)
  const fy = fade(y - yi)
  const wx = (v: number) => ((v % px) + px) % px
  const wy = (v: number) => ((v % py) + py) % py
  const a = hash(wx(xi), wy(yi), seed)
  const b = hash(wx(xi + 1), wy(yi), seed)
  const c = hash(wx(xi), wy(yi + 1), seed)
  const d = hash(wx(xi + 1), wy(yi + 1), seed)
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy
}

/** Fractal value noise over u, v in 0..1 that tiles. `fx` and `fy` are the base cell counts (may differ to stretch). */
function fbm(u: number, v: number, fx: number, fy: number, oct: number, seed: number): number {
  let sum = 0
  let amp = 0.5
  let norm = 0
  let ax = fx
  let ay = fy
  for (let o = 0; o < oct; o++) {
    sum += amp * vnoise(u * ax, v * ay, ax, ay, seed + o * 17)
    norm += amp
    amp *= 0.5
    ax *= 2
    ay *= 2
  }
  return sum / norm
}

/** Tileable Worley cells: returns the distance to the nearest and second nearest point and the id of the nearest. */
function worley(u: number, v: number, n: number, seed: number, jitter = 0.85): { f1: number; f2: number; id: number } {
  const x = u * n
  const y = v * n
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  let f1 = 9
  let f2 = 9
  let id = 0
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const cx = xi + i
      const cy = yi + j
      const wx = ((cx % n) + n) % n
      const wy = ((cy % n) + n) % n
      const px = cx + 0.5 + (hash(wx, wy, seed) - 0.5) * jitter
      const py = cy + 0.5 + (hash(wx, wy, seed + 5) - 0.5) * jitter
      const d = Math.hypot(px - x, py - y)
      if (d < f1) {
        f2 = f1
        f1 = d
        id = hash(wx, wy, seed + 9)
      } else if (d < f2) f2 = d
    }
  }
  return { f1, f2, id }
}

type Sampler = (u: number, v: number) => [number, number, number]

const samplers: Record<DetailKind, Sampler> = {
  // Irregular blocky plates with deep seams, like crocodilian skin.
  gator: (u, v) => {
    const w = worley(u, v, 10, 3)
    const edge = w.f2 - w.f1
    const plate = sstep(0.02, 0.3, edge)
    const crown = 1 - sstep(0, 0.55, w.f1)
    const grit = fbm(u, v, 24, 24, 2, 7)
    return [clamp01(plate * (0.7 + 0.3 * crown) * (0.85 + 0.15 * grit)), 0.35 + 0.5 * w.id * plate + 0.1 * grit, 0.35 + 0.65 * sstep(0.0, 0.2, edge)]
  },
  // Small rounded scales in a loose staggered pattern: domes with soft seams, no hard rows.
  fish: (u, v) => {
    const w = worley(u, v, 13, 17, 0.35)
    const dome = 1 - sstep(0, 0.75, w.f1)
    const seam = sstep(0.0, 0.22, w.f2 - w.f1)
    return [clamp01(dome * 0.8 + 0.2 * w.id), 0.4 + 0.25 * w.id, 0.55 + 0.45 * seam]
  },
  // Short dense coat: tight noise plus soft clumps.
  fur: (u, v) => {
    const fine = fbm(u, v, 52, 64, 2, 21)
    const clump = fbm(u, v, 9, 11, 2, 23)
    return [clamp01(fine * 0.75 + clump * 0.25), 0.62 + 0.3 * clump, 0.7 + 0.3 * fine]
  },
  // Loose folded skin: ridged creases with pores.
  wrinkle: (u, v) => {
    const warp = fbm(u, v, 4, 4, 2, 31)
    const r = 1 - Math.abs(2 * fbm(u + warp * 0.08, v, 6, 11, 3, 33) - 1)
    const crease = sstep(0.55, 0.95, r)
    const pores = fbm(u, v, 44, 44, 2, 35)
    return [clamp01(0.55 * crease + 0.35 * fbm(u, v, 5, 5, 3, 37) + 0.1 * pores), 0.45 + 0.35 * (1 - crease) + 0.1 * pores, 1 - 0.55 * crease]
  },
  // Fine soft bumps, damp skin of a frog.
  skin: (u, v) => {
    const w = worley(u, v, 16, 41, 0.9)
    const bump = 1 - sstep(0, 0.7, w.f1)
    const soft = fbm(u, v, 6, 6, 2, 43)
    return [clamp01(bump * 0.5 + soft * 0.5), 0.3 + 0.3 * soft, 1 - 0.25 * sstep(0.3, 0.7, w.f1)]
  },
  // Streaks that run one way, with fine barbs.
  feather: (u, v) => {
    const streak = fbm(u, v, 6, 56, 3, 51)
    const barb = vnoise(u * 80, v * 4, 80, 4, 53)
    return [clamp01(streak * 0.7 + barb * 0.3), 0.55 + 0.3 * streak, 0.62 + 0.38 * streak]
  },
  // Plain fine grain for chitin, shell and shark skin.
  grain: (u, v) => {
    const f = fbm(u, v, 40, 40, 3, 61)
    const m = fbm(u, v, 7, 7, 2, 63)
    return [f, 0.4 + 0.4 * m, 0.75 + 0.25 * f]
  },
}

export interface DetailMap {
  /** RGBA bytes: R and G are the height gradient across u and v (0.5 is flat), B roughness variation, A cavity. */
  pixels: Uint8Array
  /** Gradient magnitude that a fully saturated R or G channel stands for, in height per unit of uv. */
  gradMax: number
}

/**
 * A tileable detail map of `size` pixels per side. The height field is turned into its gradient here, so the shader
 * can bend the normal from two texture reads (no screen space derivatives, so no blocky artifacts up close).
 */
export function detailMap(kind: DetailKind, size = 128): DetailMap {
  const f = samplers[kind]
  const h = new Float32Array(size * size)
  const g = new Float32Array(size * size)
  const c = new Float32Array(size * size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, gg, b] = f((x + 0.5) / size, (y + 0.5) / size)
      h[y * size + x] = clamp01(r)
      g[y * size + x] = clamp01(gg)
      c[y * size + x] = clamp01(b)
    }
  }
  const at = (x: number, y: number) => h[((y + size) % size) * size + ((x + size) % size)]
  const gx = new Float32Array(size * size)
  const gy = new Float32Array(size * size)
  const mags: number[] = []
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x
      gx[i] = ((at(x + 1, y) - at(x - 1, y)) * size) / 2
      gy[i] = ((at(x, y + 1) - at(x, y - 1)) * size) / 2
      mags.push(Math.max(Math.abs(gx[i]), Math.abs(gy[i])))
    }
  }
  mags.sort((p, q) => p - q)
  const gradMax = Math.max(1e-3, mags[Math.floor(mags.length * 0.995)])
  const out = new Uint8Array(size * size * 4)
  const enc = (v: number) => Math.round(clamp01(0.5 + (0.5 * v) / gradMax) * 255)
  for (let i = 0; i < size * size; i++) {
    out[i * 4] = enc(gx[i])
    out[i * 4 + 1] = enc(gy[i])
    out[i * 4 + 2] = Math.round(g[i] * 255)
    out[i * 4 + 3] = Math.round(c[i] * 255)
  }
  return { pixels: out, gradMax }
}

/** Raw height map as RGBA bytes (R is the height, G roughness variation, B cavity). For inspection and tests. */
export function detailPixels(kind: DetailKind, size = 128): Uint8Array {
  const out = new Uint8Array(size * size * 4)
  const f = samplers[kind]
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b] = f((x + 0.5) / size, (y + 0.5) / size)
      const i = (y * size + x) * 4
      out[i] = Math.round(clamp01(r) * 255)
      out[i + 1] = Math.round(clamp01(g) * 255)
      out[i + 2] = Math.round(clamp01(b) * 255)
      out[i + 3] = 255
    }
  }
  return out
}

export interface DetailLook {
  kind: DetailKind
  /** Texture repeats per geometry unit. */
  freq: number
  /** Bump strength: height of the pattern in geometry units, over one repeat of the map. */
  bump: number
  /** Base roughness of the surface. */
  rough: number
  /** How strongly the map varies roughness. */
  roughVar: number
  /** How strongly the cavity channel darkens the color. */
  cavity: number
}

/** Which skin each specimen wears. */
export const SPECIMEN_LOOK: Record<string, DetailLook> = {
  'american-alligator': { kind: 'gator', freq: 0.42, bump: 0.032, rough: 0.55, roughVar: 0.4, cavity: 0.6 },
  'largemouth-bass': { kind: 'fish', freq: 0.55, bump: 0.007, rough: 0.3, roughVar: 0.25, cavity: 0.16 },
  'bull-shark': { kind: 'grain', freq: 1.4, bump: 0.006, rough: 0.34, roughVar: 0.25, cavity: 0.2 },
  manatee: { kind: 'wrinkle', freq: 0.4, bump: 0.05, rough: 0.58, roughVar: 0.45, cavity: 0.5 },
  'florida-panther': { kind: 'fur', freq: 0.8, bump: 0.012, rough: 0.8, roughVar: 0.3, cavity: 0.25 },
  'blue-crab': { kind: 'grain', freq: 0.7, bump: 0.02, rough: 0.4, roughVar: 0.4, cavity: 0.4 },
  'gopher-tortoise': { kind: 'grain', freq: 0.6, bump: 0.025, rough: 0.6, roughVar: 0.4, cavity: 0.5 },
  'brown-pelican': { kind: 'feather', freq: 0.7, bump: 0.01, rough: 0.7, roughVar: 0.3, cavity: 0.35 },
  'barred-owl': { kind: 'feather', freq: 0.8, bump: 0.012, rough: 0.75, roughVar: 0.3, cavity: 0.4 },
  'green-tree-frog': { kind: 'skin', freq: 0.9, bump: 0.02, rough: 0.3, roughVar: 0.3, cavity: 0.3 },
  grasshopper: { kind: 'grain', freq: 1.2, bump: 0.01, rough: 0.42, roughVar: 0.3, cavity: 0.3 },
  'garden-spider': { kind: 'grain', freq: 1.6, bump: 0.008, rough: 0.5, roughVar: 0.3, cavity: 0.3 },
}

export const DEFAULT_LOOK: DetailLook = { kind: 'grain', freq: 1, bump: 0.01, rough: 0.5, roughVar: 0.3, cavity: 0.3 }
