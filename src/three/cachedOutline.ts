import type { BufferGeometry } from 'three/webgpu'
import { outlinePoints, type V3 } from './fit'

const cache = new WeakMap<BufferGeometry, { version: number; count: number; points: V3[] }>()
/** Scan vertices only when a silhouette is requested, once per geometry version and sample count. */
export function cachedOutline(geometry: BufferGeometry, count: number): V3[] {
  const position = geometry.getAttribute('position')
  if (!position || !position.count) return []
  const version = 'version' in position ? position.version as number : position.data.version
  let entry = cache.get(geometry)
  if (!entry || entry.version !== version || entry.count !== count) {
    entry = { version, count, points: outlinePoints(position.array as ArrayLike<number>, count) }
    cache.set(geometry, entry)
  }
  return entry.points
}
