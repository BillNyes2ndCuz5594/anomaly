import { describe, expect, it } from 'vitest'
import { FLORIDA_LONLAT, lonLatToXZ } from './florida'

describe('florida outline', () => {
  it('stays within the table (radius 3.7)', () => {
    for (const [lon, lat] of FLORIDA_LONLAT) {
      const [x, z] = lonLatToXZ(lon, lat)
      expect(Math.hypot(x, z)).toBeLessThan(3.4)
    }
  })
  it('puts north away from the viewer', () => {
    expect(lonLatToXZ(-82, 30)[1]).toBeLessThan(lonLatToXZ(-82, 26)[1])
  })
})
