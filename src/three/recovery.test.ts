import { describe, expect, it } from 'vitest'
import { isChunkLoadError, LOSS_WINDOW_MS, MAX_LOSSES, onGpuLoss } from './recovery'

describe('onGpuLoss', () => {
  it('remounts on the first loss and keeps WebGPU', () => {
    const d = onGpuLoss([], 1000, 'WebGPU', false)
    expect(d).toEqual({ remount: true, forceWebGL: false, recent: [1000] })
  })
  it('falls back to WebGL2 after a second WebGPU loss inside the window', () => {
    const d = onGpuLoss([1000], 5000, 'WebGPU', false)
    expect(d.remount).toBe(true)
    expect(d.forceWebGL).toBe(true)
  })
  it('forgets losses older than the window', () => {
    const d = onGpuLoss([1000], 1000 + LOSS_WINDOW_MS + 1, 'WebGPU', false)
    expect(d.recent).toHaveLength(1)
    expect(d.forceWebGL).toBe(false)
  })
  it('keeps a WebGL context loss on WebGL and stays on WebGL once chosen', () => {
    expect(onGpuLoss([], 0, 'WebGL', false).forceWebGL).toBe(false)
    expect(onGpuLoss([], 0, 'WebGL', true).forceWebGL).toBe(true)
  })
  it('stops remounting in a loss loop', () => {
    const prev = Array.from({ length: MAX_LOSSES }, (_, i) => i * 10)
    expect(onGpuLoss(prev, 100, 'WebGL', true).remount).toBe(false)
  })
})

describe('isChunkLoadError', () => {
  it('spots stale lazy chunks across browsers', () => {
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: https://x/assets/CaseScene-abc.js'))).toBe(true)
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true)
    expect(isChunkLoadError(new Error('error loading dynamically imported module'))).toBe(true)
    expect(isChunkLoadError(new Error('Cannot read properties of null'))).toBe(false)
  })
})
