import { describe, expect, it } from 'vitest'
import { content } from '../../../content'
import { layoutMarkers, MARKER_LABEL_FLIP_LON, MARKER_MIN_SEP } from './markerMotion'

const COLD = { id: 'cold', lon: -81.1, lat: 26.2 }
const dist = (a: { lon: number; lat: number }, b: { lon: number; lat: number }) => Math.hypot(a.lon - b.lon, a.lat - b.lat)

describe('layoutMarkers', () => {
  it('keeps the VITALS marker where it always was', () => {
    const [v] = layoutMarkers(content.cases.map((c) => ({ id: c.id, lon: c.marker.lon, lat: c.marker.lat })), [COLD])
    expect(v).toEqual({ id: '03-1', lon: -81.4, lat: 28.5, height: 1.75, side: 1 })
  })

  it('fans ten markers at the Cape apart, never further east, labels away from the side panel', () => {
    const cape = Array.from({ length: 10 }, (_, i) => ({ id: `0${i}-1`, lon: -80.6, lat: 28.39 }))
    const out = layoutMarkers([{ id: '03-1', lon: -81.4, lat: 28.5 }, ...cape], [COLD])
    expect(out).toHaveLength(11)
    for (let i = 0; i < out.length; i++) {
      expect(dist(out[i], COLD), out[i].id).toBeGreaterThanOrEqual(MARKER_MIN_SEP - 1e-9)
      for (let j = i + 1; j < out.length; j++) expect(dist(out[i], out[j]), `${out[i].id} ${out[j].id}`).toBeGreaterThanOrEqual(MARKER_MIN_SEP - 1e-9)
    }
    for (const m of out.slice(1)) {
      expect(m.lon).toBeLessThanOrEqual(-80.6 + 1e-9)
      expect(m.side).toBe(m.lon > MARKER_LABEL_FLIP_LON ? -1 : 1)
      expect(Math.abs(m.lat - 28.39)).toBeLessThan(3)
    }
    expect(out[1]).toMatchObject({ lon: -80.6, lat: 28.39, side: -1 })
  })

  it('alternates heights so neighbouring labels do not line up', () => {
    const out = layoutMarkers([0, 1, 2, 3].map((i) => ({ id: `${i}`, lon: -82 - i, lat: 28 })))
    expect(out.map((m) => m.height)).toEqual([1.75, 1.35, 2.15, 1.75])
  })
})
