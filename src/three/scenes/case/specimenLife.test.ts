import { describe, expect, it } from 'vitest'
import { AQUATIC, idPhase } from './specimenLife'

describe('specimenLife', () => {
  it('lists the three aquatic specimens', () => {
    expect([...AQUATIC].sort()).toEqual(['bull-shark', 'largemouth-bass', 'manatee'])
  })
  it('gives a stable phase in range that differs between ids', () => {
    expect(idPhase('manatee')).toBe(idPhase('manatee'))
    expect(idPhase('manatee')).not.toBe(idPhase('bull-shark'))
    for (const id of ['manatee', 'bull-shark', 'a', '']) {
      expect(idPhase(id)).toBeGreaterThanOrEqual(0)
      expect(idPhase(id)).toBeLessThan(2 * Math.PI + 0.001)
    }
  })
})
