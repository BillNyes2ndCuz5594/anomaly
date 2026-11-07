import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('Hub and Results copy slices (HC-01..HC-04)', () => {
  const hubSource = readFileSync(resolve(__dirname, 'HubScreen.tsx'), 'utf8')
  const resultsSource = readFileSync(resolve(__dirname, 'case/Results.tsx'), 'utf8')

  it('HC-01: drone paint empty state has kid-friendly sentences', () => {
    expect(hubSource).toContain('Grow any science skill by one stage on a mission. Then your drone gets new paint colors!')
    expect(hubSource).not.toContain('Move any science skill up a stage on a mission to unlock drone paint colors.')
  })

  it('HC-02: current unit group heading uses natural voice', () => {
    expect(hubSource).toContain("['current-unit', \"You're in Unit 4\", currentCases]")
    expect(hubSource).not.toContain('Your unit right now: Unit 4')
  })

  it('HC-03: case standards disclosure summary reads Science goals', () => {
    expect(hubSource).toContain('<summary>Science goals</summary>')
    expect(hubSource).not.toContain('<summary>Standards</summary>')
  })

  it('HC-04: results missing review returns No review yet', () => {
    expect(resultsSource).toContain("if (!iso) return 'No review yet'")
    expect(resultsSource).not.toContain('No review scheduled yet')
  })
})
