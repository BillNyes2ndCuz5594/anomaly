import { expect, it } from 'vitest'
import { BoxGeometry } from 'three/webgpu'
import { cachedOutline } from './cachedOutline'

it('reuses silhouettes until the geometry changes or the sample count changes', () => {
  const geo = new BoxGeometry(1, 2, 3)
  const first = cachedOutline(geo, 20)
  expect(cachedOutline(geo, 20)).toBe(first)
  geo.translate(10, 0, 0)
  const moved = cachedOutline(geo, 20)
  expect(moved).not.toBe(first)
  expect(Math.min(...moved.map((p) => p[0]))).toBeGreaterThan(9)
  expect(cachedOutline(geo, 96)).not.toBe(moved)
  geo.dispose()
})
