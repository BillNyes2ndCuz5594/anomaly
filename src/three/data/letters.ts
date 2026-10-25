// 5x7 block letters for the ANOMALY logo. '#' is a cube.
export const GLYPHS: Record<string, readonly string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '##..#', '#.#.#', '#..##', '#..##', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#', '#...#', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
}

export interface Voxel {
  x: number
  y: number
  z: number
}

/** Cube centers (unit grid, y up, centered on x, bottom row at y=0) for a word. */
export function layoutWord(word: string, depth = 2, gapCols = 1): Voxel[] {
  const out: Voxel[] = []
  const cols = word.length * 5 + (word.length - 1) * gapCols
  let cx = 0
  for (const ch of word) {
    const g = GLYPHS[ch]
    if (!g) continue
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (g[row][col] !== '#') continue
        for (let z = 0; z < depth; z++) {
          out.push({ x: cx + col - (cols - 1) / 2, y: 6 - row, z: z - (depth - 1) / 2 })
        }
      }
    }
    cx += 5 + gapCols
  }
  return out
}
